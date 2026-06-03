# app/models/asset.py
"""Pydantic models for asset management and tracking."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AssetStatus(str, Enum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    MAINTENANCE = "maintenance"


class AssetCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    serial_number: str = Field(min_length=2, max_length=50)
    type: str = Field(description="laptop | car | phone | other")


class AssetAssign(BaseModel):
    employee_id: str


class AssetResponse(BaseModel):
    id: str
    name: str
    serial_number: str
    type: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    status: AssetStatus
    assigned_date: Optional[str] = None
