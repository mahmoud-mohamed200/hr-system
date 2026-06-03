# app/models/user.py
"""Pydantic models for user authentication and authorization."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    HR = "hr"
    EMPLOYEE = "employee"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: UserRole = UserRole.EMPLOYEE
    employee_id: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    role: UserRole
    employee_id: Optional[str] = None
    # Joined from employee record
    name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    two_factor_enabled: Optional[bool] = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
