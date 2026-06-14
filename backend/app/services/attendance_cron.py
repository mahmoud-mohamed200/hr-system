# app/services/attendance_cron.py
import logging
from datetime import datetime
from app.database import employees_col, attendance_col
from app.config import settings

logger = logging.getLogger(__name__)

def mark_absences_for_today():
    """
    Cron job to mark employees as absent if they have not checked in today.
    Skips weekends and special employees (e.g. CEO).
    """
    logger.info("Running daily auto-absent job...")
    
    # Skip if today is a weekend
    day_name = datetime.now().strftime("%A").lower()
    if day_name in settings.WEEKEND_DAYS:
        logger.info(f"Today is {day_name} (weekend). Skipping auto-absent job.")
        return

    today_str = datetime.now().strftime("%Y-%m-%d")

    # Start calculating officially from July 1st, 2026
    if today_str < "2026-07-01":
        logger.info(f"System is in grace period until July. Skipping auto-absent job for {today_str}.")
        return

    # Fetch all active employees, excluding CEO/special ones
    active_employees = list(employees_col().find({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    }))

    absent_count = 0
    for emp in active_employees:
        emp_id = emp.get("employee_id")
        if not emp_id:
            continue

        # Check if they have an attendance record for today
        existing_record = attendance_col().find_one({
            "employee_id": emp_id,
            "date": today_str
        })

        if not existing_record:
            # Create absent record
            record = {
                "employee_id": emp_id,
                "employee_name": emp.get("name", "Unknown"),
                "department": emp.get("department", ""),
                "job_title": emp.get("job_title", ""),
                "date": today_str,
                "check_in": None,
                "check_out": None,
                "status": "absent",
                "hours_worked": 0,
                "notes": "غياب تلقائي (نهاية اليوم)",
                "source": "system_cron",
            }
            attendance_col().insert_one(record)
            absent_count += 1
        elif existing_record.get("check_in") and not existing_record.get("check_out"):
            # They checked in but didn't check out. Default check-out at 19:00:00.
            check_in_time_str = existing_record["check_in"]
            check_out_time_str = "19:00:00"
            try:
                t_in = datetime.strptime(check_in_time_str, "%H:%M:%S")
                t_out = datetime.strptime(check_out_time_str, "%H:%M:%S")
                diff = (t_out - t_in).total_seconds() / 3600
                hours = round(max(0, diff), 2)
            except ValueError:
                hours = 0.0

            current_notes = existing_record.get("notes") or ""
            new_notes = current_notes + " | تسجيل انصراف تلقائي (19:00)" if current_notes else "تسجيل انصراف تلقائي (19:00)"
            
            attendance_col().update_one(
                {"_id": existing_record["_id"]},
                {
                    "$set": {
                        "check_out": check_out_time_str,
                        "hours_worked": hours,
                        "notes": new_notes
                    }
                }
            )

    logger.info(f"Auto-absent job finished. Marked {absent_count} employees as absent and checked-out the rest at 19:00.")
