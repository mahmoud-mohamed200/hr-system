# app/routes/attendance.py
"""Attendance tracking endpoints — check-in, check-out, records, and today summary."""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.database import attendance_col, employees_col
from app.auth import get_current_user, require_role
from app.models.attendance import (
    AttendanceRecord, AttendanceCheckIn, AttendanceCheckOut,
    AttendanceListResponse, TodaySummary,
)
from app.config import settings

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


def _get_today_str() -> str:
    """Get today's date as YYYY-MM-DD string."""
    return datetime.now().strftime("%Y-%m-%d")


def _get_current_time_str() -> str:
    """Get current time as HH:MM:SS string."""
    return datetime.now().strftime("%H:%M:%S")


def _is_late(check_in_time: str) -> bool:
    """Check if a check-in time is past the late threshold."""
    try:
        work_start = datetime.strptime(settings.WORK_START, "%H:%M")
        threshold = work_start + timedelta(minutes=settings.LATE_THRESHOLD_MINUTES)
        actual = datetime.strptime(check_in_time, "%H:%M:%S")
        return actual.time() > threshold.time()
    except ValueError:
        return False


def _is_weekend() -> bool:
    """Check if today is a weekend day."""
    day_name = datetime.now().strftime("%A").lower()
    return day_name in settings.WEEKEND_DAYS


def _calc_hours(check_in: str, check_out: str) -> float:
    """Calculate hours worked between check-in and check-out times."""
    try:
        t_in = datetime.strptime(check_in, "%H:%M:%S")
        t_out = datetime.strptime(check_out, "%H:%M:%S")
        diff = (t_out - t_in).total_seconds() / 3600
        return round(max(0, diff), 2)
    except ValueError:
        return 0.0


def _record_to_response(rec: dict) -> AttendanceRecord:
    """Convert a MongoDB attendance document to response model."""
    return AttendanceRecord(
        id=str(rec["_id"]),
        employee_id=rec["employee_id"],
        employee_name=rec.get("employee_name", ""),
        department=rec.get("department", ""),
        job_title=rec.get("job_title", ""),
        date=rec["date"],
        check_in=rec.get("check_in"),
        check_out=rec.get("check_out"),
        status=rec.get("status", "absent"),
        hours_worked=rec.get("hours_worked"),
        notes=rec.get("notes"),
        source=rec.get("source", "manual"),
    )


@router.get("/today", response_model=TodaySummary)
def get_today_summary(current_user: dict = Depends(get_current_user)):
    """Get today's attendance summary across all employees."""
    today = _get_today_str()
    total_employees = employees_col().count_documents({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    })
    today_records = list(attendance_col().find({"date": today, "employee_id": {"$ne": "EMP-7777"}}))

    present = len(today_records)
    late = sum(1 for r in today_records if r.get("status") == "late")
    on_time = sum(1 for r in today_records if r.get("status") == "on_time")
    not_checked_out = sum(1 for r in today_records if r.get("check_in") and not r.get("check_out"))
    absent = total_employees - present

    return TodaySummary(
        total_employees=total_employees,
        present=present,
        absent=max(0, absent),
        late=late,
        on_time=on_time,
        not_checked_out=not_checked_out,
    )


@router.get("", response_model=AttendanceListResponse)
def list_attendance(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    department: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List attendance records with filters."""
    query = {}
    if date:
        query["date"] = date
    if current_user.get("role") not in ["hr", "ceo"]:
        query["employee_id"] = current_user.get("employee_id")
    else:
        if employee_id:
            query["employee_id"] = employee_id
        else:
            query["employee_id"] = {"$ne": "EMP-7777"}
        if department:
            query["department"] = department
    if status_filter:
        query["status"] = status_filter

    total = attendance_col().count_documents(query)
    skip = (page - 1) * per_page
    cursor = (
        attendance_col()
        .find(query)
        .sort([("date", -1), ("check_in", -1)])
        .skip(skip)
        .limit(per_page)
    )

    records = [_record_to_response(rec) for rec in cursor]

    return AttendanceListResponse(
        records=records, total=total, page=page, per_page=per_page
    )


@router.get("/employee/{employee_id}")
def get_employee_attendance(
    employee_id: str,
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get attendance history for a specific employee."""
    query = {"employee_id": employee_id}
    if month:
        # month format: YYYY-MM
        query["date"] = {"$regex": f"^{month}"}

    records = list(
        attendance_col().find(query).sort("date", -1).limit(100)
    )

    return {
        "employee_id": employee_id,
        "records": [_record_to_response(r) for r in records],
        "total": len(records),
    }


@router.post("/check-in")
def manual_check_in(
    data: AttendanceCheckIn,
    current_user: dict = Depends(require_role("hr")),
):
    """Manually check in an employee."""
    emp = employees_col().find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if data.employee_id == "EMP-7777" or emp.get("job_title") == "الرئيس التنفيذي" or emp.get("email") == "ceo@xqpharma.com":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")

    today = _get_today_str()

    # Check if already checked in today
    existing = attendance_col().find_one(
        {"employee_id": data.employee_id, "date": today}
    )
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="Already checked in today")

    now_time = _get_current_time_str()
    status_val = "late" if _is_late(now_time) else "on_time"

    record = {
        "employee_id": data.employee_id,
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "job_title": emp.get("job_title", ""),
        "date": today,
        "check_in": now_time,
        "check_out": None,
        "status": status_val,
        "hours_worked": None,
        "notes": data.notes,
        "source": "manual",
    }

    if existing:
        attendance_col().update_one(
            {"_id": existing["_id"]},
            {"$set": {"check_in": now_time, "status": status_val, "source": "manual"}},
        )
    else:
        attendance_col().insert_one(record)

    return {"message": f"{emp['name']} checked in at {now_time}", "status": status_val}


