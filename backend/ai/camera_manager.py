# camera_manager.py
import cv2
import time
from urllib.parse import quote
import threading

class CameraManager:
    def __init__(self, ip, username, password, rtsp_port=554):
        self.ip = ip
        self.username = username
        self.password = password
        self.rtsp_port = rtsp_port
        self.frame = None
        self.stopped = False
        self.cap = None
        threading.Thread(target=self.update_frame, daemon=True).start()

    def get_camera_url(self) -> str:
        """Generate RTSP URL for camera"""
        encoded_username = quote(self.username)
        encoded_password = quote(self.password)
        return f"rtsp://{encoded_username}:{encoded_password}@{self.ip}:{self.rtsp_port}/Streaming/Channels/101"

    def update_frame(self):
        """Continuously update the current frame"""
        print("Connecting to camera...")
        rtsp_url = self.get_camera_url()
        self.cap = cv2.VideoCapture(rtsp_url)

        if not self.cap.isOpened():
            print("❌ Error: Could not open video stream")
            return

        while not self.stopped:
            ret, frame = self.cap.read()
            if not ret:
                print("⚠️ Failed to grab frame")
                #time.sleep(0.1)
                continue
            self.frame = frame

        self.cap.release()
    
    def get_frame(self):
        return self.frame

    def openCameraWindow(self):
        """Open camera feed window"""
        try:
            while True:
                if self.frame is not None:
                    cv2.imshow("Camera Feed", self.frame)

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
        except cv2.error as e:
            print(f"Error connecting to camera: {e}")
        finally:
            self.stopped = True
            cv2.destroyAllWindows()


# Example usage:
if __name__ == "__main__":
    camera = CameraManager("192.168.1.66", "admin", "XQAdmin@2026!")
    camera.openCameraWindow()
