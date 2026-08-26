# app/routes/settings.py
"""System settings management endpoints."""

from datetime import datetime, timedelta
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List
from app.database import settings_col, attendance_col
from app.auth import require_role
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["Settings"])


class SettingsUpdate(BaseModel):
    company_name: str = Field(min_length=2, max_length=100)
    work_start: str = Field(pattern=r"^\d{2}:\d{2}$")
    work_end: str = Field(pattern=r"^\d{2}:\d{2}$")
    late_threshold_minutes: int = Field(ge=0, le=120)
    weekend_days: List[str]
    biometric_device_ip: str = Field(default="192.168.1.3")
    biometric_device_port: int = Field(default=4370, ge=1, le=65535)


def recalculate_attendance_lateness() -> int:
    """
    Recalculates status ('late' vs 'on_time') for all non-exempt attendance records
    that have a valid check_in time, based on current work_start and late_threshold_minutes.
    Returns the count of updated records.
    """
    try:
        settings.sync_from_db()
        work_start = datetime.strptime(settings.WORK_START, "%H:%M")
        threshold = work_start + timedelta(minutes=settings.LATE_THRESHOLD_MINUTES)

        records = list(attendance_col().find({
            "employee_id": {"$ne": "EMP-7777"},
            "check_in": {"$ne": None, "$exists": True},
            "status": {"$in": ["on_time", "late"]}
        }))

        updated_count = 0
        for r in records:
            check_in_str = r.get("check_in")
            if not check_in_str:
                continue
            try:
                clean_time = check_in_str[:8] if len(check_in_str) >= 8 else check_in_str[:5]
                actual = datetime.strptime(clean_time, "%H:%M:%S" if len(clean_time) >= 8 else "%H:%M")
                new_status = "late" if actual.time() > threshold.time() else "on_time"
                if new_status != r.get("status"):
                    attendance_col().update_one(
                        {"_id": r["_id"]},
                        {"$set": {"status": new_status}}
                    )
                    updated_count += 1
            except Exception:
                continue

        logger.info(f"Recalculated attendance lateness: {updated_count} records updated to reflect threshold {settings.LATE_THRESHOLD_MINUTES} mins.")
        return updated_count
    except Exception as e:
        logger.error(f"Error recalculating attendance lateness: {e}")
        return 0


@router.get("")
def get_system_settings():
    """Retrieve the current system settings."""
    settings.sync_from_db()
    doc = settings_col().find_one()
    if not doc:
        # Fallback to config values
        return {
            "company_name": settings.COMPANY_NAME,
            "work_start": settings.WORK_START,
            "work_end": settings.WORK_END,
            "late_threshold_minutes": settings.LATE_THRESHOLD_MINUTES,
            "weekend_days": settings.WEEKEND_DAYS,
            "biometric_device_ip": settings.BIOMETRIC_DEVICE_IP,
            "biometric_device_port": settings.BIOMETRIC_DEVICE_PORT,
        }
    
    return {
        "company_name": doc.get("company_name", settings.COMPANY_NAME),
        "work_start": doc.get("work_start", settings.WORK_START),
        "work_end": doc.get("work_end", settings.WORK_END),
        "late_threshold_minutes": doc.get("late_threshold_minutes", settings.LATE_THRESHOLD_MINUTES),
        "weekend_days": doc.get("weekend_days", settings.WEEKEND_DAYS),
        "biometric_device_ip": doc.get("biometric_device_ip", settings.BIOMETRIC_DEVICE_IP),
        "biometric_device_port": doc.get("biometric_device_port", settings.BIOMETRIC_DEVICE_PORT),
    }


@router.put("")
def update_system_settings(
    data: SettingsUpdate,
    current_user: dict = Depends(require_role("admin")),
):
    """Update global system settings and automatically apply to the entire system."""
    update_data = {
        "company_name": data.company_name,
        "work_start": data.work_start,
        "work_end": data.work_end,
        "late_threshold_minutes": data.late_threshold_minutes,
        "weekend_days": [day.lower() for day in data.weekend_days],
        "biometric_device_ip": data.biometric_device_ip,
        "biometric_device_port": data.biometric_device_port,
        "updated_at": datetime.now().isoformat(),
    }

    # Update in database
    settings_col().update_one({}, {"$set": update_data}, upsert=True)

    # Hot-reload in memory settings
    settings.COMPANY_NAME = data.company_name
    settings.WORK_START = data.work_start
    settings.WORK_END = data.work_end
    settings.LATE_THRESHOLD_MINUTES = data.late_threshold_minutes
    settings.WEEKEND_DAYS = [day.lower() for day in data.weekend_days]
    settings.BIOMETRIC_DEVICE_IP = data.biometric_device_ip
    settings.BIOMETRIC_DEVICE_PORT = data.biometric_device_port

    # Recalculate attendance records across the entire system
    updated_records = recalculate_attendance_lateness()

    return {
        "message": "Settings updated successfully and applied system-wide",
        "settings": update_data,
        "recalculated_records": updated_records
    }


@router.post("/recalculate-attendance")
def trigger_recalculate_attendance(
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Manually trigger recalculation of late/on_time status for all attendance records."""
    updated_count = recalculate_attendance_lateness()
    return {
        "message": f"تمت إعادة احتساب سجلات الحضور بنجاح بناءً على فترة السماح ({settings.LATE_THRESHOLD_MINUTES} دقيقة)",
        "updated_records": updated_count
    }

