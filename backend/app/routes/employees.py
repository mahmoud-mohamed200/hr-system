# app/routes/employees.py
"""Employee management endpoints — full CRUD with photo upload."""

import os
import uuid
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, Query
from typing import Optional, List
from pydantic import BaseModel
from app.database import employees_col, users_col, departments_col, attendance_col
from app.auth import get_current_user, require_role, hash_password
from app.models.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListResponse
from app.config import settings
from bson import ObjectId

router = APIRouter(prefix="/api/employees", tags=["Employees"])


def _generate_employee_id() -> str:
    """Generate a unique employee ID like EMP-0001."""
    last = employees_col().find_one(sort=[("employee_id", -1)])
    if last and last.get("employee_id", "").startswith("EMP-"):
        try:
            num = int(last["employee_id"].split("-")[1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"EMP-{num:04d}"


from app.services.encryption import encrypt_data, decrypt_data, decrypt_float

def _employee_to_response(emp: dict) -> EmployeeResponse:
    """Convert a MongoDB employee document to a response model."""
    decrypted_national_id = decrypt_data(emp.get("national_id"))
    decrypted_salary = decrypt_float(emp.get("salary"))

    return EmployeeResponse(
        id=str(emp["_id"]),
        employee_id=emp["employee_id"],
        name=emp["name"],
        email=emp["email"],
        phone=emp.get("phone"),
        department=emp.get("department", ""),
        job_title=emp.get("job_title", ""),
        national_id=decrypted_national_id,
        hire_date=emp.get("hire_date"),
        contract_end_date=emp.get("contract_end_date"),
        salary=decrypted_salary,
        address=emp.get("address"),
        emergency_contact=emp.get("emergency_contact"),
        photo_url=emp.get("photo_url"),
        is_active=emp.get("is_active", True),
        two_factor_enabled=emp.get("two_factor_enabled", False),
        documents=emp.get("documents", []),
        career_path=emp.get("career_path", []),
        penalties=emp.get("penalties", []),
        created_at=emp.get("created_at"),
    )


@router.get("/alerts")
def get_contract_alerts(current_user: dict = Depends(require_role("admin", "hr"))):
    """List employees whose contract expires in less than 30 days. Admin/HR only."""
    from datetime import datetime
    now_dt = datetime.now()
    alerts = []
    employees = list(employees_col().find({"is_active": True, "contract_end_date": {"$ne": None}}))
    
    for emp in employees:
        try:
            end_date = datetime.strptime(emp["contract_end_date"], "%Y-%m-%d")
            days_left = (end_date - now_dt).days
            if 0 <= days_left <= 30:
                alerts.append({
                    "employee_id": emp["employee_id"],
                    "name": emp["name"],
                    "department": emp.get("department", ""),
                    "contract_end_date": emp["contract_end_date"],
                    "days_left": days_left
                })
        except Exception:
            pass
            
    return alerts


@router.get("", response_model=EmployeeListResponse)
def list_employees(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
):
    """List employees with pagination, search, and filters."""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"employee_id": {"$regex": search, "$options": "i"}},
        ]
    if department:
        query["department"] = department
    if is_active is not None:
        query["is_active"] = is_active

    total = employees_col().count_documents(query)
    skip = (page - 1) * per_page
    cursor = employees_col().find(query).sort("name", 1).skip(skip).limit(per_page)

    employees = [_employee_to_response(emp) for emp in cursor]

    return EmployeeListResponse(
        employees=employees, total=total, page=page, per_page=per_page
    )


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single employee by employee_id or MongoDB _id."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        # Try by _id
        try:
            emp = employees_col().find_one({"_id": ObjectId(employee_id)})
        except Exception:
            pass
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _employee_to_response(emp)


