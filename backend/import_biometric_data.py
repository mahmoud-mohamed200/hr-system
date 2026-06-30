# import_biometric_data.py
"""
سكريبت استيراد بيانات جهاز البصمة ZKteco إلى نظام الـ HR.
يقرأ ملفات CSV المصدرة من الجهاز ويستوردها في MongoDB.

الخطوات:
  1. قراءة users_list.csv → إنشاء/تحديث ملفات الموظفين
  2. إنشاء حسابات مستخدمين للموظفين الجدد
  3. قراءة attendance_records.csv → استيراد سجلات الحضور
"""

import os
import sys
import csv
from datetime import datetime, timezone
from collections import defaultdict

# Add parent directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db, users_col, employees_col, attendance_col, departments_col
from app.auth import hash_password
from app.config import settings

# ─── Configuration ────────────────────────────────────────────────────────────

# Paths to the CSV files exported from the ZK device
USERS_CSV = os.path.expanduser("~/basma/users_list.csv")
ATTENDANCE_CSV = os.path.expanduser("~/basma/attendance_records.csv")

# Default password for newly created accounts
DEFAULT_PASSWORD = "Xq@2026"

# Device IDs to skip (unknown employees)
SKIP_DEVICE_IDS = set()

# Default department for new employees
DEFAULT_DEPARTMENT = "Operations"
DEFAULT_JOB_TITLE = "موظف"

# Work start time for late detection (from settings)
WORK_START = settings.WORK_START  # "11:00"
LATE_THRESHOLD = settings.LATE_THRESHOLD_MINUTES  # 15 minutes


# ─── Helper Functions ─────────────────────────────────────────────────────────

def is_late(check_in_time_str: str) -> bool:
    """Check if a check-in time is past the late threshold."""
    try:
        work_start = datetime.strptime(WORK_START, "%H:%M")
        from datetime import timedelta
        threshold = work_start + timedelta(minutes=LATE_THRESHOLD)
        actual = datetime.strptime(check_in_time_str, "%H:%M:%S")
        return actual.time() > threshold.time()
    except ValueError:
        return False


def calc_hours(check_in: str, check_out: str) -> float:
    """Calculate hours worked between check-in and check-out times."""
    try:
        t_in = datetime.strptime(check_in, "%H:%M:%S")
        t_out = datetime.strptime(check_out, "%H:%M:%S")
        diff = (t_out - t_in).total_seconds() / 3600
        return round(max(0, diff), 2)
    except ValueError:
        return 0.0


def clean_name(raw_name: str) -> str:
    """Convert 'FirstName.LastName' to 'FirstName LastName'."""
    return raw_name.replace(".", " ").strip()


def make_email(raw_name: str) -> str:
    """Generate email from device name like 'Abdullah.Alshiekh' → 'abdullah.alshiekh@xqpharma.com'."""
    name_part = raw_name.strip().replace(" ", ".").lower()
    # Remove extra dots
    while ".." in name_part:
        name_part = name_part.replace("..", ".")
    return f"{name_part}@xqpharma.com"


def is_same_name(name1: str, name2: str) -> bool:
    """Compare names by normalizing spaces, dots, dashes, underscores and letter cases."""
    def normalize(n: str) -> str:
        if not n:
            return ""
        return "".join(n.replace(".", "").replace("-", "").replace("_", "").lower().split())
    return normalize(name1) == normalize(name2)


