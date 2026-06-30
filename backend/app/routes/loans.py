# app/routes/loans.py
"""Endpoints for long-term loan requests and schedule tracking."""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.database import loans_col, employees_col
from app.auth import get_current_user, require_role
from app.models.loan import LoanCreate, LoanResponse, LoanUpdateStatus, LoanInstallment, InstallmentStatus
from app.config import settings
from app.services.email import send_manager_request_notification
from app.services.notifications import create_notification

router = APIRouter(prefix="/api/loans", tags=["Loans"])


def _add_months(sourcedate: datetime, months: int) -> datetime:
    import calendar
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    day = min(sourcedate.day, calendar.monthrange(year, month)[1])
    return datetime(year, month, day)


def _loan_to_response(doc: dict) -> LoanResponse:
    # Calculate derived fields
    payments = doc.get("payments", [])
    remaining_installments = sum(1 for p in payments if p.get("status") == "pending")
    remaining_amount = sum(p.get("amount") for p in payments if p.get("status") == "pending")
    
    return LoanResponse(
        id=str(doc["_id"]),
        employee_id=doc["employee_id"],
        employee_name=doc.get("employee_name", ""),
        department=doc.get("department", ""),
        amount=doc["amount"],
        installments_count=doc["installments_count"],
        monthly_payment=doc["monthly_payment"],
        remaining_installments=remaining_installments,
        remaining_amount=remaining_amount,
        status=doc["status"],
        reason=doc["reason"],
        start_month=doc["start_month"],
        payments=[
            LoanInstallment(
                month=p["month"],
                amount=p["amount"],
                status=p["status"]
            ) for p in payments
        ],
        created_at=doc["created_at"],
        approved_by=doc.get("approved_by"),
    )


@router.post("", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
def request_loan(
    data: LoanCreate,
    current_user: dict = Depends(get_current_user),
):
    """Submit a request for a long-term loan (قرض طويل الأجل)."""
    emp = employees_col().find_one({"employee_id": current_user["employee_id"]})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    monthly_payment = round(data.amount / data.installments_count, 2)
    
    doc = {
        "employee_id": current_user["employee_id"],
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "amount": data.amount,
        "installments_count": data.installments_count,
        "monthly_payment": monthly_payment,
        "status": "pending",
        "reason": data.reason,
        "start_month": data.start_month,
        "payments": [],  # Filled upon approval
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": None
    }
    
    result = loans_col().insert_one(doc)
    doc["_id"] = result.inserted_id

    # Trigger Notifications (Email & In-app)
    try:
        review_link = f"{settings.FRONTEND_URL}/loans"
        request_type_display = "Long-term Loan (قرض طويل الأجل)"
        date_str = doc["created_at"][:10]
        send_manager_request_notification(
            employee_name=doc["employee_name"],
            request_type=request_type_display,
            date_of_request=date_str,
            review_link=review_link
        )
        # Admin notification
        create_notification(
            recipient_role="admin",
            title="طلب قرض جديد",
            message=f"قام الموظف {doc['employee_name']} بتقديم طلب قرض طويل الأجل بقيمة {doc['amount']} ج.م بتاريخ {date_str}.",
            request_type="loan",
            request_id=str(doc["_id"])
        )
        # Employee notification
        create_notification(
            recipient_id=doc["employee_id"],
            title="تم تقديم طلب القرض",
            message=f"تم تقديم طلب قرض بقيمة {doc['amount']} ج.م بنجاح وهو قيد المراجعة حالياً.",
            request_type="loan",
            request_id=str(doc["_id"])
        )
    except Exception as n_err:
        print(f"Error sending notifications for loan request: {n_err}")

    return _loan_to_response(doc)


@router.get("", response_model=List[LoanResponse])
def list_loans(
    current_user: dict = Depends(get_current_user),
):
    """List loan requests. Employees see theirs; Admin/HR/CEO see all."""
    if current_user["role"] in ["admin", "hr", "ceo"]:
        cursor = loans_col().find().sort("created_at", -1)
    else:
        cursor = loans_col().find({"employee_id": current_user["employee_id"]}).sort("created_at", -1)
        
    return [_loan_to_response(d) for d in cursor]


@router.put("/{loan_id}/status", response_model=LoanResponse)
def update_loan_status(
    loan_id: str,
    data: LoanUpdateStatus,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Approve or reject a loan request. Generates monthly schedule if approved. Admin/HR only."""
    try:
        oid = ObjectId(loan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid loan ID")

    loan = loans_col().find_one({"_id": oid})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan request not found")

    updates = {
        "status": data.status,
        "approved_by": current_user["email"]
    }

    if data.status == "approved" and not loan.get("payments"):
        # Generate the installments schedule month by month
        payments = []
        start_date = datetime.strptime(f"{loan['start_month']}-01", "%Y-%m-%d")
        monthly_val = round(loan["amount"] / loan["installments_count"], 2)
        
        for i in range(loan["installments_count"]):
            inst_date = _add_months(start_date, i)
            inst_month_str = inst_date.strftime("%Y-%m")
            payments.append({
                "month": inst_month_str,
                "amount": monthly_val,
                "status": "pending"
            })
            
        updates["payments"] = payments

    loans_col().update_one({"_id": oid}, {"$set": updates})
    updated = loans_col().find_one({"_id": oid})

    # Trigger Status Update Notification (In-app)
    try:
        status_text = "مقبول" if data.status == "approved" else "مرفوض" if data.status == "rejected" else data.status
        create_notification(
            recipient_id=updated["employee_id"],
            title="تحديث حالة طلب القرض",
            message=f"تم {status_text} طلب القرض بقيمة {updated['amount']} ج.م الخاص بك بواسطة {current_user['email']}.",
            request_type="loan",
            request_id=str(updated["_id"])
        )
    except Exception as n_err:
        print(f"Error creating status update notification: {n_err}")

    return _loan_to_response(updated)


@router.delete("/{loan_id}", status_code=status.HTTP_200_OK)
def delete_loan_request(
    loan_id: str,
    current_user: dict = Depends(require_role("admin")),
):
    """Delete a loan request. Admin only."""
    try:
        oid = ObjectId(loan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid loan ID")

    loan = loans_col().find_one({"_id": oid})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan request not found")

    loans_col().delete_one({"_id": oid})
    return {"message": "Loan request deleted successfully"}

