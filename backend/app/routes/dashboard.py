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
    """Aggregate stats based on user role."""
    today = _get_today_str()
    month_str = today[:7]  # YYYY-MM
    user_role = current_user.get("role")

    # 1. CEO, Admin and HR dashboard (full attendance and organization overview)
    if user_role in ["admin", "hr", "ceo"]:
        total_employees = employees_col().count_documents({
            "is_active": True,
            "employee_id": {"$ne": "EMP-7777"},
            "email": {"$ne": "ceo@xqpharma.com"},
            "job_title": {"$ne": "الرئيس التنفيذي"}
        })

        today_records = list(attendance_col().find({"date": today, "employee_id": {"$ne": "EMP-7777"}}))
        present_today = len(today_records)
        late_today = sum(1 for r in today_records if r.get("status") == "late")
        on_time_today = sum(1 for r in today_records if r.get("status") == "on_time")
        absent_today = max(0, total_employees - present_today)
        camera_count = len(settings.CAMERA_CONFIG)

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
                rate = 100
            dept_rates.append({
                "department": dept_name,
                "rate": rate,
                "employee_count": dept_emps
            })

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
            "role": user_role,
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

    # 2. Employee dashboard (personal attendance, check-in log, leaves/loans updates)
    else:
        emp_id = current_user.get("employee_id")
        
        # Get personal summary stats for current month
        present_days = attendance_col().count_documents({
            "employee_id": emp_id,
            "date": {"$regex": f"^{month_str}"},
            "status": {"$in": ["on_time", "late", "excused"]}
        })
        late_days = attendance_col().count_documents({
            "employee_id": emp_id,
            "date": {"$regex": f"^{month_str}"},
            "status": "late"
        })
        absent_days = attendance_col().count_documents({
            "employee_id": emp_id,
            "date": {"$regex": f"^{month_str}"},
            "status": "absent"
        })

        # Today's check-in/out status
        today_rec = attendance_col().find_one({"employee_id": emp_id, "date": today})
        today_check_in = today_rec.get("check_in") if today_rec else None
        today_check_out = today_rec.get("check_out") if today_rec else None
        
        status_map_ar = {
            "on_time": "منضبط",
            "late": "متأخر",
            "absent": "غائب",
            "leave": "إجازة",
            "excused": "مستثنى"
        }
        today_status = status_map_ar.get(today_rec.get("status"), "غير مسجل") if today_rec else "لم يسجل بعد"

        # Recent personal records
        recent_cursor = attendance_col().find({"employee_id": emp_id}).sort("date", -1).limit(10)
        recent_events = []
        for r in recent_cursor:
            recent_events.append({
                "id": str(r["_id"]),
                "date": r["date"],
                "check_in": r.get("check_in"),
                "check_out": r.get("check_out"),
                "status": status_map_ar.get(r.get("status"), r.get("status", "غائب")),
                "notes": r.get("notes") or ""
            })

        return {
            "role": "employee",
            "stats": {
                "presentDays": present_days,
                "lateDays": late_days,
                "absentDays": absent_days,
                "todayCheckIn": today_check_in,
                "todayCheckOut": today_check_out,
                "todayStatus": today_status
            },
            "recentEvents": recent_events
        }
