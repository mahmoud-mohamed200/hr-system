# app/services/notifications.py
"""In-app notifications manager."""

from typing import Optional
from datetime import datetime, timezone
from app.database import notifications_col


def create_notification(
    recipient_id: Optional[str] = None,
    recipient_role: Optional[str] = None,
    title: str = "",
    message: str = "",
    request_type: str = "",
    request_id: str = ""
):
    """
    Creates an in-app notification in MongoDB.
    Either recipient_id (specific employee) or recipient_role (e.g. "admin" for all managers) must be provided.
    """
    doc = {
        "recipient_id": recipient_id,
        "recipient_role": recipient_role,
        "title": title,
        "message": message,
        "request_type": request_type,
        "request_id": request_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    try:
        notifications_col().insert_one(doc)
        print(f"🔔 [NOTIFICATION CREATED] Title: '{title}', Recipient ID: '{recipient_id}', Role: '{recipient_role}'")
    except Exception as e:
        print(f"❌ [NOTIFICATION ERROR] Failed to create notification: {e}")
