# app/models/loan.py
"""Pydantic models for long-term loan requests."""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class LoanStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class InstallmentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"


class LoanInstallment(BaseModel):
    month: str  # YYYY-MM
    amount: float
    status: InstallmentStatus = InstallmentStatus.PENDING


class LoanCreate(BaseModel):
    amount: float = Field(gt=0, description="Total loan amount in EGP")
    installments_count: int = Field(ge=1, le=60, description="Number of monthly installments")
    reason: str
    start_month: str = Field(pattern=r"^\d{4}-\d{2}$", description="Start month in YYYY-MM format")


class LoanUpdateStatus(BaseModel):
    status: LoanStatus


class LoanResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: str
    amount: float
    installments_count: int
    monthly_payment: float
    remaining_installments: int
    remaining_amount: float
    status: LoanStatus
    reason: str
    start_month: str
    payments: List[LoanInstallment]
    created_at: str
    approved_by: Optional[str] = None
