# app/routes/dashboard.py
"""Dashboard statistics aggregation endpoint."""

from fastapi import APIRouter, Depends
from datetime import datetime
from app.database import employees_col, attendance_col, departments_col
from app.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _get_today_str() -> str:
    """Get today's date as YYYY-MM-DD string."""
    return datetime.now().strftime("%Y-%m-%d")


@router.get("/stats")
def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Aggregate stats for the admin/HR dashboard."""
    today = _get_today_str()

    # 1. Employee totals
    total_employees = employees_col().count_documents({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    })

    # 2. Today's attendance
    today_records = list(attendance_col().find({"date": today, "employee_id": {"$ne": "EMP-7777"}}))
    present_today = len(today_records)
    late_today = sum(1 for r in today_records if r.get("status") == "late")
    on_time_today = sum(1 for r in today_records if r.get("status") == "on_time")
    absent_today = max(0, total_employees - present_today)

    # 3. Active cameras count
    camera_count = len(settings.CAMERA_CONFIG)

    # 4. Department-wise attendance rates
    # Get all departments
    depts = list(departments_col().find())
    dept_rates = []
    for d in depts:
        dept_name = d["name"]
        dept_emps = employees_col().count_documents({
            "department": dept_name,
            "is_active": True,
            "employee_id": {"$ne": "EMP-7777"},
            "email": {"$ne": "ceo@xqpharma.com"},
            "job_title": {"$ne": "الرئيس التنفيذي"}
        })
        if dept_emps > 0:
            dept_present = attendance_col().count_documents({
                "date": today,
                "department": dept_name,
                "employee_id": {"$ne": "EMP-7777"}
            })
            rate = round((dept_present / dept_emps) * 100)
        else:
            rate = 100  # Default if no employees
        dept_rates.append({
            "department": dept_name,
            "rate": rate,
            "employee_count": dept_emps
        })

    # 5. Recent 10 attendance events (across all time, but sorted descending)
    recent_cursor = (
        attendance_col()
        .find({"employee_id": {"$ne": "EMP-7777"}})
        .sort([("date", -1), ("check_in", -1)])
        .limit(10)
    )
    
    recent_events = []
    for r in recent_cursor:
        recent_events.append({
            "id": str(r["_id"]),
            "employee_id": r["employee_id"],
            "name": r.get("employee_name", ""),
            "department": r.get("department", ""),
            "job_title": r.get("job_title", ""),
            "date": r["date"],
            "time": r.get("check_in") or r.get("check_out") or "",
            "status": "In" if r.get("check_in") and not r.get("check_out") else "Out" if r.get("check_out") else "In"
        })

    return {
        "stats": {
            "totalEmployees": total_employees,
            "presentToday": present_today,
            "absentToday": absent_today,
            "lateToday": late_today,
            "onTimeToday": on_time_today,
            "cameraCount": camera_count
        },
        "departmentRates": dept_rates,
        "recentEvents": recent_events
    }
