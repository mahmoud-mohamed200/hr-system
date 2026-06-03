# app/models/employee.py
"""Pydantic models for employee management."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    department: str
    job_title: str
    national_id: Optional[str] = None
    hire_date: Optional[str] = None  # ISO format YYYY-MM-DD
    contract_end_date: Optional[str] = None  # ISO format YYYY-MM-DD
    salary: Optional[float] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    national_id: Optional[str] = None
    salary: Optional[float] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    is_active: Optional[bool] = None
    contract_end_date: Optional[str] = None
    two_factor_enabled: Optional[bool] = None


class EmployeeResponse(BaseModel):
    id: str
    employee_id: str
    name: str
    email: str
    phone: Optional[str] = None
    department: str
    job_title: str
    national_id: Optional[str] = None
    hire_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    salary: Optional[float] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool = True
    two_factor_enabled: bool = False
    documents: List[dict] = []
    career_path: List[dict] = []
    penalties: List[dict] = []
    created_at: Optional[str] = None


class EmployeeListResponse(BaseModel):
    employees: List[EmployeeResponse]
    total: int
    page: int
    per_page: int
