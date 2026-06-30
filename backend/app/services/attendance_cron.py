# app/services/attendance_cron.py
import logging
import socket
import ipaddress
import psutil
from datetime import datetime
from app.database import employees_col, attendance_col
from app.config import settings

logger = logging.getLogger(__name__)


def is_on_same_network(device_ip: str) -> bool:
    """
    Check if the server is on the same local network subnet as the biometric device.
    Supports loopback/local references as same-network.
    """
    # 1. Resolve hostnames if device_ip is not a raw IP
    try:
        resolved_ip = socket.gethostbyname(device_ip)
    except Exception:
        resolved_ip = device_ip

    try:
        dev_ip_obj = ipaddress.ip_address(resolved_ip)
    except ValueError:
        return False

    # Loopback is always same network
    if dev_ip_obj.is_loopback:
        return True

    # 2. Iterate through all active network interfaces and check subnets
    try:
        for interface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    local_ip = addr.address
                    if local_ip == '127.0.0.1':
                        continue
                    netmask = addr.netmask or '255.255.255.0'
                    try:
                        network = ipaddress.IPv4Network(f"{local_ip}/{netmask}", strict=False)
                        if dev_ip_obj in network:
                            return True
                    except Exception:
                        pass
    except Exception as e:
        logger.error(f"Error checking network interfaces via psutil: {e}")

    # 3. Fallback check: compare first three octets of IP (assumes /24 subnet)
    try:
        dev_parts = resolved_ip.split('.')
        if len(dev_parts) == 4:
            device_prefix = ".".join(dev_parts[:3]) + "."
            
            # Check local IPs via socket hostname resolution
            try:
                hostname = socket.gethostname()
                for ip in socket.gethostbyname_ex(hostname)[2]:
                    if ip.startswith(device_prefix):
                        return True
            except Exception:
                pass
                
            # Dummy UDP socket connection to find routing source IP
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect((resolved_ip, 1))
                route_ip = s.getsockname()[0]
                s.close()
                if route_ip.startswith(device_prefix):
                    return True
            except Exception:
                pass
    except Exception:
        pass

    return False

def mark_absences_for_today():
    """
    Cron job to mark employees as absent if they have not checked in today.
    Skips weekends and special employees (e.g. CEO).
    """
    logger.info("Running daily auto-absent job...")
    
    # Skip if today is a weekend
    from app.database import settings_col
    settings_doc = settings_col().find_one()
    weekend_days = settings_doc.get("weekend_days", settings.WEEKEND_DAYS) if settings_doc else settings.WEEKEND_DAYS

    day_name = datetime.now().strftime("%A").lower()
    if day_name in weekend_days:
        logger.info(f"Today is {day_name} (weekend). Skipping auto-absent job.")
        return

    today_str = datetime.now().strftime("%Y-%m-%d")

    # Grace period check removed to allow active absence calculation.

    # Fetch all active employees, excluding CEO/special ones
    active_employees = list(employees_col().find({
        "is_active": True,
        "employee_id": {"$ne": "EMP-7777"},
        "email": {"$ne": "ceo@xqpharma.com"},
        "job_title": {"$ne": "الرئيس التنفيذي"}
    }))

    absent_count = 0
    for emp in active_employees:
        emp_id = emp.get("employee_id")
        if not emp_id:
            continue

        # Check if they have an attendance record for today
        existing_record = attendance_col().find_one({
            "employee_id": emp_id,
            "date": today_str
        })

        if not existing_record:
            # Create absent record
            record = {
                "employee_id": emp_id,
                "employee_name": emp.get("name", "Unknown"),
                "department": emp.get("department", ""),
                "job_title": emp.get("job_title", ""),
                "date": today_str,
                "check_in": None,
                "check_out": None,
                "status": "absent",
                "hours_worked": 0,
                "notes": "غياب تلقائي (نهاية اليوم)",
                "source": "system_cron",
            }
            attendance_col().insert_one(record)
            absent_count += 1
        elif existing_record.get("check_in") and not existing_record.get("check_out"):
            # They checked in but didn't check out. Default check-out at 19:00:00.
            check_in_time_str = existing_record["check_in"]
            check_out_time_str = "19:00:00"
            try:
                t_in = datetime.strptime(check_in_time_str, "%H:%M:%S")
                t_out = datetime.strptime(check_out_time_str, "%H:%M:%S")
                diff = (t_out - t_in).total_seconds() / 3600
                hours = round(max(0, diff), 2)
            except ValueError:
                hours = 0.0

            current_notes = existing_record.get("notes") or ""
            new_notes = current_notes + " | تسجيل انصراف تلقائي (19:00)" if current_notes else "تسجيل انصراف تلقائي (19:00)"
            
            attendance_col().update_one(
                {"_id": existing_record["_id"]},
                {
                    "$set": {
                        "check_out": check_out_time_str,
                        "hours_worked": hours,
                        "notes": new_notes
                    }
                }
            )

    logger.info(f"Auto-absent job finished. Marked {absent_count} employees as absent and checked-out the rest at 19:00.")


