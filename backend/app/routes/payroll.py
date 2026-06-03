# app/routes/payroll.py
"""Automated Egyptian Payroll Engine — calculations, approvals, and secure payslips."""

import calendar
from datetime import datetime, date, timezone
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
from app.database import payrolls_col, employees_col, attendance_col, loans_col, advances_col, users_col
from app.auth import get_current_user, require_role, verify_password
from app.services.encryption import encrypt_data, decrypt_data, decrypt_float
from app.config import settings

router = APIRouter(prefix="/api/payroll", tags=["Payroll"])


class VerifyPayslipPassword(BaseModel):
    password: str


def _get_workdays_in_month(month_str: str) -> List[str]:
    """Get list of YYYY-MM-DD dates in a month, excluding weekend days (default: Friday)."""
    try:
        year, month = map(int, month_str.split("-"))
        num_days = calendar.monthrange(year, month)[1]
        workdays = []
        for day in range(1, num_days + 1):
            d = date(year, month, day)
            day_name = d.strftime("%A").lower()
            if day_name not in settings.WEEKEND_DAYS:
                workdays.append(d.strftime("%Y-%m-%d"))
        return workdays
    except ValueError:
        return []


def _calculate_employee_payroll(emp: dict, month: str) -> dict:
    """Calculate payroll metrics for an employee in a given month (Egyptian labor rules)."""
    emp_id = emp["employee_id"]
    
    # Decrypt salary
    basic_salary = decrypt_float(emp.get("salary")) or 0.0
    allowances = round(basic_salary * 0.10, 2)  # default 10% allowance
    
    # Query attendance records for the month
    attendance_records = list(attendance_col().find({
        "employee_id": emp_id,
        "date": {"$regex": f"^{month}"}
    }))
    
    # 1. Overtime Calculation (hours exceeding 8 per day, paid at 1.5x hourly rate)
    overtime_hours = 0.0
    lateness_minutes = 0.0
    checked_in_dates = set()
    
    for r in attendance_records:
        checked_in_dates.add(r["date"])
        # Daily overtime
        hw = r.get("hours_worked") or 0.0
        if hw > 8.0:
            overtime_hours += (hw - 8.0)
            
        # Lateness minutes
        if r.get("status") == "late" and r.get("check_in"):
            try:
                # Calculate late duration against work start
                t_start = datetime.strptime(settings.WORK_START, "%H:%M")
                t_check = datetime.strptime(r["check_in"][:5], "%H:%M")
                diff = (t_check - t_start).total_seconds() / 60
                if diff > settings.LATE_THRESHOLD_MINUTES:
                    lateness_minutes += diff
            except Exception:
                # Fallback to general late penalty minutes
                lateness_minutes += 30
                
    hourly_rate = basic_salary / 240.0 if basic_salary > 0 else 0.0
    overtime_pay = round(overtime_hours * hourly_rate * 1.5, 2)
    
    # Lateness deduction (EGP 2 per minute late or 0.5x hourly rate equivalent)
    deductions_lateness = round((lateness_minutes / 60.0) * hourly_rate * 0.5, 2)
    
    # Gross Salary
    gross_salary = basic_salary + allowances + overtime_pay
    
    # 2. Egyptian Deductions: Insurance & Taxes
    # Insurance: 11% of basic salary
    deductions_insurance = round(basic_salary * 0.11, 2)
    # Taxes: 10% of gross salary (simplified Egyptian bracket)
    deductions_taxes = round(gross_salary * 0.10, 2)
    
    # 3. Unjustified Absence Deduction
    # Find active days in month up to today (if current month) or full month
    all_workdays = _get_workdays_in_month(month)
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    absent_days = 0
    for day in all_workdays:
        # If checking current month, don't penalize for future workdays
        if day > today_str:
            continue
        if day not in checked_in_dates:
            absent_days += 1
            
    deductions_unjustified_absence = round(absent_days * (basic_salary / 30.0), 2)
    
    # 4. Loan Installments Deduction
    deductions_loans = 0.0
    active_loan = loans_col().find_one({
        "employee_id": emp_id,
        "status": "approved",
        "payments": {"$elemMatch": {"month": month, "status": "pending"}}
    })
    if active_loan:
        for p in active_loan.get("payments", []):
            if p["month"] == month and p["status"] == "pending":
                deductions_loans = p["amount"]
                break
                
    # 5. Salary Advances Deduction (Temporary advances fully repaid in same month)
    # Fetch approved advances requested in this month
    advances = list(advances_col().find({
        "employee_id": emp_id,
        "status": "approved",
        "created_at": {"$regex": f"^{month}"}
    }))
    deductions_advances = sum(a.get("amount") for a in advances)
    
    # 6. Administrative Penalties (logged under employee details)
    deductions_penalties = 0.0
    for penalty in emp.get("penalties", []):
        if penalty.get("date", "").startswith(month):
            deductions_penalties += penalty.get("amount", 0.0)
            
    # Calculate Net Salary
    net_salary = gross_salary - (
        deductions_insurance + 
        deductions_taxes + 
        deductions_unjustified_absence + 
        deductions_lateness + 
        deductions_loans + 
        deductions_advances + 
        deductions_penalties
    )
    net_salary = max(0.0, round(net_salary, 2))
    
    return {
        "employee_id": emp_id,
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "month": month,
        "basic_salary": basic_salary,
        "allowances": allowances,
        "overtime_hours": overtime_hours,
        "overtime_pay": overtime_pay,
        "deductions_insurance": deductions_insurance,
        "deductions_taxes": deductions_taxes,
        "deductions_unjustified_absence": deductions_unjustified_absence,
        "deductions_lateness": deductions_lateness,
        "deductions_loans": deductions_loans,
        "deductions_advances": deductions_advances,
        "deductions_penalties": deductions_penalties,
        "net_salary": net_salary
    }


