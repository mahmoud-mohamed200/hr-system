# app/models/leave.py
"""Pydantic models for leave and permission requests."""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class LeaveType(str, Enum):
    CASUAL = "casual"
    SICK = "sick"
    ANNUAL = "annual"
    PERMISSION = "permission"  # Short hourly leave
    MISSION = "mission"  # Business mission


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LeaveCreate(BaseModel):
    leave_type: LeaveType
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    reason: str
    duration_hours: Optional[float] = None  # Only for short permissions


class LeaveUpdateStatus(BaseModel):
    status: LeaveStatus


class LeaveResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: str
    leave_type: LeaveType
    start_date: str
    end_date: str
    reason: str
    duration_hours: Optional[float] = None
    status: LeaveStatus
    created_at: str
    approved_by: Optional[str] = None
