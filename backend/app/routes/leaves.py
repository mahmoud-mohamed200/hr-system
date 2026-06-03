# app/routes/leaves.py
"""Leave and permission request endpoints."""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime, timezone
from app.database import leaves_col, employees_col
from app.auth import get_current_user, require_role
from app.models.leave import LeaveCreate, LeaveResponse, LeaveUpdateStatus
from bson import ObjectId

router = APIRouter(prefix="/api/leaves", tags=["Leaves"])


def _leave_to_response(doc: dict) -> LeaveResponse:
    return LeaveResponse(
        id=str(doc["_id"]),
        employee_id=doc["employee_id"],
        employee_name=doc.get("employee_name", ""),
        department=doc.get("department", ""),
        leave_type=doc["leave_type"],
        start_date=doc["start_date"],
        end_date=doc["end_date"],
        reason=doc["reason"],
        duration_hours=doc.get("duration_hours"),
        status=doc["status"],
        created_at=doc["created_at"],
        approved_by=doc.get("approved_by"),
    )


@router.post("", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def request_leave(
    data: LeaveCreate,
    current_user: dict = Depends(get_current_user),
):
    """Submit a new leave or permission request."""
    # Find employee profile
    emp = employees_col().find_one({"employee_id": current_user["employee_id"]})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    # Enforce hourly permission limit per month (Egyptian custom)
    if data.leave_type == "permission":
        if not data.duration_hours or data.duration_hours <= 0:
            raise HTTPException(status_code=400, detail="يجب تحديد عدد الساعات للأذن")
        
        # Get start month (YYYY-MM)
        start_month = data.start_date[:7]
        
        # Query approved permission requests in this month
        query = {
            "employee_id": current_user["employee_id"],
            "leave_type": "permission",
            "status": "approved",
            "start_date": {"$regex": f"^{start_month}"}
        }
        approved_leaves = list(leaves_col().find(query))
        used_hours = sum(l.get("duration_hours" or 0) for l in approved_leaves)
        
        from app.config import settings
        if used_hours + data.duration_hours > settings.MONTHLY_PERMISSION_LIMIT_HOURS:
            raise HTTPException(
                status_code=400, 
                detail=f"لقد تجاوزت الحد الأقصى للأذونات هذا الشهر. المتبقي لك: {settings.MONTHLY_PERMISSION_LIMIT_HOURS - used_hours:.1f} ساعة من أصل {settings.MONTHLY_PERMISSION_LIMIT_HOURS} ساعات شهرياً."
            )

    doc = {
        "employee_id": current_user["employee_id"],
        "employee_name": emp["name"],
        "department": emp.get("department", ""),
        "leave_type": data.leave_type.value if hasattr(data.leave_type, "value") else data.leave_type,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "reason": data.reason,
        "duration_hours": data.duration_hours,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": None
    }
    
    result = leaves_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _leave_to_response(doc)


@router.get("")
def list_leaves(
    current_user: dict = Depends(get_current_user),
):
    """List leave requests. Employees see only their own; Admins/HR see all."""
    if current_user["role"] in ["admin", "hr"]:
        cursor = leaves_col().find().sort("created_at", -1)
    else:
        cursor = leaves_col().find({"employee_id": current_user["employee_id"]}).sort("created_at", -1)
        
    return [_leave_to_response(d) for d in cursor]


from datetime import datetime, timedelta
from app.database import attendance_col

def _adjust_attendance_for_leave(leave: dict):
    """Automatically update/create attendance records to cancel late/absent marks for approved leave/mission/permission."""
    emp_id = leave["employee_id"]
    leave_type = leave["leave_type"]
    start_str = leave["start_date"]
    end_str = leave["end_date"]
    
    # Parse dates
    start_date = datetime.strptime(start_str, "%Y-%m-%d")
    end_date = datetime.strptime(end_str, "%Y-%m-%d")
    
    delta = end_date - start_date
    dates_to_update = [
        (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        for i in range(delta.days + 1)
    ]
    
    # Map leave types to attendance status
    # In either case, we cancel lateness or absence by marking the attendance record with a positive status
    status_map = {
        "permission": "on_time", # Or permission
        "mission": "on_time", # Or mission
        "annual": "leave",
        "sick": "leave",
        "casual": "leave"
    }
    
    target_status = status_map.get(leave_type, "on_time")
    
    for date_str in dates_to_update:
        existing = attendance_col().find_one({"employee_id": emp_id, "date": date_str})
        
        # If hourly permission, we adjust the existing late or absent record to 'on_time' (or permission)
        if leave_type == "permission":
            if existing:
                attendance_col().update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "status": "on_time", # Cancel late/absent
                        "notes": f"{existing.get('notes') or ''} (تم إلغاء التأخير بموجب إذن غياب معتمد: {leave['reason']})".strip()
                    }}
                )
            else:
                # If they didn't check in at all, create an excused record
                attendance_col().insert_one({
                    "employee_id": emp_id,
                    "employee_name": leave["employee_name"],
                    "department": leave.get("department", ""),
                    "job_title": "", # will be filled dynamically on display or query
                    "date": date_str,
                    "check_in": None,
                    "check_out": None,
                    "status": "on_time", # or 'leave'
                    "hours_worked": leave.get("duration_hours") or 0.0,
                    "notes": f"إذن غياب معتمد: {leave['reason']}",
                    "source": "manual"
                })
        else:
            # For full day missions or leaves
            note_str = "مأمورية عمل خارجية معتمدة" if leave_type == "mission" else f"إجازة معتمدة ({leave_type})"
            if existing:
                attendance_col().update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "status": target_status,
                        "notes": f"{existing.get('notes') or ''} ({note_str}: {leave['reason']})".strip()
                    }}
                )
            else:
                # Pre-create attendance record so they aren't marked absent
                attendance_col().insert_one({
                    "employee_id": emp_id,
                    "employee_name": leave["employee_name"],
                    "department": leave.get("department", ""),
                    "job_title": "",
                    "date": date_str,
                    "check_in": None,
                    "check_out": None,
                    "status": target_status,
                    "hours_worked": 8.0, # count as full day
                    "notes": f"{note_str}: {leave['reason']}",
                    "source": "manual"
                })


@router.put("/{leave_id}/status", response_model=LeaveResponse)
def update_leave_status(
    leave_id: str,
    data: LeaveUpdateStatus,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Approve or reject a leave request. Admin/HR only."""
    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid leave request ID")

    leave = leaves_col().find_one({"_id": oid})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leaves_col().update_one(
        {"_id": oid},
        {"$set": {"status": data.status, "approved_by": current_user["email"]}}
    )
    
    updated = leaves_col().find_one({"_id": oid})
    
    # If approved, run attendance adjustment
    if data.status == "approved":
        try:
            _adjust_attendance_for_leave(updated)
        except Exception as e:
            print(f"Error adjusting attendance: {e}")
            # Do not fail request if attendance sync has minor issues
            
    return _leave_to_response(updated)