@router.post("/check-out")
def manual_check_out(
    data: AttendanceCheckOut,
    current_user: dict = Depends(require_role("hr")),
):
    """Manually check out an employee."""
    if data.employee_id == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")
    today = _get_today_str()
    record = attendance_col().find_one(
        {"employee_id": data.employee_id, "date": today}
    )
    if not record:
        raise HTTPException(status_code=400, detail="No check-in found for today")
    if record.get("check_out"):
        raise HTTPException(status_code=400, detail="Already checked out today")

    now_time = _get_current_time_str()
    hours = _calc_hours(record["check_in"], now_time) if record.get("check_in") else 0

    attendance_col().update_one(
        {"_id": record["_id"]},
        {"$set": {"check_out": now_time, "hours_worked": hours, "notes": data.notes}},
    )

    return {
        "message": f"Checked out at {now_time}",
        "hours_worked": hours,
    }


@router.post("/self-check-in")
def self_check_in(
    current_user: dict = Depends(get_current_user),
):
    """Allow any employee to manually check themselves in."""
    emp_id = current_user.get("employee_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="المستخدم الحالي غير مرتبط بملف موظف")
    if current_user.get("role") == "ceo" or emp_id == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")

    emp = employees_col().find_one({"employee_id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    today = _get_today_str()

    # Check if already checked in today
    existing = attendance_col().find_one(
        {"employee_id": emp_id, "date": today}
    )
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="تم تسجيل الحضور بالفعل اليوم")

    now_time = _get_current_time_str()
    status_val = "late" if _is_late(now_time) else "on_time"

    record = {
        "employee_id": emp_id,
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "job_title": emp.get("job_title", ""),
        "date": today,
        "check_in": now_time,
        "check_out": None,
        "status": status_val,
        "hours_worked": None,
        "notes": "تسجيل حضور يدوي مباشر من الحساب الشخصي",
        "source": "manual",
    }

    if existing:
        attendance_col().update_one(
            {"_id": existing["_id"]},
            {"$set": {"check_in": now_time, "status": status_val, "source": "manual"}},
        )
    else:
        attendance_col().insert_one(record)

    return {"message": f"تم تسجيل حضورك بنجاح في {now_time}", "status": status_val}


@router.post("/self-check-out")
def self_check_out(
    current_user: dict = Depends(get_current_user),
):
    """Allow any employee to manually check themselves out."""
    emp_id = current_user.get("employee_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="المستخدم الحالي غير مرتبط بملف موظف")
    if current_user.get("role") == "ceo" or emp_id == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")

    today = _get_today_str()
    record = attendance_col().find_one(
        {"employee_id": emp_id, "date": today}
    )
    if not record:
        raise HTTPException(status_code=400, detail="لم يتم العثور على تسجيل حضور لليوم")
    if record.get("check_out"):
        raise HTTPException(status_code=400, detail="تم تسجيل الانصراف بالفعل اليوم")

    now_time = _get_current_time_str()
    hours = _calc_hours(record["check_in"], now_time) if record.get("check_in") else 0

    attendance_col().update_one(
        {"_id": record["_id"]},
        {"$set": {"check_out": now_time, "hours_worked": hours, "notes": "تسجيل انصراف يدوي مباشر من الحساب الشخصي", "source": "manual"}},
    )

    return {
        "message": f"تم تسجيل انصرافك بنجاح في {now_time}",
        "hours_worked": hours,
    }


import math
import random
from pydantic import BaseModel

class GPSCheckRequest(BaseModel):
    latitude: float
    longitude: float
    notes: Optional[str] = None


def _get_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Haversine distance in meters."""
    R = 6371000.0  # Radius of earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@router.post("/gps-check-in")
def gps_check_in(
    data: GPSCheckRequest,
    current_user: dict = Depends(get_current_user),
):
    """Check in using mobile GPS. Enforces geofencing radius constraint."""
    emp_id = current_user.get("employee_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="المستخدم الحالي غير مرتبط بملف موظف")
    if current_user.get("role") == "ceo" or emp_id == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")

    emp = employees_col().find_one({"employee_id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    # Geofence validation
    dist = _get_distance_meters(
        data.latitude, data.longitude,
        settings.BRANCH_LATITUDE, settings.BRANCH_LONGITUDE
    )
    if dist > settings.BRANCH_RADIUS_METERS:
        raise HTTPException(
            status_code=400,
            detail=f"أنت خارج النطاق الجغرافي المسموح به للشركة (المسافة: {dist:.1f} متر، المسموح به: {settings.BRANCH_RADIUS_METERS} متر)"
        )

    today = _get_today_str()
    existing = attendance_col().find_one({"employee_id": emp_id, "date": today})
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="تم تسجيل الحضور بالفعل اليوم")

    now_time = _get_current_time_str()
    status_val = "late" if _is_late(now_time) else "on_time"

    record = {
        "employee_id": emp_id,
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "job_title": emp.get("job_title", ""),
        "date": today,
        "check_in": now_time,
        "check_out": None,
        "status": status_val,
        "hours_worked": None,
        "notes": f"GPS: {data.notes or ''}",
        "source": "gps",
    }

    if existing:
        attendance_col().update_one(
            {"_id": existing["_id"]},
            {"$set": {"check_in": now_time, "status": status_val, "source": "gps"}},
        )
    else:
        attendance_col().insert_one(record)

    return {"message": f"تم تسجيل الحضور بنجاح عند {now_time}", "status": status_val}


@router.post("/gps-check-out")
def gps_check_out(
    data: GPSCheckRequest,
    current_user: dict = Depends(get_current_user),
):
    """Check out using mobile GPS. Enforces geofencing radius constraint."""
    emp_id = current_user.get("employee_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="المستخدم الحالي غير مرتبط بملف موظف")
    if current_user.get("role") == "ceo" or emp_id == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")

    # Geofence validation
    dist = _get_distance_meters(
        data.latitude, data.longitude,
        settings.BRANCH_LATITUDE, settings.BRANCH_LONGITUDE
    )
    if dist > settings.BRANCH_RADIUS_METERS:
        raise HTTPException(
            status_code=400,
            detail=f"أنت خارج النطاق الجغرافي المسموح به للشركة (المسافة: {dist:.1f} متر)"
        )

    today = _get_today_str()
    record = attendance_col().find_one({"employee_id": emp_id, "date": today})
    if not record:
        raise HTTPException(status_code=400, detail="لم يتم العثور على تسجيل حضور اليوم")
    if record.get("check_out"):
        raise HTTPException(status_code=400, detail="تم تسجيل الانصراف بالفعل اليوم")

    now_time = _get_current_time_str()
    hours = _calc_hours(record["check_in"], now_time) if record.get("check_in") else 0

    attendance_col().update_one(
        {"_id": record["_id"]},
        {"$set": {"check_out": now_time, "hours_worked": hours, "notes": f"GPS: {data.notes or ''}"}},
    )

    return {
        "message": f"تم تسجيل الانصراف بنجاح عند {now_time}",
        "hours_worked": hours,
    }


@router.post("/sync-biometric")
def sync_biometric(current_user: dict = Depends(require_role("hr"))):
    """Mock API simulating sync with fingerprint biometric devices daily."""
    today = _get_today_str()
    active_employees = list(employees_col().find({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    }))
    synced_count = 0
    
    for emp in active_employees:
        emp_id = emp["employee_id"]
        # Skip if they already have attendance recorded today (e.g. leave, mission or GPS)
        existing = attendance_col().find_one({"employee_id": emp_id, "date": today})
        if existing:
            continue
            
        # Simulate biometric check-in (85% attendance probability)
        if random.random() < 0.85:
            # 80% on-time, 20% late
            if random.random() < 0.80:
                h = random.randint(8, 10)
                m = random.randint(0, 59)
            else:
                h = random.randint(11, 12)
                m = random.randint(0, 30)
                
            check_in_time = f"{h:02d}:{m:02d}:00"
            status_val = "late" if _is_late(check_in_time) else "on_time"
            
            # Simulate check-out 8 hours later
            h_out = min(23, h + random.randint(7, 9))
            m_out = random.randint(0, 59)
            check_out_time = f"{h_out:02d}:{m_out:02d}:00"
            hours = _calc_hours(check_in_time, check_out_time)
            
            record = {
                "employee_id": emp_id,
                "employee_name": emp["name"],
                "department": emp.get("department", ""),
                "job_title": emp.get("job_title", ""),
                "date": today,
                "check_in": check_in_time,
                "check_out": check_out_time,
                "status": status_val,
                "hours_worked": hours,
                "notes": "Biometric Sync",
                "source": "biometric",
            }
            attendance_col().insert_one(record)
            synced_count += 1
            
    return {"message": f"تم سحب البيانات من أجهزة البصمة لـ {synced_count} موظف اليوم"}
