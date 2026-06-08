# create_hr_admin.py
"""Script to create/update Admin and HR accounts in MongoDB database."""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load backend environment variables
load_dotenv("backend/.env")

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.database import get_db, users_col, employees_col, departments_col
from app.auth import hash_password
from app.services.encryption import encrypt_data

def create_accounts():
    print("🚀 Starting Admin and HR Account Creation/Update...")
    
    # 1. Connect to Database
    db = get_db()
    
    # --- ADMIN ACCOUNT ---
    admin_email = "admin@xqpharma.com"
    admin_emp_id = "EMP-0000"
    admin_password = "admin123"
    
    # Clean up existing to prevent duplicates
    users_col().delete_many({"email": admin_email})
    employees_col().delete_many({"employee_id": admin_emp_id})
    
    admin_pw_hash = hash_password(admin_password)
    
    admin_user_doc = {
        "email": admin_email,
        "password_hash": admin_pw_hash,
        "role": "admin",
        "employee_id": admin_emp_id
    }
    
    admin_employee_doc = {
        "employee_id": admin_emp_id,
        "name": "Administrator",
        "email": admin_email,
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
    
    users_col().insert_one(admin_user_doc)
    employees_col().insert_one(admin_employee_doc)
    
    # --- HR ACCOUNT ---
    hr_email = "hr@xqpharma.com"
    hr_emp_id = "EMP-1111"
    hr_password = "hr123"
    
    # Clean up existing to prevent duplicates
    users_col().delete_many({"email": hr_email})
    employees_col().delete_many({"employee_id": hr_emp_id})
    
    hr_pw_hash = hash_password(hr_password)
    
    hr_user_doc = {
        "email": hr_email,
        "password_hash": hr_pw_hash,
        "role": "hr",
        "employee_id": hr_emp_id
    }
    
    hr_employee_doc = {
        "employee_id": hr_emp_id,
        "name": "HR Manager",
        "email": hr_email,
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
    
    users_col().insert_one(hr_user_doc)
    employees_col().insert_one(hr_employee_doc)
    
    # Ensure IT and HR departments exist
    if departments_col().count_documents({"name": "IT"}) == 0:
        departments_col().insert_one({"name": "IT", "description": "Information Technology", "employee_count": 1})
    else:
        # Recount IT employees or set it
        departments_col().update_one({"name": "IT"}, {"$set": {"employee_count": employees_col().count_documents({"department": "IT"})}})
        
    if departments_col().count_documents({"name": "HR"}) == 0:
        departments_col().insert_one({"name": "HR", "description": "Human Resources", "employee_count": 1})
    else:
        departments_col().update_one({"name": "HR"}, {"$set": {"employee_count": employees_col().count_documents({"department": "HR"})}})
        
    print("\n==================================================")
    print("🎉 ACCOUNTS CREATED SUCCESSFULLY! 🎉")
    print("==================================================")
    print(f"📧 Admin Email: {admin_email} | Password: {admin_password}")
    print(f"📧 HR Email: {hr_email} | Password: {hr_password}")
    print("==================================================")

if __name__ == "__main__":
    create_accounts()
