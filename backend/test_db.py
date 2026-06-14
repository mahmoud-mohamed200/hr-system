import sys
import json
from app.database import payrolls_col
from app.services.encryption import decrypt_data
import pymongo

from bson import ObjectId

rec = payrolls_col().find_one({"_id": ObjectId("6a26b447c34cc980852069be")})
if rec:
    enc = rec.get("encrypted_data")
    print(f"Encrypted data: {enc[:50]}... length: {len(enc)}")
    dec = decrypt_data(enc)
    print(f"Decrypted data: {dec[:50]}... length: {len(dec)}")
else:
    print("Record not found")

