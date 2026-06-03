# 🏢 XQ Attendance AI System

A premium, real-time AI-powered attendance system designed for **XQ Pharma**. This system leverages **FaceNet** for high-accuracy face recognition from live IP camera feeds and features a modern React-based management dashboard.

---

## 🏗️ Project Structure

The project is divided into two main components:

- **`/backend`**: Python-based AI engine using FastAPI, OpenCV, and FaceNet.
- **`/frontend`**: React + Vite dashboard for real-time monitoring and employee management.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🧬 **XQ-Face Recognition** | Optimized FaceNet (InceptionResnetV1) for medical-grade accuracy |
| 📹 **Multi-Stream Support** | Simultaneous processing of multiple XQ Secure IP cameras (RTSP) |
| 📊 **Modern Dashboard** | Premium React UI with live status, logs, and analytics |
| 🛡️ **Secure Auth** | Environment-based credential management via `.env` |
| 🧪 **Test/Live Modes** | Toggle between offline verification and production API calls |
| 📦 **Auto-Augmentation** | 5x data expansion (flip, bright, rotate) for robust recognition |

---

## 🚀 Getting Started

### 1. Backend Setup (AI Engine)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure your `.env` file with XQ camera credentials and API keys.
4. Build the face database (after adding images to `faces/`):
   ```bash
   python -c "from database_manager import DatabaseManager; db = DatabaseManager(); db.build_database()"
   ```
5. Run the engine:
   ```bash
   python main.py
   ```

### 2. Frontend Setup (Dashboard)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

---

## ⚙️ Configuration

Key settings in `backend/config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `FACENET_THRESHOLD` | `0.8` | Match strictness (lower = more precise) |
| `DATABASE_PATH` | `faces` | Employee image repository |
| `TEST_MODE` | From `.env` | Enable/Disable production API calls |

---

## 🔒 Security

- All sensitive data (IPs, passwords, API keys) are stored in `backend/.env`.
- Ensure `.env` is never committed to shared repositories.
- Camera streams are handled over secure RTSP protocols.

---

## 🛠️ Built With

- **Backend**: Python, OpenCV, FaceNet (PyTorch), FastAPI, Rich.
- **Frontend**: React, Vite, Vanilla CSS (XQ Design System).

---
© 2026 XQ Pharma. All rights reserved.
