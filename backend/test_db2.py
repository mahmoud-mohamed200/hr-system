import sys
from app.database import payrolls_col
from app.services.encryption import _get_fernet
from cryptography.fernet import InvalidToken
from bson import ObjectId

rec = payrolls_col().find_one({"_id": ObjectId("6a26b447c34cc980852069be")})
if rec:
    enc = rec.get("encrypted_data")
    cipher = _get_fernet()
    try:
        dec = cipher.decrypt(enc.encode("utf-8"))
        print("Success")
    except Exception as e:
        print(f"Failed: {type(e).__name__} - {e}")
        
