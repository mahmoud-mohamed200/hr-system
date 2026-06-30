import csv
from zk import ZK, const

# بيانات الجهاز التي قمنا باكتشافها
DEVICE_IP = '192.168.1.3'
DEVICE_PORT = 4370

conn = None
# إنشاء كائن الاتصال مع وضع مهلة زمنية (Timeout) 5 ثوانٍ
zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5, password=0, ommit_ping=True)

try:
    print(f"جاري الاتصال بالجهاز {DEVICE_IP}...")
    conn = zk.connect()
    print("تم الاتصال بنجاح! جاري تعطيل الجهاز مؤقتاً لسحب كافة البيانات...")
    conn.disable_device()
    
    # 1. سحب بيانات الجهاز العامة
    print("جاري سحب معلومات الجهاز العامة...")
    device_name = conn.get_device_name()
    serial_number = conn.get_serialnumber()
    mac_address = conn.get_mac()
    firmware_version = conn.get_firmware_version()
    fp_version = conn.get_fp_version()
    platform = conn.get_platform()
    try:
        face_version = conn.get_face_version()
    except Exception:
        face_version = "غير مدعوم"
        
    device_info_file = 'device_info.txt'
    with open(device_info_file, mode='w', encoding='utf-8') as f:
        f.write("معلومات جهاز البصمة:\n")
        f.write("----------------------\n")
        f.write(f"اسم الجهاز: {device_name}\n")
        f.write(f"الرقم التسلسلي (Serial): {serial_number}\n")
        f.write(f"عنوان الماك (MAC): {mac_address}\n")
        f.write(f"إصدار النظام (Firmware): {firmware_version}\n")
        f.write(f"إصدار بصمة الأصبع (FP): {fp_version}\n")
        f.write(f"إصدار بصمة الوجه (Face): {face_version}\n")
        f.write(f"نوع المنصة (Platform): {platform}\n")
        
    print(f"تم حفظ معلومات الجهاز في {device_info_file}")

    # 2. سحب بيانات المستخدمين (الموظفين) لبناء خريطة بالأسماء وتصديرهم
    print("جاري سحب قائمة الموظفين...")
    users = conn.get_users()
    user_map = {user.user_id: user.name.strip() if user.name else "غير معروف" for user in users}
    
    users_file = 'users_list.csv'
    with open(users_file, mode='w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['رقم الموظف (user_id)', 'رقم الـ UID', 'الاسم', 'الصلاحية', 'رقم الكارت', 'كلمة المرور', 'المجموعة'])
        for user in users:
            writer.writerow([user.user_id, user.uid, user.name.strip() if user.name else "غير معروف", user.privilege, user.card, user.password, user.group_id])
            
    print(f"تم حفظ قائمة الموظفين ({len(users)}) في {users_file}")

    # 3. سحب جميع حركات البصمة
    print("جاري سحب حركات البصمة...")
    attendance = conn.get_attendance()
    
    csv_file = 'attendance_records.csv'
    with open(csv_file, mode='w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['رقم الموظف', 'الاسم', 'الوقت', 'الحالة'])
        for log in attendance:
            name = user_map.get(log.user_id, "غير معروف")
            writer.writerow([log.user_id, name, log.timestamp, log.status])
            
    print(f"تم سحب ({len(attendance)}) حركة بصمة وحفظها في {csv_file}")
    
    # طباعة أول 5 حركات للتأكيد في الشاشة
    print("\nعرض عينة من الحركات (أول 5 حركات):")
    for log in attendance[:5]:
        name = user_map.get(log.user_id, "غير معروف")
        print(f"رقم الموظف: {log.user_id} | الاسم: {name} | الوقت: {log.timestamp} | الحالة: {log.status}")

    conn.enable_device()
    
except Exception as e:
    print(f"حدث خطأ أثناء الاتصال أو سحب البيانات: {e}")
finally:
    if conn:
        conn.disconnect()
        print("تم قطع الاتصال بالجهاز بأمان.")