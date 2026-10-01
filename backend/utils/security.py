"""
Password hashing (stdlib only — no network-installed deps needed).

Uses scrypt when the Python build supports it; falls back to PBKDF2-HMAC-SHA256
on platforms where hashlib.scrypt is unavailable (common on macOS Python 3.9).

If you later `pip install argon2-cffi`, swap `hash_password` / `verify_password`
for argon2.PasswordHasher — the public interface stays the same.
"""
import hashlib
import hmac
import os
import secrets

SCRYPT_N = 2 ** 14   # CPU/memory cost
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LEN = 64
PBKDF2_ITERATIONS = 600_000


def _scrypt(password: bytes, salt: bytes, dklen: int, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P) -> bytes:
    return hashlib.scrypt(password, salt=salt, n=n, r=r, p=p, dklen=dklen)


def hash_password(password: str) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    salt = os.urandom(16)
    if hasattr(hashlib, "scrypt"):
        derived = _scrypt(password.encode("utf-8"), salt=salt, dklen=KEY_LEN)
        return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${derived.hex()}"
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS, dklen=KEY_LEN
    )
    return f"pbkdf2$sha256${PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split("$")
        algo = parts[0]
        if algo == "scrypt":
            if not hasattr(hashlib, "scrypt"):
                return False
            _, n, r, p, salt_hex, hash_hex = parts
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(hash_hex)
            derived = _scrypt(
                password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
            )
            return hmac.compare_digest(derived, expected)
        if algo == "pbkdf2":
            _, digest, iterations, salt_hex, hash_hex = parts
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(hash_hex)
            derived = hashlib.pbkdf2_hmac(
                digest, password.encode("utf-8"), salt, int(iterations), dklen=len(expected)
            )
            return hmac.compare_digest(derived, expected)
        return False
    except (ValueError, AttributeError):
        return False


def generate_token() -> str:
    """Random URL-safe token for password reset, etc."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Store only a hash of reset tokens, never the raw token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
