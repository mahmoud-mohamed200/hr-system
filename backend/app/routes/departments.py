# app/routes/departments.py
"""Department management endpoints — CRUD operations."""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from app.database import departments_col, employees_col
from app.auth import get_current_user, require_role
from app.models.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentListResponse
from bson import ObjectId

router = APIRouter(prefix="/api/departments", tags=["Departments"])


def _department_to_response(dept: dict) -> DepartmentResponse:
    """Convert a MongoDB department document to a response model."""
    return DepartmentResponse(
        id=str(dept["_id"]),
        name=dept["name"],
        description=dept.get("description"),
        manager_name=dept.get("manager_name"),
        employee_count=dept.get("employee_count", 0),
    )


@router.get("", response_model=DepartmentListResponse)
def list_departments(
    current_user: dict = Depends(get_current_user),
):
    """List all departments."""
    cursor = departments_col().find().sort("name", 1)
    depts = [_department_to_response(d) for d in cursor]
    return DepartmentListResponse(departments=depts, total=len(depts))


@router.get("/{id_or_name}", response_model=DepartmentResponse)
def get_department(
    id_or_name: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single department by ID or name."""
    dept = departments_col().find_one({"name": id_or_name})
    if not dept:
        try:
            dept = departments_col().find_one({"_id": ObjectId(id_or_name)})
        except Exception:
            pass
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return _department_to_response(dept)


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    department: DepartmentCreate,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Create a new department."""
    if departments_col().find_one({"name": department.name}):
        raise HTTPException(
            status_code=400, detail=f"Department with name '{department.name}' already exists"
        )

    doc = {
        "name": department.name,
        "description": department.description,
        "manager_name": department.manager_name,
        "employee_count": 0,
    }
    result = departments_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _department_to_response(doc)


@router.put("/{id_or_name}", response_model=DepartmentResponse)
def update_department(
    id_or_name: str,
    updates: DepartmentUpdate,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Update a department."""
    dept = departments_col().find_one({"name": id_or_name})
    if not dept:
        try:
            dept = departments_col().find_one({"_id": ObjectId(id_or_name)})
        except Exception:
            pass
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If renaming, update employees in this department as well
    if "name" in update_data and update_data["name"] != dept["name"]:
        # Verify new name doesn't exist
        if departments_col().find_one({"name": update_data["name"]}):
            raise HTTPException(
                status_code=400,
                detail=f"Department with name '{update_data['name']}' already exists",
            )
        employees_col().update_many({"department": dept["name"]}, {"$set": {"department": update_data["name"]}})

    departments_col().update_one({"_id": dept["_id"]}, {"$set": update_data})
    updated = departments_col().find_one({"_id": dept["_id"]})
    return _department_to_response(updated)


@router.delete("/{id}")
def delete_department(
    id: str,
    current_user: dict = Depends(require_role("admin")),
):
    """Delete a department. Only allowed if it has 0 employees."""
    try:
        dept_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid department ID")

    dept = departments_col().find_one({"_id": dept_id})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if dept.get("employee_count", 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete department with active employees. Reassign employees first.",
        )

    departments_col().delete_one({"_id": dept_id})
    return {"message": f"Department '{dept['name']}' deleted successfully"}
