# run_all.py
"""Helper script to run both backend and frontend HR Portal components concurrently."""

import os
import sys
import time
import signal
import threading
import subprocess

# Auto-flush all logs to terminal/file
print = lambda *args, **kwargs: __builtins__.print(*args, **kwargs, flush=True)

def kill_port(port):
    """Find and terminate any process running on a specific port (macOS/Linux compatible)."""
    try:
        output = subprocess.check_output(["lsof", "-t", f"-i:{port}"]).decode().strip()
        if output:
            pids = [int(pid) for pid in output.split("\n") if pid.strip()]
            for pid in pids:
                print(f"⚙️ Port {port} is in use. Stopping process {pid}...")
                os.kill(pid, signal.SIGTERM)
            time.sleep(1.5)
    except Exception:
        pass

def stream_output(process, prefix):
    """Read and display process logs line by line."""
    try:
        for line in iter(process.stdout.readline, ''):
            if line:
                print(f"{prefix} {line.strip()}")
    except Exception:
        pass

def main():
    print("==================================================")
    print("🌟 Launching HR Portal & Intranet System")
    print("==================================================")

    # 1. Clean up existing processes running on backend and frontend ports
    print("🧹 Cleaning up old processes...")
    kill_port(8000)
    kill_port(5173)

    # 2. Run Database Seeding (Only if empty)
    print("\n🌱 الفحص: التحقق من وجود بيانات في قاعدة البيانات...")
    try:
        # Load environment variables from backend/.env manually to support Atlas and custom settings
        env_vars = {}
        env_path = os.path.join("backend", ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            env_vars[parts[0].strip()] = parts[1].strip()

        mongodb_uri = env_vars.get("MONGODB_URI", "mongodb://localhost:27017")
        # Strip potential quotes around the URI
        if mongodb_uri.startswith('"') and mongodb_uri.endswith('"'):
            mongodb_uri = mongodb_uri[1:-1]
        elif mongodb_uri.startswith("'") and mongodb_uri.endswith("'"):
            mongodb_uri = mongodb_uri[1:-1]

        mongodb_db = env_vars.get("MONGODB_DB", "hr_attendance")
        if mongodb_db.startswith('"') and mongodb_db.endswith('"'):
            mongodb_db = mongodb_db[1:-1]
        elif mongodb_db.startswith("'") and mongodb_db.endswith("'"):
            mongodb_db = mongodb_db[1:-1]

        from pymongo import MongoClient
        mongo_client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        db = mongo_client[mongodb_db]
        
        # Access a simple property to force a connection attempt
        mongo_client.server_info()
        
        if db["users"].count_documents({}) == 0:
            print("🌱 قاعدة البيانات فارغة. جاري تهيئة البيانات الافتراضية...")
            subprocess.run([sys.executable, "backend/seed.py"], check=True)
        else:
            print("💾 قاعدة البيانات تحتوي على بيانات بالفعل. تم تخطي التهيئة للحفاظ على بيانات الموظفين.")
    except Exception as e:
        print(f"⚠️ لم نتمكن من الاتصال بقاعدة البيانات للتحقق: {e}")
        print("💾 تم تخطي تهيئة قاعدة البيانات لتفادي مسح أي بيانات موجودة.")

    # 3. Start Backend server
    print("\n🚀 Starting FastAPI backend (Port 8000)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "run.py"],
        cwd="backend",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # 4. Start Frontend dev server
    print("🎨 Starting React frontend (Port 5173)...")
    # Determine cmd depending on OS (npm is a script on Windows, command on Mac)
    cmd = ["npm", "run", "dev"]
    if sys.platform == "win32":
        cmd = ["npm.cmd", "run", "dev"]
        
    frontend_proc = subprocess.Popen(
        cmd,
        cwd="frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # 5. Create background threads to stream output logs
    backend_thread = threading.Thread(target=stream_output, args=(backend_proc, "🖥️ [Backend]"), daemon=True)
    frontend_thread = threading.Thread(target=stream_output, args=(frontend_proc, "🎨 [Frontend]"), daemon=True)

    backend_thread.start()
    frontend_thread.start()

    print("\n✅ System running!")
    print("👉 Frontend: http://localhost:5173")
    print("👉 Backend API Docs: http://localhost:8000/docs")
    print("Press CTRL+C to terminate both servers...\n")

    # Keep script alive and handle graceful shutdown
    try:
        while True:
            time.sleep(1)
            # Check if any process died unexpectedly
            if backend_proc.poll() is not None:
                print("❌ Backend server stopped unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("❌ Frontend server stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n🛑 Stopping both servers...")
    finally:
        # Terminate processes
        try:
            backend_proc.terminate()
        except Exception:
            pass
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        print("👋 Goodbye!")

if __name__ == "__main__":
    main()
