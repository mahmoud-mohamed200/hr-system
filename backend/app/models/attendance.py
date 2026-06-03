# app/models/attendance.py
"""Pydantic models for attendance tracking."""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class AttendanceStatus(str, Enum):
    ON_TIME = "on_time"
    LATE = "late"
    ABSENT = "absent"
    WEEKEND = "weekend"
    LEAVE = "leave"


class AttendanceRecord(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: str
    job_title: str
    date: str  # YYYY-MM-DD
    check_in: Optional[str] = None  # HH:MM:SS
    check_out: Optional[str] = None  # HH:MM:SS
    status: AttendanceStatus
    hours_worked: Optional[float] = None
    notes: Optional[str] = None
    source: str = "camera"  # camera | manual


class AttendanceCheckIn(BaseModel):
    employee_id: str
    notes: Optional[str] = None


class AttendanceCheckOut(BaseModel):
    employee_id: str
    notes: Optional[str] = None


class AttendanceListResponse(BaseModel):
    records: List[AttendanceRecord]
    total: int
    page: int
    per_page: int


class TodaySummary(BaseModel):
    total_employees: int
    present: int
    absent: int
    late: int
    on_time: int
    not_checked_out: int
