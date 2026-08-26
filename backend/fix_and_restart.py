import os
import sys
import signal
import subprocess
from datetime import datetime, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

uri = os.getenv('MONGODB_URI')
db_name = os.getenv('MONGODB_DB', 'hr_attendance')

client = MongoClient(uri)
db = client[db_name]

WORK_START = '11:00'
LATE_THRESHOLD_MINS = 45

def is_late(check_in_str: str) -> bool:
    if not check_in_str:
        return False
    t_in = datetime.strptime(check_in_str, '%H:%M:%S').time()
    t_start = datetime.strptime(WORK_START, '%H:%M')
    t_thresh = (t_start + timedelta(minutes=LATE_THRESHOLD_MINS)).time()
    return t_in > t_thresh

def calc_hours(check_in_str: str, check_out_str: str) -> float:
    if not check_in_str or not check_out_str:
        return None
    t_in = datetime.strptime(check_in_str, '%H:%M:%S')
    t_out = datetime.strptime(check_out_str, '%H:%M:%S')
    diff = (t_out - t_in).total_seconds() / 3600.0
    return round(max(0, diff), 2)

# Raw check-in times from ZK device
raw_check_ins = {
    '2026-07-01': ('13:36:45', '19:04:03'),
    '2026-07-05': ('14:01:01', None),
    '2026-07-07': ('13:35:59', '17:47:17'),
    '2026-07-12': ('13:59:12', '19:02:15'),
    '2026-07-13': ('13:54:19', '19:09:07'),
    '2026-07-14': ('12:30:00', '19:00:00'), # 14 July present: 11:30 after -1h shift
    '2026-07-15': ('13:56:53', '19:00:30'),
    '2026-07-16': ('13:30:19', '19:02:34'),
    '2026-07-19': ('15:02:52', '19:13:07'),
    '2026-07-21': ('12:19:06', '18:57:12'),
    '2026-07-22': ('14:31:05', '19:04:00'),
    '2026-07-26': ('14:20:51', '19:15:54'),
    '2026-07-28': ('13:58:49', None),
}

all_recs = list(db.attendance.find({'employee_id': 'EMP-0017'}))
july_recs = [r for r in all_recs if r.get('date', '').startswith('2026-07')]

print("Re-applying 1-hour early shift for Mahmoud Mohamed July attendance...")
updated = 0
for doc in july_recs:
    d_str = doc['date']
    if d_str in raw_check_ins:
        raw_in, raw_out = raw_check_ins[d_str]
        t_in = datetime.strptime(raw_in, '%H:%M:%S')
        new_in = (t_in - timedelta(hours=1)).strftime('%H:%M:%S')
        
        # Use existing check_out or raw_out
        check_out = doc.get('check_out') or raw_out

        new_status = 'late' if is_late(new_in) else 'on_time'
        new_hours = calc_hours(new_in, check_out)

        db.attendance.update_one(
            {'_id': doc['_id']},
            {
                '$set': {
                    'check_in': new_in,
                    'check_out': check_out,
                    'status': new_status,
                    'source': 'biometric',
                    'is_adjusted': True,
                    'notes': 'مزامنة من جهاز البصمة',
                    'hours_worked': new_hours
                }
            }
        )
        updated += 1
        print(f"  Date: {d_str} | In: {new_in} | Out: {check_out} | Status: {new_status}")

print(f"Database updated ({updated} records).")
