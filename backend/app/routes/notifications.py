# app/routes/notifications.py
"""Endpoints for in-app user notifications."""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.database import notifications_col
from app.auth import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _notif_to_response(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "recipient_id": doc.get("recipient_id"),
        "recipient_role": doc.get("recipient_role"),
        "title": doc.get("title", ""),
        "message": doc.get("message", ""),
        "request_type": doc.get("request_type", ""),
        "request_id": doc.get("request_id", ""),
        "is_read": doc.get("is_read", False),
        "created_at": doc.get("created_at")
    }


@router.get("")
def list_notifications(
    current_user: dict = Depends(get_current_user),
):
    """List notifications for the logged-in user."""
    role = current_user.get("role")
    emp_id = current_user.get("employee_id")

    if role in ["admin", "hr", "ceo"]:
        query = {
            "$or": [
                {"recipient_role": "admin"},
                {"recipient_id": emp_id}
            ]
        }
    else:
        query = {"recipient_id": emp_id}

    cursor = notifications_col().find(query).sort("created_at", -1).limit(50)
    return [_notif_to_response(d) for d in cursor]


@router.put("/read-all")
def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications for the user as read."""
    role = current_user.get("role")
    emp_id = current_user.get("employee_id")

    if role in ["admin", "hr", "ceo"]:
        query = {
            "$or": [
                {"recipient_role": "admin"},
                {"recipient_id": emp_id}
            ],
            "is_read": False
        }
    else:
        query = {"recipient_id": emp_id, "is_read": False}

    notifications_col().update_many(query, {"$set": {"is_read": True}})
    return {"message": "All notifications marked as read"}


@router.put("/{notif_id}/read")
def mark_as_read(
    notif_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    # Find the notification
    notif = notifications_col().find_one({"_id": oid})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Access control: ensure the notification belongs to this user or admin
    role = current_user.get("role")
    emp_id = current_user.get("employee_id")

    is_allowed = False
    if notif.get("recipient_id") == emp_id:
        is_allowed = True
    elif notif.get("recipient_role") == "admin" and role in ["admin", "hr", "ceo"]:
        is_allowed = True

    if not is_allowed:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to access this notification"
        )

    notifications_col().update_one({"_id": oid}, {"$set": {"is_read": True}})
    return {"message": "Notification marked as read"}
