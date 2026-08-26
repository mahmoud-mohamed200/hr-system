# app/config.py
import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB: str = os.getenv("MONGODB_DB", "hr_attendance")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "xq-hr-secret-change-in-production-2026")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

    # Company
    COMPANY_NAME: str = os.getenv("COMPANY_NAME", "XQ Pharma")
    WORK_START: str = os.getenv("WORK_START", "11:00")
    WORK_END: str = os.getenv("WORK_END", "19:00")
    LATE_THRESHOLD_MINUTES: int = int(os.getenv("LATE_THRESHOLD_MINUTES", "45"))
    WEEKEND_DAYS: list = os.getenv("WEEKEND_DAYS", "friday").lower().split(",")

    # Biometric Device
    BIOMETRIC_DEVICE_IP: str = os.getenv("BIOMETRIC_DEVICE_IP", "192.168.1.3")
    BIOMETRIC_DEVICE_PORT: int = int(os.getenv("BIOMETRIC_DEVICE_PORT", "4370"))

    # GPS Geofencing
    BRANCH_LATITUDE: float = float(os.getenv("BRANCH_LATITUDE", "30.0444"))
    BRANCH_LONGITUDE: float = float(os.getenv("BRANCH_LONGITUDE", "31.2357"))
    BRANCH_RADIUS_METERS: float = float(os.getenv("BRANCH_RADIUS_METERS", "200.0"))

    # Permission hour limit
    MONTHLY_PERMISSION_LIMIT_HOURS: float = float(os.getenv("MONTHLY_PERMISSION_LIMIT_HOURS", "4.0"))

    # Face Recognition
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "faces")
    FACENET_THRESHOLD: float = float(os.getenv("FACENET_THRESHOLD", "0.8"))

    # Camera Config
    CAMERA_CONFIG: dict = {}

    # Upload
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    FACES_DIR: str = os.getenv("FACES_DIR", "faces")

    # Email / SMTP (Gmail by default)
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "mahmoudb612@gmail.com")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    MANAGER_NOTIF_EMAILS: str = os.getenv("MANAGER_NOTIF_EMAILS", "mahmoudb612@gmail.com")


    def __init__(self):
        # Build camera config from env
        cam_count = int(os.getenv("CAM_COUNT", "3"))
        for i in range(1, cam_count + 1):
            self.CAMERA_CONFIG[f"cam{i}"] = {
                "ip": os.getenv(f"CAM{i}_IP", f"192.168.1.{68 - i}"),
                "user": os.getenv(f"CAM{i}_USER", "admin"),
                "password": os.getenv(f"CAM{i}_PASS", "XQAdmin@2026!"),
                "desc": os.getenv(f"CAM{i}_DESC", f"XQ Cam {i}"),
            }

        # Ensure directories exist
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)
        os.makedirs(self.FACES_DIR, exist_ok=True)

    def sync_from_db(self):
        """Load latest dynamic settings from MongoDB if available."""
        try:
            from app.database import settings_col
            doc = settings_col().find_one()
            if doc:
                if "company_name" in doc and doc["company_name"]:
                    self.COMPANY_NAME = doc["company_name"]
                if "work_start" in doc and doc["work_start"]:
                    self.WORK_START = doc["work_start"]
                if "work_end" in doc and doc["work_end"]:
                    self.WORK_END = doc["work_end"]
                if "late_threshold_minutes" in doc and doc["late_threshold_minutes"] is not None:
                    self.LATE_THRESHOLD_MINUTES = int(doc["late_threshold_minutes"])
                if "weekend_days" in doc and doc["weekend_days"]:
                    self.WEEKEND_DAYS = [d.lower() for d in doc["weekend_days"]]
                if "biometric_device_ip" in doc and doc["biometric_device_ip"]:
                    self.BIOMETRIC_DEVICE_IP = doc["biometric_device_ip"]
                if "biometric_device_port" in doc and doc["biometric_device_port"]:
                    self.BIOMETRIC_DEVICE_PORT = int(doc["biometric_device_port"])
        except Exception:
            pass


settings = Settings()


