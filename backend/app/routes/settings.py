# app/routes/settings.py
"""System settings management endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List
from app.database import settings_col
from app.auth import require_role
from app.config import settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class SettingsUpdate(BaseModel):
    company_name: str = Field(min_length=2, max_length=100)
    work_start: str = Field(pattern=r"^\d{2}:\d{2}$")
    work_end: str = Field(pattern=r"^\d{2}:\d{2}$")
    late_threshold_minutes: int = Field(ge=0, le=120)
    weekend_days: List[str]


@router.get("")
def get_system_settings():
    """Retrieve the current system settings."""
    doc = settings_col().find_one()
    if not doc:
        # Fallback to config values
        return {
            "company_name": settings.COMPANY_NAME,
            "work_start": settings.WORK_START,
            "work_end": settings.WORK_END,
            "late_threshold_minutes": settings.LATE_THRESHOLD_MINUTES,
            "weekend_days": settings.WEEKEND_DAYS,
        }
    
    return {
        "company_name": doc["company_name"],
        "work_start": doc["work_start"],
        "work_end": doc["work_end"],
        "late_threshold_minutes": doc["late_threshold_minutes"],
        "weekend_days": doc["weekend_days"],
    }


@router.put("")
def update_system_settings(
    data: SettingsUpdate,
    current_user: dict = Depends(require_role("admin")),
):
    """Update global system settings. Admin/CEO only."""
    update_data = {
        "company_name": data.company_name,
        "work_start": data.work_start,
        "work_end": data.work_end,
        "late_threshold_minutes": data.late_threshold_minutes,
        "weekend_days": [day.lower() for day in data.weekend_days],
    }

    # Update in database
    settings_col().update_one({}, {"$set": update_data}, upsert=True)

    # Hot-reload in memory settings
    settings.COMPANY_NAME = data.company_name
    settings.WORK_START = data.work_start
    settings.WORK_END = data.work_end
    settings.LATE_THRESHOLD_MINUTES = data.late_threshold_minutes
    settings.WEEKEND_DAYS = [day.lower() for day in data.weekend_days]

    return {"message": "Settings updated successfully", "settings": update_data}