@router.post("", response_model=EmployeeResponse)
def create_employee(
    employee: EmployeeCreate,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Create a new employee and optionally a login account."""
    # Check email uniqueness
    if employees_col().find_one({"email": employee.email}):
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم بالفعل")

    emp_id = _generate_employee_id()
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "employee_id": emp_id,
        "name": employee.name,
        "email": employee.email,
        "phone": employee.phone,
        "department": employee.department,
        "job_title": employee.job_title,
        "national_id": encrypt_data(employee.national_id),
        "hire_date": employee.hire_date or now[:10],
        "contract_end_date": employee.contract_end_date,
        "salary": encrypt_data(employee.salary),
        "address": employee.address,
        "emergency_contact": employee.emergency_contact,
        "photo_url": None,
        "is_active": True,
        "two_factor_enabled": False,
        "documents": [],
        "career_path": [],
        "penalties": [],
        "created_at": now,
    }

    result = employees_col().insert_one(doc)
    doc["_id"] = result.inserted_id

    # Update department employee count
    departments_col().update_one(
        {"name": employee.department}, {"$inc": {"employee_count": 1}}
    )

    # Auto-create a login account for the employee
    if not users_col().find_one({"email": employee.email}):
        users_col().insert_one({
            "email": employee.email,
            "password_hash": hash_password("changeme123"),  # Default password
            "role": "employee",
            "employee_id": emp_id,
        })

    return _employee_to_response(doc)


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: str,
    updates: EmployeeUpdate,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Update an employee's information."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Protect CEO: Only the CEO themselves (role == "ceo") can modify the CEO's profile!
    if employee_id == "EMP-7777" or emp.get("job_title") == "الرئيس التنفيذي" or emp.get("email") == "ceo@xqpharma.com":
        if current_user.get("role") != "ceo":
            raise HTTPException(
                status_code=403,
                detail="غير مسموح لغير الرئيس التنفيذي بتعديل بيانات هذا الحساب"
            )

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Safety lock on deactivation: check active assets (Exit Clearance / مخالصة)
    if "is_active" in update_data and update_data["is_active"] is False:
        from app.database import assets_col
        assigned_assets = list(assets_col().find({"employee_id": employee_id}))
        if assigned_assets:
            raise HTTPException(
                status_code=400,
                detail=f"لا يمكن إيقاف نشاط الموظف قبل تسليم العُهد النشطة لديه: {', '.join(a['name'] for a in assigned_assets)}"
            )

    # Transparently encrypt updated fields
    if "national_id" in update_data:
        update_data["national_id"] = encrypt_data(update_data["national_id"])
    if "salary" in update_data:
        update_data["salary"] = encrypt_data(update_data["salary"])

    # Handle department change — update counts
    if "department" in update_data and update_data["department"] != emp.get("department"):
        departments_col().update_one(
            {"name": emp.get("department")}, {"$inc": {"employee_count": -1}}
        )
        departments_col().update_one(
            {"name": update_data["department"]}, {"$inc": {"employee_count": 1}}
        )

    employees_col().update_one({"employee_id": employee_id}, {"$set": update_data})
    updated = employees_col().find_one({"employee_id": employee_id})
    return _employee_to_response(updated)


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    current_user: dict = Depends(require_role("admin")),
):
    """Delete an employee and their login account. Admin only."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Protect CEO: Block deletion of the CEO's profile completely!
    if employee_id == "EMP-7777" or emp.get("job_title") == "الرئيس التنفيذي" or emp.get("email") == "ceo@xqpharma.com":
        raise HTTPException(
            status_code=403,
            detail="غير مسموح بحذف حساب الرئيس التنفيذي نهائياً"
        )

    # Safety lock on deletion: check active assets (Exit Clearance / مخالصة)
    from app.database import assets_col
    assigned_assets = list(assets_col().find({"employee_id": employee_id}))
    if assigned_assets:
        raise HTTPException(
            status_code=400,
            detail=f"لا يمكن حذف الموظف لوجود عُهد نشطة لديه. يرجى تسليم العُهد أولاً: {', '.join(a['name'] for a in assigned_assets)}"
        )

    # Remove user account
    users_col().delete_one({"employee_id": employee_id})

    # Update department count
    departments_col().update_one(
        {"name": emp.get("department")}, {"$inc": {"employee_count": -1}}
    )

    # Delete employee
    employees_col().delete_one({"employee_id": employee_id})

    # Delete attendance records
    attendance_col().delete_many({"employee_id": employee_id})

    # Clean up associated transaction records (leaves, loans, advances, payrolls)
    from app.database import leaves_col, loans_col, advances_col, payrolls_col
    leaves_col().delete_many({"employee_id": employee_id})
    loans_col().delete_many({"employee_id": employee_id})
    advances_col().delete_many({"employee_id": employee_id})
    payrolls_col().delete_many({"employee_id": employee_id})

    # Remove face images
    face_dir = os.path.join(settings.FACES_DIR, emp["email"])
    if os.path.exists(face_dir):
        shutil.rmtree(face_dir)

    return {"message": f"Employee {employee_id} deleted successfully"}


class CareerPathItem(BaseModel):
    title: str
    department: str
    start_date: str
    end_date: Optional[str] = None
    notes: Optional[str] = None


class PenaltyItem(BaseModel):
    type: str
    amount: float
    date: str
    notes: Optional[str] = None


@router.post("/{employee_id}/documents", response_model=EmployeeResponse)
async def upload_document(
    employee_id: str,
    name: str = Form(...),
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Upload scanner hiring documents to employee profile. Admin/HR only."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Save file
    ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    doc_id = str(uuid.uuid4())[:8]
    filename = f"{employee_id}_doc_{doc_id}.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    doc_url = f"/uploads/{filename}"
    doc_entry = {
        "doc_id": doc_id,
        "name": name,
        "type": doc_type,
        "file_url": doc_url,
        "upload_date": datetime.now(timezone.utc).isoformat()[:10]
    }

    employees_col().update_one(
        {"employee_id": employee_id},
        {"$push": {"documents": doc_entry}}
    )

    updated = employees_col().find_one({"employee_id": employee_id})
    return _employee_to_response(updated)


@router.post("/{employee_id}/career-path", response_model=EmployeeResponse)
def add_career_path(
    employee_id: str,
    data: CareerPathItem,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Log career progression / promotion. Admin/HR only."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    career_entry = {
        "title": data.title,
        "department": data.department,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "notes": data.notes
    }

    employees_col().update_one(
        {"employee_id": employee_id},
        {"$push": {"career_path": career_entry}}
    )

    updated = employees_col().find_one({"employee_id": employee_id})
    return _employee_to_response(updated)


@router.post("/{employee_id}/penalties", response_model=EmployeeResponse)
def add_penalty(
    employee_id: str,
    data: PenaltyItem,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Log administrative penalties (forces payroll deduction). Admin/HR only."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    penalty_entry = {
        "penalty_id": str(uuid.uuid4())[:8],
        "type": data.type,
        "amount": data.amount,
        "date": data.date,
        "notes": data.notes
    }

    employees_col().update_one(
        {"employee_id": employee_id},
        {"$push": {"penalties": penalty_entry}}
    )

    updated = employees_col().find_one({"employee_id": employee_id})
    return _employee_to_response(updated)


@router.post("/{employee_id}/photo")
async def upload_photo(
    employee_id: str,
    photo: UploadFile = File(...),
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Upload a profile photo for an employee."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Save file
    ext = photo.filename.split(".")[-1] if "." in photo.filename else "jpg"
    filename = f"{employee_id}_profile.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = await photo.read()
        f.write(content)

    photo_url = f"/uploads/{filename}"
    employees_col().update_one(
        {"employee_id": employee_id}, {"$set": {"photo_url": photo_url}}
    )

    return {"photo_url": photo_url}


@router.post("/{employee_id}/face-photos")
async def upload_face_photos(
    employee_id: str,
    photos: List[UploadFile] = File(...),
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Upload face recognition photos for an employee."""
    emp = employees_col().find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Save to faces directory
    face_dir = os.path.join(settings.FACES_DIR, emp["email"])
    os.makedirs(face_dir, exist_ok=True)

    saved = []
    for photo in photos:
        ext = photo.filename.split(".")[-1] if "." in photo.filename else "jpg"
        filename = f"{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(face_dir, filename)
        with open(filepath, "wb") as f:
            content = await photo.read()
            f.write(content)
        saved.append(filename)

    return {
        "message": f"Uploaded {len(saved)} face photos for {emp['name']}",
        "files": saved,
    }