@router.get("/calculate")
def calculate_monthly_payroll(
    month: str,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Calculate and preview payroll details for a specific month YYYY-MM. Admin/HR only."""
    if not month or len(month) != 7:
        raise HTTPException(status_code=400, detail="صيغة الشهر غير صحيحة، يجب أن تكون YYYY-MM")

    # Fetch active employees
    employees = list(employees_col().find({"is_active": True}))
    payroll_records = []
    has_approved = False
    has_draft = False
    
    for emp in employees:
        emp_id = emp["employee_id"]
        # Check if this specific employee already has approved payroll
        existing = payrolls_col().find_one({"month": month, "employee_id": emp_id, "status": "approved"})
        if existing:
            rec = {k: v for k, v in existing.items() if k != "_id"}
            payroll_records.append(rec)
            has_approved = True
        else:
            calc = _calculate_employee_payroll(emp, month)
            calc["status"] = "draft"
            payroll_records.append(calc)
            has_draft = True
            
    return {
        "status": "approved" if (has_approved and not has_draft) else "draft",
        "records": payroll_records
    }


@router.post("/approve")
def approve_monthly_payroll(
    month: str,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Approve and lock payroll for a specific month, generating secure payslips. Admin/HR only."""
    if not month or len(month) != 7:
        raise HTTPException(status_code=400, detail="صيغة الشهر غير صحيحة")

    employees = list(employees_col().find({"is_active": True}))
    approved_records = []
    now_str = datetime.now(timezone.utc).isoformat()
    
    for emp in employees:
        calc = _calculate_employee_payroll(emp, month)
        
        # Build secure, encrypted payslip payload
        import json
        payslip_payload = json.dumps(calc)
        encrypted_data = encrypt_data(payslip_payload)
        
        calc["status"] = "approved"
        calc["approved_by"] = current_user["email"]
        calc["approved_at"] = now_str
        calc["encrypted_data"] = encrypted_data
        
        # Save to database
        payrolls_col().update_one(
            {"month": month, "employee_id": calc["employee_id"]},
            {"$set": calc},
            upsert=True
        )
        approved_records.append(calc)
        
        # Programmatic triggers:
        # 1. Update loan installment status to 'paid' if loan was deducted
        if calc["deductions_loans"] > 0:
            loans_col().update_one(
                {
                    "employee_id": calc["employee_id"],
                    "status": "approved",
                    "payments.month": month
                },
                {"$set": {"payments.$.status": "paid"}}
            )
            
    return {"message": f"تم اعتماد وإغلاق رواتب شهر {month} لـ {len(approved_records)} موظف"}


@router.get("/payslips")
def list_employee_payslips(
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List approved payslips for the current employee."""
    query = {"status": "approved"}
    
    # Restrict to own payslips unless Admin/HR
    if current_user["role"] not in ["admin", "hr"]:
        query["employee_id"] = current_user["employee_id"]
        
    if month:
        query["month"] = month
        
    cursor = payrolls_col().find(query).sort("month", -1)
    
    payslips = []
    for doc in cursor:
        emp = employees_col().find_one({"employee_id": doc["employee_id"]})
        job_title = emp.get("job_title", "") if emp else ""
        dept = emp.get("department", "") if emp else ""
        
        payslips.append({
            "id": str(doc["_id"]),
            "employee_id": doc["employee_id"],
            "employee_name": doc["employee_name"],
            "job_title": job_title,
            "department": dept,
            "month": doc["month"],
            "net_salary": doc["net_salary"],
            "encrypted_data": doc.get("encrypted_data", "")
        })
        
    return payslips


@router.post("/payslips/{payslip_id}/decrypt")
def decrypt_payslip(
    payslip_id: str,
    data: VerifyPayslipPassword,
    current_user: dict = Depends(get_current_user),
):
    """Verify password and return decrypted payslip details."""
    try:
        oid = ObjectId(payslip_id)
    except Exception:
        raise HTTPException(status_code=400, detail="معرف مفردات المرتب غير صحيح")

    payroll = payrolls_col().find_one({"_id": oid})
    if not payroll:
        raise HTTPException(status_code=404, detail="مفردات المرتب غير موجودة")
        
    # Check authorization
    if current_user["role"] not in ["admin", "hr"] and payroll["employee_id"] != current_user["employee_id"]:
        raise HTTPException(status_code=403, detail="غير مصرح لك بمشاهدة هذه المفردات")

    # Verify user's password
    user = users_col().find_one({"email": current_user["email"]})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="كلمة المرور غير صحيحة")

    # Decrypt
    encrypted_data = payroll.get("encrypted_data")
    if not encrypted_data:
        raise HTTPException(status_code=400, detail="لم يتم تشفير هذه البيانات")
        
    decrypted_str = decrypt_data(encrypted_data)
    import json
    try:
        decrypted_json = json.loads(decrypted_str)
        return decrypted_json
    except Exception:
        raise HTTPException(status_code=500, detail="فشل فك تشفير البيانات")
