# app/routes/assets.py
"""Endpoints for asset inventory and assignment tracking."""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.database import assets_col, employees_col
from app.auth import get_current_user, require_role
from app.models.asset import AssetCreate, AssetResponse, AssetAssign, AssetStatus

router = APIRouter(prefix="/api/assets", tags=["Assets"])


def _asset_to_response(doc: dict) -> AssetResponse:
    return AssetResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        serial_number=doc["serial_number"],
        type=doc["type"],
        employee_id=doc.get("employee_id"),
        employee_name=doc.get("employee_name"),
        status=doc.get("status", AssetStatus.AVAILABLE),
        assigned_date=doc.get("assigned_date"),
    )


@router.get("", response_model=List[AssetResponse])
def list_assets(
    current_user: dict = Depends(get_current_user),
):
    """List all assets. Employees see only assets assigned to them, HR/Admin see all."""
    if current_user["role"] in ["admin", "hr", "ceo"]:
        cursor = assets_col().find().sort("name", 1)
    else:
        cursor = assets_col().find({"employee_id": current_user["employee_id"]})
        
    return [_asset_to_response(d) for d in cursor]


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    data: AssetCreate,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Create a new asset. Admin/HR only."""
    # Check serial number uniqueness
    if assets_col().find_one({"serial_number": data.serial_number}):
        raise HTTPException(status_code=400, detail="الرقم التسلسلي للأصل مسجل بالفعل")

    emp_name = None
    status_val = "available"
    assigned_date = None
    
    if data.employee_id:
        emp = employees_col().find_one({"employee_id": data.employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="الموظف المختار غير موجود")
        emp_name = emp["name"]
        status_val = "assigned"
        assigned_date = datetime.now(timezone.utc).isoformat()[:10]

    doc = {
        "name": data.name,
        "serial_number": data.serial_number,
        "type": data.type,
        "employee_id": data.employee_id,
        "employee_name": emp_name,
        "status": status_val,
        "assigned_date": assigned_date
    }
    
    result = assets_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _asset_to_response(doc)


@router.post("/{asset_id}/assign", response_model=AssetResponse)
def assign_asset(
    asset_id: str,
    data: AssetAssign,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Assign an asset to an employee. Admin/HR only."""
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="معرف الأصل غير صحيح")

    asset = assets_col().find_one({"_id": oid})
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    if asset.get("status") == "assigned":
        raise HTTPException(status_code=400, detail="الأصل عهدة بالفعل لموظف آخر")

    emp = employees_col().find_one({"employee_id": data.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    now = datetime.now(timezone.utc).isoformat()
    assets_col().update_one(
        {"_id": oid},
        {"$set": {
            "employee_id": data.employee_id,
            "employee_name": emp["name"],
            "status": "assigned",
            "assigned_date": now[:10]
        }}
    )
    
    updated = assets_col().find_one({"_id": oid})
    return _asset_to_response(updated)


@router.post("/{asset_id}/return", response_model=AssetResponse)
def return_asset(
    asset_id: str,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Return an asset to inventory. Admin/HR only."""
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="معرف الأصل غير صحيح")

    asset = assets_col().find_one({"_id": oid})
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")

    assets_col().update_one(
        {"_id": oid},
        {"$set": {
            "employee_id": None,
            "employee_name": None,
            "status": "available",
            "assigned_date": None
        }}
    )
    
    updated = assets_col().find_one({"_id": oid})
    return _asset_to_response(updated)


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: str,
    current_user: dict = Depends(require_role("admin")),
):
    """Delete an asset. Admin only."""
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="معرف الأصل غير صحيح")

    asset = assets_col().find_one({"_id": oid})
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    if asset.get("status") == "assigned":
        raise HTTPException(status_code=400, detail="لا يمكن حذف أصل في عهدة موظف حالياً. يجب استرجاعه أولاً.")

    assets_col().delete_one({"_id": oid})
    return {"message": "تم حذف الأصل بنجاح"}
