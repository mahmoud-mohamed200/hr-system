# app/services/encryption.py
"""Encryption service for securing sensitive personal and financial data."""

import base64
import hashlib
from typing import Optional, Union
from cryptography.fernet import Fernet
from app.config import settings

_fernet_instance = None

def _get_fernet() -> Fernet:
    """Get or create the Fernet cipher instance."""
    global _fernet_instance
    if _fernet_instance is None:
        # Derive a 32-byte key deterministically from settings.JWT_SECRET
        key_bytes = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(key_bytes)
        _fernet_instance = Fernet(key)
    return _fernet_instance


def encrypt_data(data: Optional[Union[str, int, float]]) -> Optional[str]:
    """Encrypt a value to a secure string representation."""
    if data is None or data == "":
        return None
    try:
        cipher = _get_fernet()
        data_str = str(data)
        encrypted_bytes = cipher.encrypt(data_str.encode("utf-8"))
        return encrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"Encryption error: {e}")
        return str(data)


def decrypt_data(encrypted_str: Optional[str]) -> Optional[str]:
    """Decrypt an encrypted string back to its original string representation."""
    if encrypted_str is None or encrypted_str == "":
        return None
    try:
        cipher = _get_fernet()
        decrypted_bytes = cipher.decrypt(encrypted_str.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        # If decryption fails, it might be unencrypted legacy data
        # Return as is for backward compatibility
        return encrypted_str


def decrypt_float(encrypted_str: Optional[str]) -> Optional[float]:
    """Decrypt an encrypted string and convert to float."""
    decrypted = decrypt_data(encrypted_str)
    if decrypted is None or decrypted == "":
        return None
    try:
        return float(decrypted)
    except ValueError:
        return None