def sync_biometric_device(source: str = "cron") -> dict:
    """
    Sync attendance and employees from ZK fingerprint device.
    
    ROBUST VERSION with:
    - Biometric-ID-first identity resolution (no name/email fuzzy matching)
    - Atomic upsert operations for attendance records
    - DuplicateKeyError handling for concurrent sync safety
    - Audit logging via biometric_sync_log collection
    - first_registration_scan for distinguishing new registrations
    
    Can be called manually from API or automatically via cron.
    """
    from datetime import timezone, timedelta
    from collections import defaultdict
    from pymongo.errors import DuplicateKeyError
    from app.database import (
        employees_col, attendance_col, users_col,
        departments_col, settings_col, biometric_sync_log_col,
    )
    from app.auth import hash_password

    sync_start = datetime.now(timezone.utc)
    logger.info("🔌 Starting biometric device synchronization job (robust mode)...")
    today = datetime.now().strftime("%Y-%m-%d")
    synced_count = 0
    new_employees_added = []
    errors_list = []

    try:
        from zk import ZK
    except ImportError:
        logger.error("❌ pyzk library is not installed.")
        return {"error": "pyzk library not installed", "synced": 0}

    # ── ZK Device connection settings ──────────────────────────────────────
    settings_doc = settings_col().find_one()
    if settings_doc:
        DEVICE_IP = settings_doc.get("biometric_device_ip", settings.BIOMETRIC_DEVICE_IP)
        DEVICE_PORT = int(settings_doc.get("biometric_device_port", settings.BIOMETRIC_DEVICE_PORT))
    else:
        DEVICE_IP = settings.BIOMETRIC_DEVICE_IP
        DEVICE_PORT = settings.BIOMETRIC_DEVICE_PORT

    # Check if the device is on the same local network subnet
    if not is_on_same_network(DEVICE_IP):
        err_msg = f"السيرفر وجهاز البصمة ({DEVICE_IP}) ليسا على نفس الشبكة المحلية."
        logger.warning(f"⚠️ {err_msg}")
        errors_list.append(err_msg)
        _write_sync_log(biometric_sync_log_col(), sync_start, source,
                        synced_count, new_employees_added, errors_list)
        return {"error": err_msg, "synced": 0}

    DEFAULT_DEPARTMENT = "Operations"
    DEFAULT_JOB_TITLE = "موظف"
    DEFAULT_PASSWORD = "Xq@2026"
    SKIP_DEVICE_IDS = set()

    def clean_name(raw_name: str) -> str:
        return raw_name.replace(".", " ").strip()

    def make_email(raw_name: str) -> str:
        name_part = raw_name.strip().replace(" ", ".").lower()
        while ".." in name_part:
            name_part = name_part.replace("..", ".")
        return f"{name_part}@xqpharma.com"

    conn = None
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5, password=0, ommit_ping=True)

    try:
        conn = zk.connect()
        conn.disable_device()

        # Fetch attendance logs first so we can determine earliest scan for new registrations
        attendance_logs = conn.get_attendance()

        # Find earliest timestamp for each user in attendance logs
        earliest_punch_by_user = {}
        if attendance_logs:
            for log in attendance_logs:
                try:
                    uid = int(log.user_id)
                except (ValueError, TypeError):
                    continue
                if uid not in earliest_punch_by_user or log.timestamp < earliest_punch_by_user[uid]:
                    earliest_punch_by_user[uid] = log.timestamp

        # ══════════════════════════════════════════════════════════════════
        # PHASE 1: BIOMETRIC-ID-FIRST IDENTITY RESOLUTION
        # Resolve device users → employees using ONLY biometric_id.
        # No name/email fuzzy matching to prevent cross-user data leakage.
        # ══════════════════════════════════════════════════════════════════
        device_users = conn.get_users()
        bio_employees = {}  # device_id → employee document

        for d_user in device_users:
            try:
                device_id = int(d_user.user_id)
            except (ValueError, TypeError):
                continue

            raw_name = d_user.name.strip() if d_user.name else ""
            if device_id in SKIP_DEVICE_IDS or raw_name == "غير معروف" or not raw_name:
                continue

            display_name = clean_name(raw_name)
            email = make_email(raw_name)

            # ── BIOMETRIC-ID-FIRST LOOKUP ──────────────────────────────
            # Query ONLY by biometric_id. This is the sole identity key.
            existing = employees_col().find_one({"biometric_id": device_id})

            if existing:
                # Check if the name matches (recycled biometric ID check)
                def normalize(n: str) -> str:
                    if not n:
                        return ""
                    return "".join(n.replace(".", "").replace("-", "").replace("_", "").lower().split())
                
                device_name_normalized = normalize(display_name)
                db_name_normalized = normalize(existing.get("name", ""))
                db_device_name_normalized = normalize(existing.get("device_name", ""))
                
                if not existing.get("is_active", True) and device_name_normalized != db_name_normalized and device_name_normalized != db_device_name_normalized:
                    logger.warning(f"⚠️ Biometric ID {device_id} is reused from inactive employee. Old employee: {existing['name']}, New employee: {display_name}. Unsetting old association.")
                    employees_col().update_one(
                        {"_id": existing["_id"]},
                        {"$unset": {"biometric_id": ""}}
                    )
                    existing = None

            if existing:
                # Known employee — cache for attendance processing
                bio_employees[device_id] = existing
                logger.debug(f"✅ Resolved device {device_id} → {existing['employee_id']} ({existing['name']})")
            else:
                # ── NEW EMPLOYEE REGISTRATION ──────────────────────────
                # This device_id has never been seen. Create a new profile.
                emp_id = f"EMP-{device_id:04d}"

                # Ensure unique employee_id
                if employees_col().find_one({"employee_id": emp_id}):
                    counter = device_id + 100
                    while employees_col().find_one({"employee_id": f"EMP-{counter:04d}"}):
                        counter += 1
                    emp_id = f"EMP-{counter:04d}"

                # Ensure unique email
                if employees_col().find_one({"email": email}):
                    email = f"{raw_name.lower().replace(' ', '.').replace('..', '.')}_{device_id}@xqpharma.com"

                now_utc = datetime.now(timezone.utc).isoformat()
                earliest_punch = earliest_punch_by_user.get(device_id)
                first_reg_scan = earliest_punch.isoformat() if earliest_punch else now_utc

                new_employee = {
                    "employee_id": emp_id,
                    "name": display_name,
                    "device_name": raw_name,  # Store original device name separately
                    "email": email,
                    "phone": None,
                    "department": DEFAULT_DEPARTMENT,
                    "job_title": DEFAULT_JOB_TITLE,
                    "national_id": None,
                    "hire_date": today,
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

                try:
                    employees_col().insert_one(new_employee)
                    bio_employees[device_id] = new_employee
                    new_employees_added.append({
                        "name": display_name,
                        "employee_id": emp_id,
                        "biometric_id": device_id,
                    })
                    logger.info(f"🆕 Registered new employee: {display_name} ({emp_id}) biometric_id={device_id}")

                    # Increment department count
                    departments_col().update_one(
                        {"name": DEFAULT_DEPARTMENT},
                        {"$inc": {"employee_count": 1}},
                        upsert=True
                    )

                    # Create user login account
                    if not users_col().find_one({"email": email}):
                        new_user = {
                            "email": email,
                            "password_hash": hash_password(DEFAULT_PASSWORD),
                            "role": "employee",
                            "employee_id": emp_id,
                        }
                        users_col().insert_one(new_user)
                        logger.info(f"👤 Created user login account for: {email}")

                except DuplicateKeyError as e:
                    # Another concurrent sync already created this employee.
                    # This is expected in high-concurrency scenarios.
                    error_msg = f"⚠️ DuplicateKeyError for biometric_id={device_id}: {e}. Fetching existing record."
                    logger.warning(error_msg)
                    errors_list.append(error_msg)
                    existing = employees_col().find_one({"biometric_id": device_id})
                    if existing:
                        bio_employees[device_id] = existing

        # ══════════════════════════════════════════════════════════════════
        # PHASE 2: ATTENDANCE PROCESSING WITH STRICT DATA ISOLATION
        # Each attendance record is bound to a single employee via
        # the biometric_id → employee_id mapping established in Phase 1.
        # ══════════════════════════════════════════════════════════════════
        if not attendance_logs:
            conn.enable_device()
            logger.info("🔌 No attendance logs found on the device.")

            # Write audit log even for empty syncs
            _write_sync_log(biometric_sync_log_col(), sync_start, source,
                            synced_count, new_employees_added, errors_list)

            return {
                "message": "لا توجد سجلات حضور جديدة بالجهاز.",
                "synced": 0,
                "new_employees": new_employees_added
            }

        # Group punches by (device_id, date)
        daily_punches = defaultdict(list)
        # For manual sync, look back all time (no cutoff) to restore history. For cron, look back 30 days.
        sync_cutoff = None if source == "manual" else (datetime.now() - timedelta(days=30))

        for log in attendance_logs:
            if sync_cutoff and log.timestamp < sync_cutoff:
                continue

            log_date = log.timestamp.strftime("%Y-%m-%d")
            try:
                device_user_id = int(log.user_id)
            except (ValueError, TypeError):
                continue

            time_str = log.timestamp.strftime("%H:%M:%S")
            daily_punches[(device_user_id, log_date)].append(time_str)

        # Helper functions
        def _is_late(check_in_time: str) -> bool:
            try:
                work_start = datetime.strptime(settings.WORK_START, "%H:%M")
                threshold = work_start + timedelta(minutes=settings.LATE_THRESHOLD_MINUTES)
                actual = datetime.strptime(check_in_time, "%H:%M:%S")
                return actual.time() > threshold.time()
            except ValueError:
                return False

        def _calc_hours(check_in: str, check_out: str) -> float:
            try:
                t_in = datetime.strptime(check_in, "%H:%M:%S")
                t_out = datetime.strptime(check_out, "%H:%M:%S")
                diff = (t_out - t_in).total_seconds() / 3600
                return round(max(0, diff), 2)
            except ValueError:
                return 0.0

        def _is_date_allowed(date_str: str, emp_doc: dict) -> bool:
            """
            Check if an attendance record date is allowed for this employee.
            
            For AUTO-REGISTERED employees (have first_registration_scan):
              → Only allow records from the registration DATE onward (NO buffer).
              → This prevents old device logs from a reused biometric_id leaking in.
            
            For MANUALLY-CREATED employees (no first_registration_scan):
              → Allow records from hire_date - 2 days onward (buffer for late registration).
            """
            # Auto-registered: use first_registration_scan date as strict cutoff
            reg_scan = emp_doc.get("first_registration_scan")
            if reg_scan:
                try:
                    reg_date = datetime.fromisoformat(reg_scan).strftime("%Y-%m-%d")
                    record_date = datetime.strptime(date_str, "%Y-%m-%d")
                    cutoff_date = datetime.strptime(reg_date, "%Y-%m-%d")
                    return record_date >= cutoff_date
                except (ValueError, TypeError):
                    pass

            # Manually-created: use hire_date with 2-day buffer
            hire_date_str = emp_doc.get("hire_date")
            if not hire_date_str:
                return True
            try:
                record_date = datetime.strptime(date_str, "%Y-%m-%d")
                hire_date = datetime.strptime(hire_date_str, "%Y-%m-%d")
                allowed_start = hire_date - timedelta(days=2)
                return record_date >= allowed_start
            except (ValueError, TypeError):
                return True

        # ── Process attendance with atomic upserts ─────────────────────
        for (device_id, date_str), times in sorted(daily_punches.items()):
            # STRICT ISOLATION: Only resolve via biometric_id mapping
            emp = bio_employees.get(device_id)
            if not emp:
                # No mapping → skip entirely. Never guess.
                continue

            emp_id = emp["employee_id"]
            if emp_id == "EMP-7777" or emp.get("job_title") == "الرئيس التنفيذي":
                continue

            # Date filtering: strict for auto-registered, buffered for manual
            # Bypassed when source is 'manual' to restore historical logs
            if source != "manual" and not _is_date_allowed(date_str, emp):
                logger.info(f"⏭️ Skipped attendance on {date_str} for {emp['name']} (before allowed date cutoff)")
                continue

            # Sort punches and extract check-in / check-out
            times.sort()
            check_in = times[0]
            check_out = times[-1] if len(times) > 1 else None

            status_val = "late" if _is_late(check_in) else "on_time"
            hours = _calc_hours(check_in, check_out) if check_out else None

            if check_out and hours is not None and hours < 0.083:
                check_out = None
                hours = None

            # ── ATOMIC UPSERT for attendance ───────────────────────────
            # Uses find_one_and_update to prevent race conditions between
            # concurrent sync operations.
            existing = attendance_col().find_one({"employee_id": emp_id, "date": date_str})

            if existing:
                updated_fields = {}

                if existing.get("source") == "biometric":
                    # Full update for biometric-sourced records
                    if existing.get("check_in") != check_in:
                        updated_fields["check_in"] = check_in
                        updated_fields["status"] = status_val
                    if existing.get("check_out") != check_out:
                        updated_fields["check_out"] = check_out
                        updated_fields["hours_worked"] = hours
                else:
                    # For manual/gps/camera records, only fill missing data
                    if not existing.get("check_in") and check_in:
                        updated_fields["check_in"] = check_in
                        updated_fields["status"] = status_val
                    if not existing.get("check_out") and check_out:
                        updated_fields["check_out"] = check_out
                        actual_check_in = existing.get("check_in") or check_in
                        updated_fields["hours_worked"] = _calc_hours(actual_check_in, check_out)

                if updated_fields:
                    attendance_col().update_one({"_id": existing["_id"]}, {"$set": updated_fields})
                    synced_count += 1
                    logger.info(f"🔄 Updated attendance: {emp['name']} on {date_str} - {updated_fields}")
                continue

            # New attendance record — insert with atomic operation
            record = {
                "employee_id": emp_id,
                "employee_name": emp["name"],
                "department": emp.get("department", ""),
                "job_title": emp.get("job_title", ""),
                "date": date_str,
                "check_in": check_in,
                "check_out": check_out,
                "status": status_val,
                "hours_worked": hours,
                "notes": "مزامنة من جهاز البصمة",
                "source": "biometric",
            }

            try:
                attendance_col().insert_one(record)
                synced_count += 1
                logger.info(f"📅 Synced attendance: {emp['name']} on {date_str} ({status_val})")
            except DuplicateKeyError:
                # Another concurrent sync already inserted this record
                logger.warning(f"⚠️ Attendance record already exists: {emp_id} on {date_str} (concurrent sync)")

        conn.enable_device()

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Error during biometric synchronization: {error_msg}")
        errors_list.append(error_msg)
        if conn:
            try:
                conn.enable_device()
            except Exception:
                pass

        # Write audit log even on failure
        _write_sync_log(biometric_sync_log_col(), sync_start, source,
                        synced_count, new_employees_added, errors_list)

        return {"error": error_msg, "synced": 0}
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

    # ══════════════════════════════════════════════════════════════════
    # PHASE 3: AUDIT LOGGING
    # ══════════════════════════════════════════════════════════════════
    _write_sync_log(biometric_sync_log_col(), sync_start, source,
                    synced_count, new_employees_added, errors_list)

    logger.info(f"🔌 Biometric sync completed. Synced {synced_count} records. Added {len(new_employees_added)} new employees.")

    msg = f"تمت المزامنة بنجاح! تم سحب {synced_count} حركة حضور خلال الـ 30 يومًا الماضية."
    if new_employees_added:
        names = ", ".join([e["name"] for e in new_employees_added])
        msg += f" وتم إضافة موظفين جدد تلقائيًا: {names}."

    return {
        "message": msg,
        "synced": synced_count,
        "new_employees": new_employees_added
    }


def _write_sync_log(log_col, sync_start, source, synced_count, new_employees, errors):
    """Write an audit log entry for a biometric sync run."""
    from datetime import timezone
    try:
        log_col.insert_one({
            "sync_started_at": sync_start.isoformat(),
            "sync_completed_at": datetime.now(timezone.utc).isoformat(),
            "source": source,
            "records_synced": synced_count,
            "new_employees_count": len(new_employees),
            "new_employees": new_employees,
            "errors": errors,
        })
    except Exception as e:
        logger.error(f"❌ Failed to write sync audit log: {e}")

