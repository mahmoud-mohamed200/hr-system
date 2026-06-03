# app/routes/auth.py
"""Authentication endpoints — login, register, get current user, and 2FA."""

import random
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.database import users_col, employees_col, otp_col
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_role
from app.models.user import UserLogin, UserCreate, UserResponse, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class TwoFactorVerify(BaseModel):
    email: str
    otp: str


@router.post("/login")
def login(credentials: UserLogin):
    """Authenticate user and return JWT token or request 2FA OTP."""
    user = users_col().find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check if 2FA is enabled for this employee
    two_factor = False
    emp_id = user.get("employee_id")
    emp = None
    if emp_id:
        emp = employees_col().find_one({"employee_id": emp_id})
        if emp and emp.get("two_factor_enabled", False):
            two_factor = True

    if two_factor:
        # Generate 6-digit OTP
        code = f"{random.randint(100000, 999999)}"
        # Store in MongoDB
        otp_col().delete_many({"email": credentials.email})
        otp_col().insert_one({
            "email": credentials.email,
            "code": code,
            "created_at": datetime.now(timezone.utc)
        })
        # Log to terminal for debugging and developer visibility
        print(f"\n🔥 [2FA OTP CODE] for {credentials.email} is: {code}\n")
        return {
            "status": "2fa_required",
            "email": credentials.email,
            # Return code for easy testing in development/mock frontend
            "dev_otp": code
        }

    # Build standard user response with employee info
    user_data = {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "employee_id": emp_id,
        "two_factor_enabled": False
    }

    if emp:
        user_data["name"] = emp.get("name")
        user_data["job_title"] = emp.get("job_title")
        user_data["department"] = emp.get("department")
        user_data["phone"] = emp.get("phone")
        user_data["photo_url"] = emp.get("photo_url")

    token = create_access_token({"sub": user["email"], "role": user["role"]})

    return TokenResponse(
        access_token=token,
        user=UserResponse(**user_data),
    )


@router.post("/verify-2fa", response_model=TokenResponse)
def verify_2fa(data: TwoFactorVerify):
    """Verify 2FA OTP code and return JWT token."""
    record = otp_col().find_one({"email": data.email, "code": data.otp})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز التحقق غير صحيح أو منتهي الصلاحية",
        )

    # Clean up OTP record
    otp_col().delete_one({"_id": record["_id"]})

    user = users_col().find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "employee_id": user.get("employee_id"),
        "two_factor_enabled": True
    }

    emp = None
    if user.get("employee_id"):
        emp = employees_col().find_one({"employee_id": user["employee_id"]})
        if emp:
            user_data["name"] = emp.get("name")
            user_data["job_title"] = emp.get("job_title")
            user_data["department"] = emp.get("department")
            user_data["phone"] = emp.get("phone")
            user_data["photo_url"] = emp.get("photo_url")

    token = create_access_token({"sub": user["email"], "role": user["role"]})

    return TokenResponse(
        access_token=token,
        user=UserResponse(**user_data),
    )


@router.post("/toggle-2fa")
def toggle_2fa(current_user: dict = Depends(get_current_user)):
    """Toggle 2FA for the current employee."""
    emp_id = current_user.get("employee_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="User is not associated with an employee profile")

    emp = employees_col().find_one({"employee_id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    new_state = not emp.get("two_factor_enabled", False)
    employees_col().update_one(
        {"employee_id": emp_id},
        {"$set": {"two_factor_enabled": new_state}}
    )

    return {"message": "تم تعديل حالة التحقق الثنائي بنجاح", "two_factor_enabled": new_state}


@router.post("/register", response_model=UserResponse)
def register(
    user_data: UserCreate,
    current_user: dict = Depends(require_role("admin", "hr")),
):
    """Create a new user account. Requires admin or HR role."""
    if users_col().find_one({"email": user_data.email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    new_user = {
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "role": user_data.role.value,
        "employee_id": user_data.employee_id,
    }

    result = users_col().insert_one(new_user)

    return UserResponse(
        id=str(result.inserted_id),
        email=new_user["email"],
        role=new_user["role"],
        employee_id=new_user.get("employee_id"),
        two_factor_enabled=False
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    # Find employee 2FA status
    emp_id = current_user.get("employee_id")
    if emp_id:
        emp = employees_col().find_one({"employee_id": emp_id})
        if emp:
            current_user["two_factor_enabled"] = emp.get("two_factor_enabled", False)
            current_user["documents"] = emp.get("documents", [])
            current_user["career_path"] = emp.get("career_path", [])
            current_user["penalties"] = emp.get("penalties", [])
            current_user["contract_end_date"] = emp.get("contract_end_date")
    
    return UserResponse(**current_user)
