# create_ceo.py
"""Script to create a CEO account with admin privileges in MongoDB database."""

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

def create_ceo_account():
    print("🚀 Starting CEO Account Creation...")
    
    # 1. Connect to Database
    db = get_db()
    
    email = "ceo@xqpharma.com"
    emp_id = "EMP-7777"
    password = "ceo123"
    
    # Clean up any existing CEO record to prevent duplication
    users_col().delete_many({"email": email})
    employees_col().delete_many({"employee_id": emp_id})
    
    # 2. Hash Password
    pw_hash = hash_password(password)
    
    # 3. Create User Document
    user_doc = {
        "email": email,
        "password_hash": pw_hash,
        "role": "ceo", # CEO role grants superuser access across all endpoints
        "employee_id": emp_id
    }
    
    # 4. Create Employee Document
    # Encrypt sensitive fields using the app's standard encryption
    encrypted_national_id = encrypt_data("29501011234560")
    encrypted_salary = encrypt_data(250000.0) # Highly realistic salary
    
    employee_doc = {
        "employee_id": emp_id,
        "name": "الرئيس التنفيذي (CEO)",
        "email": email,
        "phone": "+201000000000",
        "department": "Operations",
        "job_title": "الرئيس التنفيذي",
        "national_id": encrypted_national_id,
        "hire_date": "2026-01-01",
        "salary": encrypted_salary,
        "address": "المقر الرئيسي، القاهرة",
        "emergency_contact": "نائب الرئيس: +201000000001",
        "photo_url": None,
        "is_active": True,
        "two_factor_enabled": False,
        "documents": [],
        "career_path": [],
        "penalties": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert docs
    users_col().insert_one(user_doc)
    employees_col().insert_one(employee_doc)
    
    # Increment department employee count if it exists
    departments_col().update_one({"name": "Operations"}, {"$inc": {"employee_count": 1}})
    
    print("\n==================================================")
    print("🎉 CEO ACCOUNT CREATED SUCCESSFULLY! 🎉")
    print("==================================================")
    print(f"📧 Email: {email}")
    print(f"🔑 Password: {password}")
    print(f"🆔 Employee ID: {emp_id}")
    print(f"👑 Access Level: CEO / Superuser (Stronger than Admin)")
    print("==================================================")

if __name__ == "__main__":
    create_ceo_account()
