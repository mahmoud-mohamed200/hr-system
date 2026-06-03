# verify_hr_portal.py
"""Automated integration tests for HR Portal (Arabic & Egyptian custom engine)."""

import sys
import json
import requests
from pymongo import MongoClient

BASE_URL = "http://localhost:8000"

def test_log(msg: str):
    print(f"\n👉 {msg}")

def run_tests():
    print("==================================================")
    print("🚀 Running HR Portal End-to-End Integration Tests")
    print("==================================================")

    # Connect directly to MongoDB for encryption verification
    mongo_client = MongoClient("mongodb://localhost:27017/")
    db = mongo_client["hr_attendance"]
    employees_col = db["employees"]
    otp_col = db["otp"]

    # ----------------------------------------------------
    # 1. Admin Authentication
    # ----------------------------------------------------
    test_log("Step 1: Admin Authentication")
    login_payload = {
        "email": "admin@xqpharma.com",
        "password": "admin123"
    }
    r = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    login_data = r.json()
    admin_token = login_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✅ Admin authenticated successfully.")

    # ----------------------------------------------------
    # 2. Two-Factor Authentication (2FA) Flow
    # ----------------------------------------------------
    test_log("Step 2: Two-Factor Authentication (2FA) Flow")
    # Enable 2FA
    r = requests.post(f"{BASE_URL}/api/auth/toggle-2fa", headers=admin_headers)
    assert r.status_code == 200, f"Toggle 2FA failed: {r.text}"
    assert r.json()["two_factor_enabled"] is True, "2FA was not enabled"
    print("✅ 2FA enabled for Admin.")

    # Login again, should return 2fa_required
    r = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    assert r.status_code == 200
    res = r.json()
    assert res.get("status") == "2fa_required", f"Expected 2fa_required, got {res}"
    dev_otp = res.get("dev_otp")
    assert dev_otp is not None, "dev_otp missing in response payload"
    print(f"✅ Login prompted for 2FA. Developer OTP received: {dev_otp}")

    # Verify 2FA
    verify_payload = {
        "email": "admin@xqpharma.com",
        "otp": dev_otp
    }
    r = requests.post(f"{BASE_URL}/api/auth/verify-2fa", json=verify_payload)
    assert r.status_code == 200, f"2FA verification failed: {r.text}"
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✅ 2FA verification succeeded. JWT acquired.")

    # Disable 2FA for subsequent admin runs
    r = requests.post(f"{BASE_URL}/api/auth/toggle-2fa", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["two_factor_enabled"] is False, "2FA was not disabled"
    print("✅ 2FA disabled for Admin to facilitate testing.")

    import datetime
    today = datetime.date.today()
    target_month = today.strftime("%Y-%m")

    # ----------------------------------------------------
    # 3. Create Employee & Sensitive Data Encryption Check
    # ----------------------------------------------------
    test_log("Step 3: Create Employee & Sensitive Data Encryption Check")
    emp_email = "test.egyptian@xqpharma.com"
    # Ensure clean state
    db["payrolls"].delete_many({"month": target_month})
    db["leaves"].delete_many({"employee_id": {"$ne": "EMP-0000"}})
    db["loans"].delete_many({"employee_id": {"$ne": "EMP-0000"}})
    db["advances"].delete_many({"employee_id": {"$ne": "EMP-0000"}})
    db["attendance"].delete_many({"employee_id": {"$ne": "EMP-0000"}})
    db["payrolls"].delete_many({"employee_id": {"$ne": "EMP-0000"}})
    db["assets"].delete_many({"employee_id": {"$ne": "EMP-0000"}})
    employees_col.delete_many({"employee_id": {"$ne": "EMP-0000"}})
    db["users"].delete_many({"employee_id": {"$ne": "EMP-0000"}})

    # Contract ends in 15 days to test the expiration warning endpoint
    contract_end = (today + datetime.timedelta(days=15)).strftime("%Y-%m-%d")

    employee_payload = {
        "name": "محمود المصري",
        "email": emp_email,
        "phone": "+201012345678",
        "department": "IT",
        "job_title": "مطور برمجيات",
        "national_id": "29501011234567",  # 14-digit Egyptian format
        "hire_date": today.strftime("%Y-%m-%d"),
        "contract_end_date": contract_end,
        "salary": 10000.0,
        "address": "القاهرة، مصر",
        "emergency_contact": "أحمد المصري: +201098765432"
    }

    r = requests.post(f"{BASE_URL}/api/employees", json=employee_payload, headers=admin_headers)
    assert r.status_code == 200, f"Employee creation failed: {r.text}"
    new_emp = r.json()
    emp_id = new_emp["employee_id"]
    print(f"✅ Employee created successfully with ID: {emp_id}")

    # Inspect MongoDB document directly
    db_doc = employees_col.find_one({"employee_id": emp_id})
    assert db_doc is not None
    assert db_doc["national_id"] != "29501011234567", "National ID was not encrypted in MongoDB!"
    assert db_doc["salary"] != 10000.0, "Salary was not encrypted in MongoDB!"
    print("✅ MongoDB Direct Check: Sensitive fields are properly encrypted (stored as bytes/hash).")

    # Access via API, fields should be transparently decrypted
    r = requests.get(f"{BASE_URL}/api/employees/{emp_id}", headers=admin_headers)
    assert r.status_code == 200
    fetched_emp = r.json()
    assert fetched_emp["national_id"] == "29501011234567", "National ID was not decrypted on fetch"
    assert fetched_emp["salary"] == 10000.0, "Salary was not decrypted on fetch"
    print("✅ API Endpoint Check: Sensitive fields are transparently decrypted.")

    # Check contract alert warning endpoint
    r = requests.get(f"{BASE_URL}/api/employees/alerts", headers=admin_headers)
    assert r.status_code == 200
    alerts = r.json()
    assert any(a["employee_id"] == emp_id for a in alerts), "Contract end alert did not trigger for <30 days contract"
    print("✅ Contract Expiration Alert (30 days) verified successfully.")

    # Get employee credentials token
    emp_login = {
        "email": emp_email,
        "password": "changeme123"  # Default password
    }
    r = requests.post(f"{BASE_URL}/api/auth/login", json=emp_login)
    assert r.status_code == 200, f"Employee login failed: {r.text}"
    emp_token = r.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # ----------------------------------------------------
    # 4. GPS Geofencing (200m range constraint)
    # ----------------------------------------------------
    test_log("Step 4: GPS Geofencing (200m radius checking)")
    # Clear today's attendance for employee
    db["attendance"].delete_many({"employee_id": emp_id})

    # Within Geofence (Cairo coordinates: 30.0444, 31.2357)
    gps_in_range = {
        "latitude": 30.0445,
        "longitude": 31.2356,
        "notes": "بجوار مقر الشركة"
    }
    r = requests.post(f"{BASE_URL}/api/attendance/gps-check-in", json=gps_in_range, headers=emp_headers)
    assert r.status_code == 200, f"GPS check-in failed inside range: {r.text}"
    print("✅ GPS Check-in within 200m geofence range succeeded.")

    # Reset attendance
    db["attendance"].delete_many({"employee_id": emp_id})

    # Outside Geofence (Distance > 200m)
    gps_out_range = {
        "latitude": 31.0444,
        "longitude": 32.2357,
        "notes": "من المنزل"
    }
    r = requests.post(f"{BASE_URL}/api/attendance/gps-check-in", json=gps_out_range, headers=emp_headers)
    assert r.status_code == 400, "GPS check-in should have failed outside range"
    print("✅ GPS Check-in outside 200m geofence range was blocked (400 Bad Request) as expected.")

    # ----------------------------------------------------
    # 5. Leaves & Short Hourly Permission Limits (4-hour monthly cap)
    # ----------------------------------------------------
    test_log("Step 5: Leaves & Permission Monthly Cap (4 hours)")
    current_month_str = today.strftime("%Y-%m-%d")

    # Request 3 hours permission (under limit)
    perm_payload_1 = {
        "leave_type": "permission",
        "start_date": current_month_str,
        "end_date": current_month_str,
        "duration_hours": 3.0,
        "reason": "زيارة الطبيب"
    }
    r = requests.post(f"{BASE_URL}/api/leaves", json=perm_payload_1, headers=emp_headers)
    assert r.status_code == 201, f"First permission request failed: {r.text}"
    perm_id_1 = r.json()["id"]
    print("✅ Requesting 3-hour permission succeeded.")

    # Request another 2 hours permission (exceeds 4 hours monthly cap: 3 + 2 = 5)
    perm_payload_2 = {
        "leave_type": "permission",
        "start_date": current_month_str,
        "end_date": current_month_str,
        "duration_hours": 2.0,
        "reason": "مشوار عائلي"
    }
    # Wait, we need to approve the first permission first, because the code queries approved permissions in the month.
    # Let's approve the first permission request
    r = requests.put(f"{BASE_URL}/api/leaves/{perm_id_1}/status", json={"status": "approved"}, headers=admin_headers)
    assert r.status_code == 200, f"Approve first permission failed: {r.text}"
    print("✅ Admin approved the first 3-hour permission.")

    # Now request the second one. It should fail because 3 + 2 = 5 > 4 hours limit.
    r = requests.post(f"{BASE_URL}/api/leaves", json=perm_payload_2, headers=emp_headers)
    assert r.status_code == 400, "Second permission request should have been blocked (cap exceeded)"
    print("✅ Capping mechanism blocked the second permission (exceeds 4-hour limit) as expected.")

    # Verify automatic attendance adjustments (Permission approved cancels late or absent marks)
    att_rec = db["attendance"].find_one({"employee_id": emp_id, "date": current_month_str})
    assert att_rec is not None
    assert att_rec["status"] == "on_time", "Attendance status was not auto-adjusted to 'on_time' on permission approval"
    print("✅ Attendance record was automatically updated to 'on_time' after permission approval.")

    # ----------------------------------------------------
    # 6. Long-Term Loans (Schedule Generator)
    # ----------------------------------------------------
    test_log("Step 6: Long-Term Loans (Schedule Generator)")
    loan_payload = {
        "amount": 12000.0,
        "installments_count": 12,
        "reason": "شراء مستلزمات زواج",
        "start_month": today.strftime("%Y-%m")
    }
    r = requests.post(f"{BASE_URL}/api/loans", json=loan_payload, headers=emp_headers)
    assert r.status_code == 201, f"Loan request failed: {r.text}"
    loan_id = r.json()["id"]
    print("✅ Loan request submitted.")

    # Approve loan
    r = requests.put(f"{BASE_URL}/api/loans/{loan_id}/status", json={"status": "approved"}, headers=admin_headers)
    assert r.status_code == 200, f"Loan approval failed: {r.text}"
    approved_loan = r.json()
    assert len(approved_loan["payments"]) == 12, "Installment schedule was not generated with 12 entries"
    assert approved_loan["monthly_payment"] == 1000.0, "Monthly payment calculation incorrect"
    print("✅ Loan approved. 12-month installment schedule generated successfully.")

    # ----------------------------------------------------
    # 7. Salary Advances Cap Constraint (50% basic salary)
    # ----------------------------------------------------
    test_log("Step 7: Temporary Salary Advances Cap (50% basic)")
    # Reject advance exceeding 50% of basic salary (salary is 10000, 50% is 5000)
    adv_payload_fail = {
        "amount": 6000.0,
        "reason": "ظرف طارئ كبير"
    }
    r = requests.post(f"{BASE_URL}/api/advances", json=adv_payload_fail, headers=emp_headers)
    assert r.status_code == 400, "Advance >50% basic should have been blocked"
    print("✅ Advance request exceeding 50% of basic salary was blocked as expected.")

    # Request advance under 50%
    adv_payload_success = {
        "amount": 4000.0,
        "reason": "تصليح سيارة"
    }
    r = requests.post(f"{BASE_URL}/api/advances", json=adv_payload_success, headers=emp_headers)
    assert r.status_code == 201, f"Advance request failed: {r.text}"
    adv_id = r.json()["id"]
    print("✅ Advance request under 50% submitted.")

    # Approve advance
    r = requests.put(f"{BASE_URL}/api/advances/{adv_id}/status", json={"status": "approved"}, headers=admin_headers)
    assert r.status_code == 200
    print("✅ Admin approved the advance.")

    # ----------------------------------------------------
    # 8. Egyptian Payroll Calculation (Insurance 11%, Tax 10%)
    # ----------------------------------------------------
    test_log("Step 8: Egyptian Payroll Engine calculations")

    # Perform preview calculation
    r = requests.get(f"{BASE_URL}/api/payroll/calculate?month={target_month}", headers=admin_headers)
    assert r.status_code == 200, f"Payroll calculation failed: {r.text}"
    preview_records = r.json()["records"]
    emp_payroll = next((rec for rec in preview_records if rec["employee_id"] == emp_id), None)
    assert emp_payroll is not None, "Employee payroll calculation record missing"

    # Verifications:
    # 1. Allowances: 10% basic (10000 * 0.10 = 1000 EGP)
    assert emp_payroll["allowances"] == 1000.0, f"Expected 1000 allowances, got {emp_payroll['allowances']}"
    # 2. Insurance: 11% basic (10000 * 0.11 = 1100 EGP)
    assert emp_payroll["deductions_insurance"] == 1100.0, f"Expected 1100 insurance, got {emp_payroll['deductions_insurance']}"
    # 3. Taxes: 10% of gross (Gross = basic + allowances + overtime = 10000 + 1000 + 0 = 11000. Tax = 1100 EGP)
    assert emp_payroll["deductions_taxes"] == 1100.0, f"Expected 1100 tax, got {emp_payroll['deductions_taxes']}"
    # 4. Advances: 4000 EGP
    assert emp_payroll["deductions_advances"] == 4000.0, f"Expected 4000 advances deduction, got {emp_payroll['deductions_advances']}"
    # 5. Loans: 1000 EGP
    assert emp_payroll["deductions_loans"] == 1000.0, f"Expected 1000 loan installment deduction, got {emp_payroll['deductions_loans']}"
    
    print("✅ Allowances (10%), Social Insurance (11% of basic), and Tax (10% of gross) match Egyptian labor law rules.")
    print("✅ Installments and temporary advances correctly deducted from the current month.")

    # ----------------------------------------------------
    # 9. Approve Payroll & Secure Encrypted Payslip Check
    # ----------------------------------------------------
    test_log("Step 9: Payroll Approval & Encrypted Payslip Decryption")
    # Clean previous payroll approved records for this month
    db["payrolls"].delete_many({"month": target_month})

    # Approve
    r = requests.post(f"{BASE_URL}/api/payroll/approve?month={target_month}", headers=admin_headers)
    assert r.status_code == 200, f"Payroll approval failed: {r.text}"
    print("✅ Payroll approved and locked for month.")

    # Get payslips listing for employee
    r = requests.get(f"{BASE_URL}/api/payroll/payslips?month={target_month}", headers=emp_headers)
    assert r.status_code == 200
    payslips = r.json()
    emp_payslip = next((p for p in payslips if p["employee_id"] == emp_id), None)
    assert emp_payslip is not None
    payslip_id = emp_payslip["id"]
    assert emp_payslip["encrypted_data"] != "", "Payslip is not encrypted!"
    print("✅ Employee payslip fetched in encrypted form.")

    # Decrypt payslip with WRONG password
    decrypt_payload_wrong = {"password": "wrongpassword"}
    r = requests.post(f"{BASE_URL}/api/payroll/payslips/{payslip_id}/decrypt", json=decrypt_payload_wrong, headers=emp_headers)
    assert r.status_code == 401, "Decryption should fail with wrong password"
    print("✅ Payslip decryption failed with invalid password (401 Unauthorized) as expected.")

    # Decrypt payslip with CORRECT password
    decrypt_payload_correct = {"password": "changeme123"}
    r = requests.post(f"{BASE_URL}/api/payroll/payslips/{payslip_id}/decrypt", json=decrypt_payload_correct, headers=emp_headers)
    assert r.status_code == 200, f"Decryption failed: {r.text}"
    decrypted_payslip = r.json()
    assert decrypted_payslip["basic_salary"] == 10000.0
    assert decrypted_payslip["net_salary"] == emp_payroll["net_salary"]
    print("✅ Decrypted payslip contains correct net salary and basic salary.")

    # ----------------------------------------------------
    # 10. Assets Assignment and Deactivation Lock (Exit Clearance)
    # ----------------------------------------------------
    test_log("Step 10: Assets Assignment & Employee Safety Clearance Locks")
    # Clean previous asset serial
    db["assets"].delete_many({"serial_number": "XQ-LAP-9999"})

    # Create Asset
    asset_payload = {
        "name": "لابتوب ماك بوك برو",
        "serial_number": "XQ-LAP-9999",
        "type": "laptop"
    }
    r = requests.post(f"{BASE_URL}/api/assets", json=asset_payload, headers=admin_headers)
    assert r.status_code == 201, f"Asset creation failed: {r.text}"
    asset_id = r.json()["id"]
    print(f"✅ Asset created successfully: {asset_payload['name']} (ID: {asset_id})")

    # Assign Asset to Employee
    r = requests.post(f"{BASE_URL}/api/assets/{asset_id}/assign", json={"employee_id": emp_id}, headers=admin_headers)
    assert r.status_code == 200, f"Asset assignment failed: {r.text}"
    print("✅ Asset assigned to employee.")

    # Attempt to delete the employee
    r = requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=admin_headers)
    assert r.status_code == 400, "Employee deletion should be blocked by active asset lock"
    print("✅ Deletion locked: Blocked by active assigned asset (400 Bad Request) as expected.")

    # Attempt to deactivate employee
    r = requests.put(f"{BASE_URL}/api/employees/{emp_id}", json={"is_active": False}, headers=admin_headers)
    assert r.status_code == 400, "Employee deactivation should be blocked by active asset lock"
    print("✅ Deactivation locked: Blocked by active assigned asset (400 Bad Request) as expected.")

    # Return Asset
    r = requests.post(f"{BASE_URL}/api/assets/{asset_id}/return", headers=admin_headers)
    assert r.status_code == 200
    print("✅ Asset returned to company inventory.")

    # Attempt deletion again (should now succeed)
    r = requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=admin_headers)
    assert r.status_code == 200, f"Employee deletion failed after asset return: {r.text}"
    print("✅ Employee deleted successfully after exit clearance asset checks passed.")

    print("\n==================================================")
    print("🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉")
    print("==================================================")

if __name__ == "__main__":
    try:
        run_tests()
    except AssertionError as e:
        print(f"\n❌ TEST FAILURE: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        sys.exit(1)
