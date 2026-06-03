# models.py
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import cv2
import numpy as np
from facenet_pytorch import InceptionResnetV1
from deepface import DeepFace


# -------------------------------
# MobileFaceNet (placeholder – replace with pretrained later)
# -------------------------------
# class MobileFaceNet(nn.Module):
#     def __init__(self, embedding_size=512):
#         super(MobileFaceNet, self).__init__()
#         self.fc = nn.Linear(3 * 112 * 112, embedding_size)

#     def forward(self, x):
#         x = x.view(x.size(0), -1)
#         x = F.normalize(self.fc(x))
#         return x


# class MobileFaceNetModel:
#     def __init__(self):
#         self.model = MobileFaceNet()
#         self.model.eval()
#         self.preprocess = transforms.Compose([
#             transforms.Resize((112, 112)),
#             transforms.ToTensor(),
#             transforms.Normalize([0.5], [0.5])
#         ])

#     def get_embedding(self, face_img):
#         img = Image.fromarray(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))
#         img = self.preprocess(img).unsqueeze(0)
#         with torch.no_grad():
#             embedding = self.model(img).numpy()
#         return embedding.flatten()


# -------------------------------
# FaceNet (PyTorch)
# -------------------------------
class FaceNetModel:
    def __init__(self):
        self.model = InceptionResnetV1(pretrained="vggface2").eval()
        self.preprocess = transforms.Compose([
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5])
        ])

    def get_embedding(self, face_img):
        img = Image.fromarray(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))
        img = self.preprocess(img).unsqueeze(0)
        with torch.no_grad():
            embedding = self.model(img).numpy()
        return embedding.flatten()




# class DeepFaceModel:
#     def __init__(self):
#         self.model_name = "Facenet"

#     def get_embedding(self, face_img):
#         # DeepFace.represent بيقبل numpy مباشرة
#         embedding = DeepFace.represent(
#             face_img,
#             model_name=self.model_name,
#             enforce_detection=False
#         )[0]["embedding"]
#         return np.array(embedding)
