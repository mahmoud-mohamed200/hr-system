# app/routes/reports.py
"""Reports and analytics endpoints."""

from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
from typing import Optional
from app.database import attendance_col, employees_col
from app.auth import get_current_user, require_role
from bson import ObjectId

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/daily")
def get_daily_report(
    date: Optional[str] = Query(None),
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Generate daily attendance report."""
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    records = list(attendance_col().find({"date": date, "employee_id": {"$ne": "EMP-7777"}}))
    total_employees = employees_col().count_documents({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    })

    present = len(records)
    late = sum(1 for r in records if r.get("status") == "late")
    on_time = sum(1 for r in records if r.get("status") == "on_time")
    absent = max(0, total_employees - present)

    detailed_records = []
    for r in records:
        detailed_records.append({
            "id": str(r["_id"]),
            "employee_id": r["employee_id"],
            "name": r.get("employee_name", ""),
            "department": r.get("department", ""),
            "job_title": r.get("job_title", ""),
            "check_in": r.get("check_in"),
            "check_out": r.get("check_out"),
            "status": r.get("status"),
            "hours_worked": r.get("hours_worked"),
        })

    return {
        "date": date,
        "summary": {
            "total_employees": total_employees,
            "present": present,
            "absent": absent,
            "late": late,
            "on_time": on_time
        },
        "records": detailed_records
    }


@router.get("/weekly")
def get_weekly_report(
    start_date: Optional[str] = Query(None),
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Generate weekly attendance report."""
    if not start_date:
        # Default to 7 days ago
        start = datetime.now() - timedelta(days=6)
    else:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    dates = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    total_employees = employees_col().count_documents({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    })

    daily_stats = []
    for d in dates:
        records = list(attendance_col().find({"date": d, "employee_id": {"$ne": "EMP-7777"}}))
        present = len(records)
        late = sum(1 for r in records if r.get("status") == "late")
        daily_stats.append({
            "date": d,
            "present": present,
            "absent": max(0, total_employees - present),
            "late": late
        })

    return {
        "start_date": dates[0],
        "end_date": dates[-1],
        "daily_stats": daily_stats
    }


@router.get("/monthly")
def get_monthly_report(
    month: Optional[str] = Query(None), # Format YYYY-MM
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Generate monthly attendance report."""
    if not month:
        month = datetime.now().strftime("%Y-%m")

    # Fetch all records for the month
    records = list(attendance_col().find({"date": {"$regex": f"^{month}"}, "employee_id": {"$ne": "EMP-7777"}}))
    total_employees = employees_col().count_documents({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    })

    # Group by date
    days_data = {}
    for r in records:
        d = r["date"]
        if d not in days_data:
            days_data[d] = {"present": 0, "late": 0, "on_time": 0}
        days_data[d]["present"] += 1
        if r.get("status") == "late":
            days_data[d]["late"] += 1
        elif r.get("status") == "on_time":
            days_data[d]["on_time"] += 1

    chart_data = []
    for d in sorted(days_data.keys()):
        chart_data.append({
            "date": d,
            "present": days_data[d]["present"],
            "absent": max(0, total_employees - days_data[d]["present"]),
            "late": days_data[d]["late"],
            "on_time": days_data[d]["on_time"]
        })

    return {
        "month": month,
        "total_records": len(records),
        "chart_data": chart_data
    }


@router.get("/employee/{employee_id}")
def get_employee_report(
    employee_id: str,
    month: Optional[str] = Query(None), # Format YYYY-MM
    current_user: dict = Depends(get_current_user),
):
    """Generate individual report for an employee."""
    # Check authorization (non-admins can only see their own report)
    if current_user.get("role") == "employee" and current_user.get("employee_id") != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized to view other employees' reports")

    if employee_id == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من نظام الحضور والانصراف")
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not month:
        month = datetime.now().strftime("%Y-%m")

    query = {
        "employee_id": employee_id,
        "date": {"$regex": f"^{month}"}
    }
    records = list(attendance_col().find(query).sort("date", 1))

    present_count = len(records)
    late_count = sum(1 for r in records if r.get("status") == "late")
    on_time_count = sum(1 for r in records if r.get("status") == "on_time")
    total_hours = sum(r.get("hours_worked") or 0.0 for r in records)

    detailed_records = []
    for r in records:
        detailed_records.append({
            "date": r["date"],
            "check_in": r.get("check_in"),
            "check_out": r.get("check_out"),
            "status": r.get("status"),
            "hours_worked": r.get("hours_worked"),
            "notes": r.get("notes")
        })

    return {
        "employee_id": employee_id,
        "name": emp["name"],
        "department": emp.get("department", ""),
        "job_title": emp.get("job_title", ""),
        "month": month,
        "summary": {
            "present": present_count,
            "late": late_count,
            "on_time": on_time_count,
            "total_hours": round(total_hours, 2),
            "average_hours": round(total_hours / present_count, 2) if present_count > 0 else 0.0
        },
        "records": detailed_records
    }
