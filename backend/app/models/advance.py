# app/models/advance.py
"""Pydantic models for salary advance requests."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AdvanceStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AdvanceCreate(BaseModel):
    amount: float = Field(gt=0)
    reason: str


class AdvanceUpdateStatus(BaseModel):
    status: AdvanceStatus


class AdvanceResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: str
    amount: float
    reason: str
    status: AdvanceStatus
    created_at: str
    approved_by: Optional[str] = None