def find_earliest_punches_from_csv(attendance_csv_path: str) -> dict:
    """Pre-scan attendance CSV to find the earliest punch timestamp for each device_id."""
    earliest_punches = {}
    if not os.path.exists(attendance_csv_path):
        return earliest_punches
    
    with open(attendance_csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            device_id_str = row.get("رقم الموظف", "").strip()
            timestamp_str = row.get("الوقت", "").strip()
            if not device_id_str or not timestamp_str:
                continue
            
            try:
                device_id = int(device_id_str)
                dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                if device_id not in earliest_punches or dt < earliest_punches[device_id]:
                    earliest_punches[device_id] = dt
            except ValueError:
                continue
    return earliest_punches


# ─── Phase 1: Import Employees ───────────────────────────────────────────────

def import_employees() -> dict:
    """
    Read users_list.csv and create/update employee profiles in MongoDB.
    Returns a mapping of device_id → employee_id for attendance import.
    """
    print("\n" + "=" * 60)
    print("📋 المرحلة 1: استيراد/تحديث بيانات الموظفين")
    print("=" * 60)

    device_to_emp = {}  # device_id → employee_id mapping
    created = 0
    updated = 0
    skipped = 0

    csv_path = os.path.normpath(USERS_CSV)
    if not os.path.exists(csv_path):
        print(f"❌ ملف المستخدمين غير موجود: {csv_path}")
        return device_to_emp

    # Scan the attendance CSV to find the earliest punch date/time for each user
    earliest_punches = find_earliest_punches_from_csv(ATTENDANCE_CSV)

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse device user_id
            device_id_str = row.get("رقم الموظف (user_id)", "").strip()
            if not device_id_str:
                continue
            device_id = int(device_id_str)
            raw_name = row.get("الاسم", "").strip()

            # Skip unknown employees
            if device_id in SKIP_DEVICE_IDS or raw_name == "غير معروف" or not raw_name:
                print(f"  ⏭️  تخطي الموظف {device_id} ({raw_name})")
                skipped += 1
                continue

            display_name = clean_name(raw_name)
            email = make_email(raw_name)

            # ── BIOMETRIC-ID-FIRST LOOKUP ──────────────────────────────
            # Query ONLY by biometric_id to prevent cross-user data leakage.
            existing = employees_col().find_one({"biometric_id": device_id})

            if existing:
                # Recycled biometric ID check
                if not existing.get("is_active", True) and not is_same_name(display_name, existing.get("name", "")) and not is_same_name(display_name, existing.get("device_name", "")):
                    print(f"  ⚠️ معرف بصمة مكرر/معاد استخدامه {device_id} لموظف غير نشط. الموظف القديم: {existing['name']}, الجديد: {display_name}. فك ارتباط القديم.")
                    employees_col().update_one(
                        {"_id": existing["_id"]},
                        {"$unset": {"biometric_id": ""}}
                    )
                    existing = None

            if existing:
                # Employee already registered with this biometric_id
                device_to_emp[device_id] = existing["employee_id"]
                print(f"  🔄 موظف موجود: {display_name} (EMP: {existing['employee_id']}, Biometric: {device_id})")
                updated += 1
            else:
                # Create new employee
                # Generate employee_id
                emp_id = f"EMP-{device_id:04d}"

                # Ensure unique employee_id
                if employees_col().find_one({"employee_id": emp_id}):
                    # Find next available
                    counter = device_id + 100
                    while employees_col().find_one({"employee_id": f"EMP-{counter:04d}"}):
                        counter += 1
                    emp_id = f"EMP-{counter:04d}"

                # Ensure unique email
                if employees_col().find_one({"email": email}):
                    email = f"{raw_name.lower().replace(' ', '.').replace('..', '.')}_{device_id}@xqpharma.com"

                now_utc = datetime.now(timezone.utc).isoformat()
                first_reg_scan = now_utc
                if earliest_punches and device_id in earliest_punches:
                    first_reg_scan = earliest_punches[device_id].isoformat()

                new_employee = {
                    "employee_id": emp_id,
                    "name": display_name,
                    "device_name": raw_name,  # Store original device name separately
                    "email": email,
                    "phone": None,
                    "department": DEFAULT_DEPARTMENT,
                    "job_title": DEFAULT_JOB_TITLE,
                    "national_id": None,
                    "hire_date": "2025-07-01",  # First date in attendance data
                    "salary": None,
                    "address": None,
                    "emergency_contact": None,
                    "photo_url": None,
                    "is_active": True,
                    "biometric_id": device_id,
                    "first_registration_scan": first_reg_scan,
                    "documents": [],
                    "career_path": [],
                    "penalties": [],
                    "created_at": now_utc,
                }

                employees_col().insert_one(new_employee)
                device_to_emp[device_id] = emp_id

                # Update department count
                departments_col().update_one(
                    {"name": DEFAULT_DEPARTMENT},
                    {"$inc": {"employee_count": 1}},
                    upsert=True
                )

                print(f"  ✅ إنشاء موظف جديد: {display_name} ({emp_id}, Biometric: {device_id})")
                created += 1

    print(f"\n📊 النتيجة: {created} جديد | {updated} تحديث | {skipped} تخطي")
    return device_to_emp


# ─── Phase 2: Create User Accounts ───────────────────────────────────────────

def create_user_accounts(device_to_emp: dict):
    """
    Create login accounts for newly imported employees.
    """
    print("\n" + "=" * 60)
    print("👤 المرحلة 2: إنشاء حسابات تسجيل الدخول")
    print("=" * 60)

    created = 0
    skipped = 0

    for device_id, emp_id in device_to_emp.items():
        emp = employees_col().find_one({"employee_id": emp_id})
        if not emp:
            continue

        email = emp["email"]

        # Check if user account already exists
        if users_col().find_one({"email": email}):
            print(f"  ⏭️  حساب موجود بالفعل: {email}")
            skipped += 1
            continue

        new_user = {
            "email": email,
            "password_hash": hash_password(DEFAULT_PASSWORD),
            "role": "employee",
            "employee_id": emp_id,
        }

        users_col().insert_one(new_user)
        print(f"  ✅ حساب جديد: {email} (كلمة السر: {DEFAULT_PASSWORD})")
        created += 1

    print(f"\n📊 النتيجة: {created} حساب جديد | {skipped} موجود بالفعل")


# ─── Phase 3: Import Attendance Records ───────────────────────────────────────

def import_attendance(device_to_emp: dict):
    """
    Read attendance_records.csv and import into attendance collection.
    Groups punches by (employee, date) and infers check-in/check-out.
    """
    print("\n" + "=" * 60)
    print("📅 المرحلة 3: استيراد سجلات الحضور")
    print("=" * 60)

    csv_path = os.path.normpath(ATTENDANCE_CSV)
    if not os.path.exists(csv_path):
        print(f"❌ ملف الحضور غير موجود: {csv_path}")
        return

    # Also build a reverse mapping from biometric_id → employee data
    # for employees that were already in the DB before the import
    all_employees_with_bio = list(employees_col().find({"biometric_id": {"$exists": True}}))
    bio_to_emp_data = {}
    for emp in all_employees_with_bio:
        bio_to_emp_data[emp["biometric_id"]] = emp

    # Also use the device_to_emp mapping
    for device_id, emp_id in device_to_emp.items():
        if device_id not in bio_to_emp_data:
            emp = employees_col().find_one({"employee_id": emp_id})
            if emp:
                bio_to_emp_data[device_id] = emp

    # Step 1: Read all punches and group by (device_id, date)
    punches = defaultdict(list)  # (device_id, date_str) → [time_str, ...]
    total_rows = 0
    skipped_rows = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            device_id_str = row.get("رقم الموظف", "").strip()
            timestamp_str = row.get("الوقت", "").strip()

            if not device_id_str or not timestamp_str:
                continue

            total_rows += 1
            device_id = int(device_id_str)

            # Skip unknown employees
            if device_id in SKIP_DEVICE_IDS:
                skipped_rows += 1
                continue

            # Skip if no employee mapping
            if device_id not in bio_to_emp_data:
                skipped_rows += 1
                continue

            # Parse timestamp: "2025-07-13 17:11:02"
            try:
                dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                date_str = dt.strftime("%Y-%m-%d")
                time_str = dt.strftime("%H:%M:%S")
                punches[(device_id, date_str)].append(time_str)
            except ValueError:
                skipped_rows += 1
                continue

    print(f"  📖 قراءة {total_rows} سجل، تخطي {skipped_rows} سجل")

    # Step 2: For each (employee, date), create attendance record
    imported = 0
    already_exists = 0

    for (device_id, date_str), times in sorted(punches.items()):
        emp_data = bio_to_emp_data.get(device_id)
        if not emp_data:
            continue

        emp_id = emp_data["employee_id"]

        # Date filtering: strict for auto-registered, buffered for manual
        reg_scan = emp_data.get("first_registration_scan")
        if reg_scan:
            # Auto-registered: strict cutoff at registration date (NO buffer)
            try:
                reg_date = datetime.fromisoformat(reg_scan).strftime("%Y-%m-%d")
                if date_str < reg_date:
                    print(f"  ⏭️ تخطي سجل {date_str} للموظف {emp_data['name']} (قبل تاريخ التسجيل: {reg_date})")
                    continue
            except (ValueError, TypeError):
                pass
        else:
            # Manually-created: use hire_date with 2-day buffer
            allowed_start_date = emp_data.get("hire_date")
            if allowed_start_date:
                try:
                    from datetime import timedelta
                    hd_dt = datetime.strptime(allowed_start_date, "%Y-%m-%d")
                    allowed_start_date = (hd_dt - timedelta(days=2)).strftime("%Y-%m-%d")
                except Exception:
                    pass

            if allowed_start_date and date_str < allowed_start_date:
                print(f"  ⏭️ تخطي سجل الحضور بتاريخ {date_str} للموظف {emp_data['name']} (قبل تاريخ التعيين: {allowed_start_date})")
                continue

        # Check if attendance already exists for this date
        if attendance_col().find_one({"employee_id": emp_id, "date": date_str}):
            already_exists += 1
            continue

        # Sort times and pick first/last
        times.sort()
        check_in = times[0]
        check_out = times[-1] if len(times) > 1 else None

        # Calculate status and hours
        status_val = "late" if is_late(check_in) else "on_time"
        hours = calc_hours(check_in, check_out) if check_out else None

        # If check_in and check_out are too close (< 5 min), treat as single punch
        if check_out and hours is not None and hours < 0.083:  # ~5 minutes
            check_out = None
            hours = None

        record = {
            "employee_id": emp_id,
            "employee_name": emp_data.get("name", ""),
            "department": emp_data.get("department", ""),
            "job_title": emp_data.get("job_title", ""),
            "date": date_str,
            "check_in": check_in,
            "check_out": check_out,
            "status": status_val,
            "hours_worked": hours,
            "notes": "استيراد من جهاز البصمة",
            "source": "biometric",
        }

        attendance_col().insert_one(record)
        imported += 1

    print(f"\n📊 النتيجة: {imported} سجل حضور جديد | {already_exists} موجود بالفعل")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("🔌 جاري الاتصال بقاعدة البيانات...")
    db = get_db()
    print(f"✅ متصل بـ: {settings.MONGODB_DB}")

    # Phase 1: Import/Update Employees
    device_to_emp = import_employees()

    # Phase 2: Create User Accounts
    create_user_accounts(device_to_emp)

    # Phase 3: Import Attendance Records
    import_attendance(device_to_emp)

    print("\n" + "=" * 60)
    print("🎉 اكتمل استيراد بيانات جهاز البصمة بنجاح!")
    print("=" * 60)

    # Final summary
    total_emps = employees_col().count_documents({"biometric_id": {"$exists": True}})
    total_attendance = attendance_col().count_documents({"source": "biometric"})
    print(f"\n📊 الإجمالي:")
    print(f"   👥 موظفين مرتبطين بجهاز البصمة: {total_emps}")
    print(f"   📅 سجلات حضور من البصمة: {total_attendance}")


if __name__ == "__main__":
    main()
