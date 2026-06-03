# ai/recognition_loop.py
"""Main Multi-Camera Face Recognition & Attendance Loop connected to MongoDB."""

import os
import sys
import cv2
import time
import logging
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

# Add parent directory to path to import app config and database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db, employees_col, attendance_col, settings_col
from app.config import settings
from ai.models import FaceNetModel
from ai.recognizer import MultiModelFaceRecognizer
from ai.camera_manager import CameraManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

welcome_messages = {}  # Map email -> (message, until_time)
api_executor = ThreadPoolExecutor(max_workers=5)


def _get_today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _get_current_time_str() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _is_late(check_in_time: str) -> bool:
    try:
        work_start = datetime.strptime(settings.WORK_START, "%H:%M")
        threshold = work_start + timedelta(minutes=settings.LATE_THRESHOLD_MINUTES)
        actual = datetime.strptime(check_in_time, "%H:%M:%S")
        return actual.time() > threshold.time()
    except Exception:
        return False


def mark_attendance_in_db(email: str):
    """Mark attendance directly in MongoDB for the recognized employee."""
    global welcome_messages
    today = _get_today_str()

    try:
        # 1. Fetch employee details from MongoDB
        emp = employees_col().find_one({"email": email})
        if not emp:
            logging.warning(f"⚠️ Recognized email '{email}' has no profile in MongoDB.")
            return

        # 2. Check if already checked in today
        existing = attendance_col().find_one({"employee_id": emp["employee_id"], "date": today})
        if existing and existing.get("check_in"):
            # Already checked in, show welcome message and skip
            welcome_messages[email] = (f"Hello, {emp['name']}!", time.time() + 2)
            return

        # 3. Create check-in record
        now_time = _get_current_time_str()
        status_val = "late" if _is_late(now_time) else "on_time"

        record = {
            "employee_id": emp["employee_id"],
            "employee_name": emp["name"],
            "department": emp.get("department", ""),
            "job_title": emp.get("job_title", ""),
            "date": today,
            "check_in": now_time,
            "check_out": None,
            "status": status_val,
            "hours_worked": None,
            "notes": "Checked in via Face Recognition camera",
            "source": "camera",
        }

        attendance_col().update_one(
            {"employee_id": emp["employee_id"], "date": today},
            {"$setOnInsert": record},
            upsert=True
        )

        logging.info(f"✅ Attendance marked for {emp['name']} ({email}) at {now_time} - Status: {status_val}")
        welcome_messages[email] = (f"Welcome, {emp['name']}!", time.time() + 3)

    except Exception as e:
        logging.error(f"Error marking attendance for {email}: {e}")


def load_embeddings_from_faces_dir(facenet_model):
    """Scan faces/ folder, calculate embeddings and return them."""
    embeddings = {"facenet": {}}
    faces_dir = settings.FACES_DIR
    
    if not os.path.exists(faces_dir):
        os.makedirs(faces_dir, exist_ok=True)
        return embeddings

    logging.info(f"📦 Scanning faces directory: {faces_dir}")
    for email_folder in os.listdir(faces_dir):
        folder_path = os.path.join(faces_dir, email_folder)
        if not os.path.isdir(folder_path):
            continue

        embeddings["facenet"][email_folder] = []
        for img_name in os.listdir(folder_path):
            img_path = os.path.join(folder_path, img_name)
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            try:
                emb = facenet_model.get_embedding(img)
                embeddings["facenet"][email_folder].append(emb)
            except Exception as e:
                logging.error(f"Error getting embedding for {img_name}: {e}")
                
        logging.info(f"Loaded {len(embeddings['facenet'][email_folder])} face embeddings for {email_folder}")

    return embeddings


def run_recognition():
    logging.info("📷 Initializing Face Recognition AI Engine...")
    global welcome_messages

    # Make sure we trigger database connection
    get_db()

    facenet = FaceNetModel()
    embeddings = load_embeddings_from_faces_dir(facenet)

    if not embeddings["facenet"]:
        logging.warning("⚠️ No face photos found in faces/ directory. Please upload photos for training.")

    recognizer = MultiModelFaceRecognizer(embeddings, facenet)

    cameras = {}
    for cam_id, config in settings.CAMERA_CONFIG.items():
        logging.info(f"Connecting to {config['desc']}...")
        cameras[cam_id] = {
            "manager": CameraManager(config['ip'], config['user'], config['password']),
            "desc": config['desc']
        }

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    try:
        while True:
            for cam_id, cam_data in cameras.items():
                camera = cam_data["manager"]
                cam_desc = cam_data["desc"]

                try:
                    frame = camera.get_frame()
                    if frame is None or frame.size == 0:
                        continue

                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))

                    for (x, y, w, h) in faces:
                        face_img = frame[y:y+h, x:x+w]
                        
                        try:
                            results = recognizer.recognize(face_img)
                        except Exception:
                            continue

                        names = [r[0] for r in results.values() if r[0] != "Unknown"]
                        recognized_email = max(set(names), key=names.count) if names else "Unknown"

                        if recognized_email != "Unknown":
                            # Mark attendance asynchronously in thread pool
                            api_executor.submit(mark_attendance_in_db, recognized_email)
                            display_name = recognized_email.split('@')[0]
                        else:
                            display_name = "Unknown"

                        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                        cv2.putText(frame, display_name, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                    # Show overlay welcome messages
                    now = time.time()
                    active_msgs = [msg for email, (msg, until) in welcome_messages.items() if now < until]
                    if active_msgs:
                        msg = active_msgs[-1]
                        cv2.putText(frame, msg, (50, frame.shape[0] - 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)

                    cv2.imshow(f"Camera - {cam_desc}", frame)

                except Exception as e:
                    continue

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        for cam_data in cameras.values():
            cam_data["manager"].stopped = True
        cv2.destroyAllWindows()


if __name__ == "__main__":
    run_recognition()
