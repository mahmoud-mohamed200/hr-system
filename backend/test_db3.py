from app.services.encryption import encrypt_data, decrypt_data
import json

payload = {"test": 123}
s = json.dumps(payload)
enc = encrypt_data(s)
print(f"Encrypted: {enc[:30]}...")
dec = decrypt_data(enc)
print(f"Decrypted: {dec}")

