# app/routes/dashboard.py
"""Dashboard statistics aggregation endpoint."""

from fastapi import APIRouter, Depends
from datetime import datetime, date, timedelta
from app.database import employees_col, attendance_col, departments_col
from app.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def get_egyptian_holidays(year: int) -> set:
    fixed = {
        '01-07', '01-25', '04-25', '05-01', '06-30', '07-23', '10-06'
    }
    variable = {
        2025: {
            '03-30', '03-31', '04-01', '04-21', '06-05', '06-06', '06-07', '06-08', '06-09', '06-26', '09-04'
        },
        2026: {
            '03-19', '03-20', '03-21', '04-13', '05-26', '05-27', '05-28', '05-29', '05-30', '06-18', '08-26'
        },
        2027: {
            '03-09', '03-10', '03-11', '05-03', '05-15', '05-16', '05-17', '05-18', '05-19', '06-06', '08-15'
        }
    }
    holidays = {f"{year}-{md}" for md in fixed}
    if year in variable:
        holidays.update({f"{year}-{md}" for md in variable[year]})
    return holidays


def calculate_calendar_absent_days(employee_id: str, month_str: str) -> int:
    import calendar
    try:
        year, month = map(int, month_str.split("-"))
    except ValueError:
        today_dt = datetime.now()
        year, month = today_dt.year, today_dt.month
        month_str = today_dt.strftime("%Y-%m")
        
    holidays = get_egyptian_holidays(year)
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    
    last_day = calendar.monthrange(year, month)[1]
    
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)
    
    # If checking current month, don't check future days
    if month_str == today_dt.strftime("%Y-%m"):
        end_date = today_dt.date()
        
    records = list(attendance_col().find({
        "employee_id": employee_id,
        "date": {"$regex": f"^{month_str}"}
    }))
    records_map = {r["date"]: r for r in records}
    
    absent_count = 0
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        
        # Skip if future
        if date_str > today_str:
            current_date += timedelta(days=1)
            continue
            
        # Check if holiday
        if date_str in holidays:
            current_date += timedelta(days=1)
            continue
            
        # Check if weekend (Friday (4) or Saturday (5) in Python)
        if current_date.weekday() in [4, 5]:
            current_date += timedelta(days=1)
            continue
            
        # Check attendance record
        if date_str in records_map:
            if records_map[date_str].get("status") == "absent":
                absent_count += 1
        else:
            absent_count += 1
            
        current_date += timedelta(days=1)
        
    return absent_count


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
        present_today = sum(1 for r in today_records if r.get("status") in ["on_time", "late", "excused"])
        late_today = sum(1 for r in today_records if r.get("status") == "late")
        on_time_today = sum(1 for r in today_records if r.get("status") == "on_time")
        
        # Calculate actual absent today dynamically (match calendar rules)
        today_date_obj = datetime.now().date()
        is_weekend = today_date_obj.weekday() in [4, 5]
        holidays_today = get_egyptian_holidays(today_date_obj.year)
        is_holiday = today in holidays_today
        
        absent_today = 0
        if not is_weekend and not is_holiday:
            active_emps = list(employees_col().find({
                "is_active": True,
                "employee_id": {"$ne": "EMP-7777"},
                "email": {"$ne": "ceo@xqpharma.com"},
                "job_title": {"$ne": "الرئيس التنفيذي"}
            }))
            today_records_map = {r["employee_id"]: r for r in today_records}
            
            for emp in active_emps:
                emp_id = emp["employee_id"]
                if emp_id in today_records_map:
                    if today_records_map[emp_id].get("status") == "absent":
                        absent_today += 1
                else:
                    absent_today += 1

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
                    "employee_id": {"$ne": "EMP-7777"},
                    "status": {"$in": ["on_time", "late", "excused"]}
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
        
        # Calculate actual absent days dynamically (matching calendar exactly)
        absent_days = calculate_calendar_absent_days(emp_id, month_str)

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

