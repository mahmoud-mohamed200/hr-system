# app/models/department.py
"""Pydantic models for department management."""

from pydantic import BaseModel, Field
from typing import Optional, List


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None
    manager_name: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_name: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    manager_name: Optional[str] = None
    employee_count: int = 0


class DepartmentListResponse(BaseModel):
    departments: List[DepartmentResponse]
    total: int
