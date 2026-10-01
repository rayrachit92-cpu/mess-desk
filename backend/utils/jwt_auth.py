"""
JWT issuance/verification. The owner_id inside a *validated* token is the
ONLY source of truth for "who is making this request" — nothing from the
request body or query string is ever trusted for identity.
"""
import os
import time
import uuid
import jwt  # PyJWT

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    # Dev-only fallback so the app boots without manual setup. In production
    # this MUST be set via environment variable / secrets manager and never
    # committed to source control.
    JWT_SECRET = "dev-only-insecure-secret-change-me"

JWT_ALGO = "HS256"
ACCESS_TOKEN_TTL_SECONDS = 60 * 60          # 1 hour
REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _issue(owner_id: int, token_type: str, ttl: int) -> str:
    now = int(time.time())
    payload = {
        "sub": owner_id,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,  # unique id so logout can revoke this exact token
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def issue_access_token(owner_id: int) -> str:
    return _issue(owner_id, "access", ACCESS_TOKEN_TTL_SECONDS)


def issue_refresh_token(owner_id: int) -> str:
    return _issue(owner_id, "refresh", REFRESH_TOKEN_TTL_SECONDS)


def decode_token(token: str, expected_type: str = "access"):
    """Returns payload dict or raises jwt exceptions on invalid/expired token."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload
