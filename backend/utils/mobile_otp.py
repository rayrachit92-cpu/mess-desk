"""Mobile OTP generation, verification, and one-time tokens for student registration."""
import secrets
from datetime import datetime, timedelta

from db import get_db
from utils.security import hash_token, generate_token
from utils.sms import send_sms, is_dev_expose_codes
from utils.ratelimit import check_rate_limit, RateLimitExceeded
from utils.validation import valid_mobile, ValidationError

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
TOKEN_TTL_MINUTES = 15


def _expires_in(minutes: int) -> str:
    return (datetime.utcnow() + timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M:%S")


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def send_mobile_code(owner_id: int, raw_mobile: str) -> dict:
    try:
        mobile = valid_mobile(raw_mobile)
    except ValidationError as e:
        raise ValidationError(e.field, e.message)

    try:
        check_rate_limit(f"mobile-otp-send:{owner_id}:{mobile}", max_attempts=5, window_seconds=15 * 60)
        check_rate_limit(f"mobile-otp-send-owner:{owner_id}", max_attempts=20, window_seconds=15 * 60)
    except RateLimitExceeded:
        raise ValidationError("mobile", "Too many code requests. Please wait and try again.")

    otp = _generate_otp()
    otp_hash = hash_token(otp)
    expires_at = _expires_in(OTP_TTL_MINUTES)

    with get_db() as conn:
        conn.execute(
            """INSERT INTO mobile_verifications (owner_id, mobile, otp_hash, expires_at)
               VALUES (?, ?, ?, ?)""",
            (owner_id, mobile, otp_hash, expires_at),
        )

    message = f"Your MessDesk verification code is {otp}. Valid for {OTP_TTL_MINUTES} minutes."
    send_sms(mobile, message)

    result = {"message": f"Verification code sent to {mobile}"}
    if is_dev_expose_codes():
        result["dev_code"] = otp
    return result


def verify_mobile_code(owner_id: int, raw_mobile: str, code: str) -> dict:
    try:
        mobile = valid_mobile(raw_mobile)
    except ValidationError as e:
        raise e

    code = (code or "").strip()
    if not code or len(code) != 6 or not code.isdigit():
        raise ValidationError("code", "must be a 6-digit verification code")

    otp_hash = hash_token(code)

    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM mobile_verifications
               WHERE owner_id = ? AND mobile = ?
                 AND expires_at > datetime('now')
               ORDER BY created_at DESC LIMIT 1""",
            (owner_id, mobile),
        ).fetchone()

        if not row:
            raise ValidationError("code", "Verification code expired or not found. Request a new code.")

        if row["attempts"] >= OTP_MAX_ATTEMPTS:
            raise ValidationError("code", "Too many incorrect attempts. Request a new code.")

        if row["otp_hash"] != otp_hash:
            conn.execute(
                "UPDATE mobile_verifications SET attempts = attempts + 1 WHERE id = ?",
                (row["id"],),
            )
            raise ValidationError("code", "Incorrect verification code")

        conn.execute(
            "DELETE FROM mobile_verifications WHERE owner_id = ? AND mobile = ?",
            (owner_id, mobile),
        )

        raw_token = generate_token()
        token_hash = hash_token(raw_token)
        token_expires = _expires_in(TOKEN_TTL_MINUTES)
        conn.execute(
            """INSERT INTO mobile_verification_tokens (token_hash, owner_id, mobile, expires_at)
               VALUES (?, ?, ?, ?)""",
            (token_hash, owner_id, mobile, token_expires),
        )

    return {
        "message": "Mobile number verified",
        "verification_token": raw_token,
        "expires_in_seconds": TOKEN_TTL_MINUTES * 60,
    }


def consume_verification_token(owner_id: int, mobile: str, raw_token: str) -> bool:
    if not raw_token:
        return False
    token_hash = hash_token(raw_token)
    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM mobile_verification_tokens
               WHERE token_hash = ? AND owner_id = ? AND mobile = ?
                 AND used = 0 AND expires_at > datetime('now')""",
            (token_hash, owner_id, mobile),
        ).fetchone()
        if not row:
            return False
        conn.execute(
            "UPDATE mobile_verification_tokens SET used = 1 WHERE token_hash = ?",
            (token_hash,),
        )
    return True
