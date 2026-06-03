# app/models/payroll.py
"""Pydantic models for automated payroll engine calculations and payslips."""

from pydantic import BaseModel
from typing import Optional, List


class PayrollRecord(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: str
    month: str  # YYYY-MM
    basic_salary: float
    allowances: float
    overtime_hours: float
    overtime_pay: float
    deductions_insurance: float
    deductions_taxes: float
    deductions_unjustified_absence: float
    deductions_lateness: float
    deductions_loans: float
    deductions_advances: float
    deductions_penalties: float
    net_salary: float
    status: str  # draft | approved
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None


class PayrollApproval(BaseModel):
    month: str


class PayslipResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    job_title: str
    department: str
    month: str
    net_salary: float
    encrypted_data: str  # Secure AES-encrypted JSON of full payroll breakdown
