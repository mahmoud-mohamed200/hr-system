# test_zk_conn.py
import sys
try:
    from zk import ZK
    print("✅ ZK is installed!")
    zk = ZK('192.168.1.3', port=4370, timeout=5)
    conn = zk.connect()
    print("✅ Connected successfully!")
    print(f"Device Name: {conn.get_device_name()}")
    conn.disconnect()
    print("✅ Disconnected successfully!")
except Exception as e:
    print(f"❌ Error: {e}")
