# recognizer.py
import numpy as np
from config import FACENET_THRESHOLD, DEEPFACE_THRESHOLD, MOBILEFACENET_THRESHOLD

class MultiModelFaceRecognizer:
    def __init__(self, embeddings, facenet):#, deepface, mobilefacenet):
        self.embeddings = embeddings
        self.facenet = facenet
        # self.deepface = deepface
        # self.mobilefacenet = mobilefacenet

    def recognize(self, face_img):
        results = {}

        # FaceNet
        emb_face = self.facenet.get_embedding(face_img)
        results["facenet"] = self._match(emb_face, self.embeddings["facenet"], FACENET_THRESHOLD)

        # # DeepFace
        # emb_face = self.deepface.get_embedding(face_img)
        # results["deepface"] = self._match(emb_face, self.embeddings["deepface"], DEEPFACE_THRESHOLD)

        # MobileFaceNet
        # emb_face = self.mobilefacenet.get_embedding(face_img)
        # results["mobilefacenet"] = self._match(emb_face, self.embeddings["mobilefacenet"], MOBILEFACENET_THRESHOLD)
        # # print("Recognition results:", results)
        return results

    def _match(self, emb_face, db, threshold):
        best_match, best_dist = "Unknown", float("inf")
        for name, emb_list in db.items():
            for db_emb in emb_list:
                dist = np.linalg.norm(emb_face - db_emb)
                if dist < best_dist:
                    best_dist, best_match = dist, name
        return (best_match if best_dist < threshold else "Unknown", best_dist)
