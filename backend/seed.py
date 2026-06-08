# seed.py
"""Database seeding script to initialize MongoDB collections."""

import os
import sys
from datetime import datetime, timezone

# Add parent directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db, users_col, employees_col, departments_col, settings_col, leaves_col, advances_col
from app.auth import hash_password
from app.services.encryption import encrypt_data


def seed_db():
    print("🌱 Starting database seeding...")
    
    # Initialize connection
    db = get_db()
    
    # 2. Seed Settings (Only if empty)
    if settings_col().count_documents({}) == 0:
        print("⚙️ Seeding settings...")
        settings_doc = {
            "company_name": "XQ Pharma",
            "work_start": "11:00",
            "work_end": "19:00",
            "late_threshold_minutes": 15,
            "weekend_days": ["friday"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        settings_col().insert_one(settings_doc)
    else:
        print("⚙️ Settings already exist. Skipping settings seeding.")
    
    # 3. Seed Departments (Only if they do not exist)
    print("🏢 Checking/Seeding departments...")
    depts = [
        {"name": "HR", "description": "Human Resources", "employee_count": 0},
        {"name": "IT", "description": "Information Technology", "employee_count": 0},
        {"name": "Operations", "description": "Daily Operations", "employee_count": 0},
        {"name": "Sales", "description": "Sales and Marketing", "employee_count": 0},
        {"name": "Quality Control", "description": "Quality assurance and check", "employee_count": 0},
        {"name": "R&D", "description": "Research and Development", "employee_count": 0}
    ]
    for dept in depts:
        if departments_col().count_documents({"name": dept["name"]}) == 0:
            departments_col().insert_one(dept)
            print(f"🏢 Added missing department: {dept['name']}")
    
    # 4. Seed Admin User (Only if it doesn't exist)
    if users_col().count_documents({"email": "admin@xqpharma.com"}) == 0:
        print("👤 Seeding admin user...")
        admin_user = {
            "email": "admin@xqpharma.com",
            "password_hash": hash_password("admin123"),
            "role": "admin",
            "employee_id": "EMP-0000"
        }
        users_col().insert_one(admin_user)
    else:
        print("👤 Admin user already exists. Skipping user seeding.")
    
    # Seed Admin Employee profile (Only if it doesn't exist)
    if employees_col().count_documents({"employee_id": "EMP-0000"}) == 0:
        print("👤 Seeding admin employee profile...")
        admin_employee = {
            "employee_id": "EMP-0000",
            "name": "Administrator",
            "email": "admin@xqpharma.com",
            "phone": "+1234567890",
            "department": "IT",
            "job_title": "System Administrator",
            "national_id": encrypt_data("123456789"),
            "hire_date": "2026-01-01",
            "salary": encrypt_data(150000.0),
            "address": "123 Tech Avenue",
            "emergency_contact": "Emergency: +987654321",
            "photo_url": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        employees_col().insert_one(admin_employee)
        departments_col().update_one({"name": "IT"}, {"$inc": {"employee_count": 1}})
    else:
        print("👤 Admin employee profile already exists. Skipping employee profile seeding.")

    # 5. Seed HR User (Only if it doesn't exist)
    if users_col().count_documents({"email": "hr@xqpharma.com"}) == 0:
        print("👤 Seeding HR user...")
        hr_user = {
            "email": "hr@xqpharma.com",
            "password_hash": hash_password("hr123"),
            "role": "hr",
            "employee_id": "EMP-1111"
        }
        users_col().insert_one(hr_user)
    else:
        print("👤 HR user already exists. Skipping HR user seeding.")

    # Seed HR Employee profile (Only if it doesn't exist)
    if employees_col().count_documents({"employee_id": "EMP-1111"}) == 0:
        print("👤 Seeding HR employee profile...")
        hr_employee = {
            "employee_id": "EMP-1111",
            "name": "HR Manager",
            "email": "hr@xqpharma.com",
            "phone": "+201011111111",
            "department": "HR",
            "job_title": "HR Manager",
            "national_id": encrypt_data("29501011234571"),
            "hire_date": "2026-01-01",
            "salary": encrypt_data(80000.0),
            "address": "HR Office, Cairo",
            "emergency_contact": "Emergency: +201011111112",
            "photo_url": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        employees_col().insert_one(hr_employee)
        departments_col().update_one({"name": "HR"}, {"$inc": {"employee_count": 1}})
    else:
        print("👤 HR employee profile already exists. Skipping HR employee profile seeding.")
    
    print("✨ Database check and seeding process complete (no existing data was modified).")
 
if __name__ == "__main__":
    seed_db()
