# app/database.py
"""MongoDB connection manager — singleton client for the application."""

from pymongo import MongoClient
from app.config import settings

_client = None
_db = None


def get_client() -> MongoClient:
    """Get or create the MongoDB client singleton."""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI)
    return _client


def get_db():
    """Get the application database instance."""
    global _db
    if _db is None:
        _db = get_client()[settings.MONGODB_DB]
        _ensure_indexes()
    return _db


def _ensure_indexes():
    """Create indexes for performance on first connection."""
    db = get_client()[settings.MONGODB_DB]

    # Users — unique email
    db.users.create_index("email", unique=True)

    # Employees — unique employee_id and email
    db.employees.create_index("employee_id", unique=True)
    db.employees.create_index("email", unique=True)
    db.employees.create_index("department")

    # Attendance — compound index for fast lookups
    db.attendance.create_index([("employee_id", 1), ("date", -1)])
    db.attendance.create_index("date")

    # Departments — unique name
    db.departments.create_index("name", unique=True)

    # Loans
    db.loans.create_index([("employee_id", 1), ("created_at", -1)])

    # Assets
    db.assets.create_index("serial_number", unique=True)
    db.assets.create_index("employee_id")

    # Payrolls
    db.payrolls.create_index([("month", 1), ("employee_id", 1)], unique=True)

    # OTP — automatic expiration using TTL index
    db.otp.create_index("created_at", expireAfterSeconds=300)


# Collection accessors for convenience
def users_col():
    return get_db().users


def employees_col():
    return get_db().employees


def attendance_col():
    return get_db().attendance


def departments_col():
    return get_db().departments


def settings_col():
    return get_db().settings


def leaves_col():
    return get_db().leaves


def advances_col():
    return get_db().advances


def loans_col():
    return get_db().loans


def assets_col():
    return get_db().assets


def payrolls_col():
    return get_db().payrolls


def otp_col():
    return get_db().otp
