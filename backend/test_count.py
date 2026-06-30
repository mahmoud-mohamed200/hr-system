import sys
from datetime import datetime, date, timedelta
from app.database import attendance_col
from app.routes.dashboard import calculate_calendar_absent_days, get_egyptian_holidays

print(f"Current local time: {datetime.now()}")
print(f"Holidays in 2026: {get_egyptian_holidays(2026)}")
cnt = calculate_calendar_absent_days("EMP-0017", "2026-06")
print(f"Dynamic absent days for EMP-0017: {cnt}")

# Let's print day by day breakdown
month_str = "2026-06"
year, month = 2026, 6
import calendar
last_day = calendar.monthrange(year, month)[1]
start_date = date(year, month, 1)
end_date = date(year, month, last_day)
today_dt = datetime.now()
today_str = today_dt.strftime("%Y-%m-%d")
if month_str == today_dt.strftime("%Y-%m"):
    end_date = today_dt.date()

records = list(attendance_col().find({
    "employee_id": "EMP-0017",
    "date": {"$regex": f"^{month_str}"}
}))
records_map = {r["date"]: r for r in records}
holidays = get_egyptian_holidays(year)

print("\nBreakdown:")
current_date = start_date
while current_date <= end_date:
    date_str = current_date.strftime("%Y-%m-%d")
    is_hol = date_str in holidays
    is_we = current_date.weekday() in [4, 5]
    has_rec = date_str in records_map
    status = records_map[date_str].get("status") if has_rec else "None"
    
    classification = "Workday (Present)" if (has_rec and status != "absent") else "Weekend" if is_we else "Holiday" if is_hol else "Absent"
    print(f"Date: {date_str} ({current_date.strftime('%A')}) | Holiday: {is_hol} | Weekend: {is_we} | Has Record: {has_rec} (Status: {status}) | Classification: {classification}")
    current_date += timedelta(days=1)
