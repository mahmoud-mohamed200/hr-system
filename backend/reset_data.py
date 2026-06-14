import sys
import os

# Ensure we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import (
    attendance_col,
    payrolls_col,
    assets_col,
    loans_col,
    advances_col,
    employees_col,
)

def reset_all_data():
    print("Starting data wipe...")

    # 1. Delete all attendance
    del_att = attendance_col().delete_many({})
    print(f"Deleted {del_att.deleted_count} attendance records.")

    # 2. Delete all payrolls
    del_pay = payrolls_col().delete_many({})
    print(f"Deleted {del_pay.deleted_count} payroll records.")

    # 3. Delete all assets (العهد)
    del_ass = assets_col().delete_many({})
    print(f"Deleted {del_ass.deleted_count} assets.")

    # 4. Delete all loans and advances
    del_loan = loans_col().delete_many({})
    print(f"Deleted {del_loan.deleted_count} loans.")

    del_adv = advances_col().delete_many({})
    print(f"Deleted {del_adv.deleted_count} advances.")

    # 5. Clear penalties from all employees without deleting the employee
    upd_emp = employees_col().update_many({}, {"$set": {"penalties": []}})
    print(f"Cleared penalties for {upd_emp.modified_count} employees.")

    print("Data reset complete. Starting fresh!")

if __name__ == "__main__":
    reset_all_data()
