# app/routes/advances.py
"""Salary advance request endpoints."""

from fastapi import APIRouter, HTTPException, Depends, status  # pyrefly: ignore [missing-import] 

from typing import List
from datetime import datetime, timezone
from app.database import advances_col, employees_col
from app.auth import get_current_user, require_role
from app.models.advance import AdvanceCreate, AdvanceResponse, AdvanceUpdateStatus
from bson import ObjectId  # pyrefly: ignore [missing-import]
from app.config import settings
from app.services.email import send_manager_request_notification
from app.services.notifications import create_notification

router = APIRouter(prefix="/api/advances", tags=["Advances"])


def _advance_to_response(doc: dict) -> AdvanceResponse:
    return AdvanceResponse(
        id=str(doc["_id"]),
        employee_id=doc["employee_id"],
        employee_name=doc.get("employee_name", ""),
        department=doc.get("department", ""),
        amount=doc["amount"],
        reason=doc["reason"],
        status=doc["status"],
        created_at=doc["created_at"],
        approved_by=doc.get("approved_by"),
    )


@router.post("", response_model=AdvanceResponse, status_code=status.HTTP_201_CREATED)
def request_advance(
    data: AdvanceCreate,
    current_user: dict = Depends(get_current_user),
):
    """Request a salary advance."""
    if current_user.get("role") == "ceo" or current_user.get("employee_id") == "EMP-7777":
        raise HTTPException(status_code=400, detail="الرئيس التنفيذي مستثنى من طلبات السلف")
    emp = employees_col().find_one({"employee_id": current_user["employee_id"]})
    if not emp:
        raise HTTPException(status_code=404, detail="لم يتم العثور على ملف تعريف الموظف")

    from app.services.encryption import decrypt_float
    basic_salary = decrypt_float(emp.get("salary")) or 0.0
    limit = basic_salary * 0.75
    if data.amount > limit:
        raise HTTPException(
            status_code=400,
            detail=f"قيمة السلفة المطلوبة ({data.amount} ج.م) تتجاوز الحد الأقصى المسموح به وهو 75% من الراتب الأساسي ({limit} ج.م)"
        )

    doc = {
        "employee_id": current_user["employee_id"],
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "amount": data.amount,
        "reason": data.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": None
    }
    
    result = advances_col().insert_one(doc)
    doc["_id"] = result.inserted_id

    # Trigger Notifications (Email & In-app)
    try:
        review_link = f"{settings.FRONTEND_URL}/advances"
        request_type_display = "Salary Advance (سلفة راتب)"
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
            title="طلب سلفة راتب جديد",
            message=f"قام الموظف {doc['employee_name']} بتقديم طلب سلفة راتب بقيمة {doc['amount']} ج.م بتاريخ {date_str}.",
            request_type="advance",
            request_id=str(doc["_id"])
        )
        # Employee notification
        create_notification(
            recipient_id=doc["employee_id"],
            title="تم تقديم طلب سلفة الراتب",
            message=f"تم تقديم طلب سلفة راتب بقيمة {doc['amount']} ج.م بنجاح وهو قيد المراجعة حالياً.",
            request_type="advance",
            request_id=str(doc["_id"])
        )
    except Exception as n_err:
        print(f"Error sending notifications for advance request: {n_err}")

    return _advance_to_response(doc)


@router.get("")
def list_advances(
    current_user: dict = Depends(get_current_user),
):
    """List advance requests. Employees see only their own; Admins/HR/CEO see all."""
    if current_user["role"] in ["admin", "hr", "ceo"]:
        cursor = advances_col().find().sort("created_at", -1)
    else:
        cursor = advances_col().find({"employee_id": current_user["employee_id"]}).sort("created_at", -1)
        
    return [_advance_to_response(d) for d in cursor]


@router.put("/{advance_id}/status", response_model=AdvanceResponse)
def update_advance_status(
    advance_id: str,
    data: AdvanceUpdateStatus,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Approve or reject a salary advance. Admin/HR only."""
    try:
        oid = ObjectId(advance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="معرف طلب السلفة غير صحيح")

    adv = advances_col().find_one({"_id": oid})
    if not adv:
        raise HTTPException(status_code=404, detail="طلب السلفة غير موجود")

    advances_col().update_one(
        {"_id": oid},
        {"$set": {"status": data.status, "approved_by": current_user["email"]}}
    )
    
    updated = advances_col().find_one({"_id": oid})

    # Trigger Status Update Notification (In-app)
    try:
        status_text = "مقبول" if data.status == "approved" else "مرفوض" if data.status == "rejected" else data.status
        create_notification(
            recipient_id=updated["employee_id"],
            title="تحديث حالة طلب سلفة الراتب",
            message=f"تم {status_text} طلب سلفة الراتب بقيمة {updated['amount']} ج.م الخاص بك بواسطة {current_user['email']}.",
            request_type="advance",
            request_id=str(updated["_id"])
        )
    except Exception as n_err:
        print(f"Error creating status update notification: {n_err}")

    return _advance_to_response(updated)


@router.delete("/{advance_id}", status_code=status.HTTP_200_OK)
def delete_advance_request(
    advance_id: str,
    current_user: dict = Depends(require_role("admin")),
):
    """Delete a salary advance request. Admin only."""
    try:
        oid = ObjectId(advance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="معرف طلب السلفة غير صحيح")

    adv = advances_col().find_one({"_id": oid})
    if not adv:
        raise HTTPException(status_code=404, detail="طلب السلفة غير موجود")

    advances_col().delete_one({"_id": oid})
    return {"message": "تم حذف طلب السلفة بنجاح"}

