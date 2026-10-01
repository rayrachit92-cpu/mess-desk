from flask import Blueprint, request, jsonify, g
import jwt as pyjwt

from db import get_db
from utils.security import hash_password, verify_password, generate_token, hash_token
from utils.jwt_auth import issue_access_token, issue_refresh_token, decode_token
from utils.ratelimit import check_rate_limit, RateLimitExceeded
from utils.validation import valid_name, valid_email, valid_mobile, valid_password, valid_amount, normalize_mobile, ValidationError
from utils.audit import write_audit_log
from utils.auth_guard import require_auth

bp = Blueprint("auth", __name__, url_prefix="/auth")

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 15 * 60


def client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"


def normalize_login_identifier(raw: str) -> str:
    raw = (raw or "").strip()
    if "@" in raw:
        return raw.lower()
    normalized = normalize_mobile(raw)
    return normalized if normalized else raw.replace(" ", "").replace("-", "")


def mobile_lookup_values(mobile: str) -> list:
    """Match stored mobiles whether user typed 9876543210, +91…, or 91…."""
    normalized = normalize_mobile(mobile)
    if normalized:
        return list({normalized, f"+91{normalized}", f"91{normalized}", f"+{normalized}"})
    base = mobile.lstrip("+").replace(" ", "").replace("-", "")
    return list({mobile, base, f"+{base}", f"91{base}", f"+91{base}"})


@bp.post("/register")
def register():
    try:
        check_rate_limit(f"register:{client_ip()}", max_attempts=5, window_seconds=60 * 60)
    except RateLimitExceeded as e:
        return jsonify({"error": "Too many registration attempts. Try again later."}), 429

    data = request.get_json(silent=True) or {}
    try:
        owner_name = valid_name(data.get("owner_name"), "owner_name")
        mess_name = valid_name(data.get("mess_name"), "mess_name", max_len=150)
        mobile = valid_mobile(data.get("mobile"))
        email = valid_email(data.get("email"))
        password = valid_password(data.get("password"))
        fee_one_time = valid_amount(data.get("fee_one_time"), "fee_one_time")
        fee_two_time = valid_amount(data.get("fee_two_time"), "fee_two_time")
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    password_hash = hash_password(password)

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM owners WHERE email = ? OR mobile = ?", (email, mobile)
        ).fetchone()
        if existing:
            # Generic message - do not reveal which field collided (enumeration protection)
            return jsonify({"error": "An account with these details already exists"}), 409

        cur = conn.execute(
            """INSERT INTO owners (owner_name, mess_name, mobile, email, password_hash,
               fee_one_time, fee_two_time)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (owner_name, mess_name, mobile, email, password_hash, fee_one_time, fee_two_time),
        )
        owner_id = cur.lastrowid
        write_audit_log(conn, owner_id, "OWNER_REGISTERED", "owner", owner_id)

    return jsonify({
        "message": "Registration successful",
        "owner": {"owner_name": owner_name, "mess_name": mess_name, "email": email},
    }), 201


@bp.post("/login")
def login():
    ip = client_ip()
    data = request.get_json(silent=True) or {}
    identifier = normalize_login_identifier(data.get("email_or_mobile"))
    password = data.get("password") or ""

    try:
        check_rate_limit(f"login-ip:{ip}", max_attempts=20, window_seconds=LOGIN_WINDOW_SECONDS)
        check_rate_limit(f"login-id:{identifier}", max_attempts=LOGIN_MAX_ATTEMPTS,
                          window_seconds=LOGIN_WINDOW_SECONDS)
    except RateLimitExceeded as e:
        return jsonify({"error": "Too many login attempts. Please try again later."}), 429

    generic_error = ("Invalid credentials", 401)

    if not identifier or not password:
        return jsonify({"error": generic_error[0]}), generic_error[1]

    with get_db() as conn:
        if "@" in identifier:
            owner = conn.execute(
                "SELECT * FROM owners WHERE email = ?", (identifier,)
            ).fetchone()
        else:
            values = mobile_lookup_values(identifier)
            placeholders = ", ".join("?" * len(values))
            owner = conn.execute(
                f"SELECT * FROM owners WHERE mobile IN ({placeholders})", values
            ).fetchone()

        success = owner is not None and verify_password(password, owner["password_hash"])
        conn.execute(
            "INSERT INTO login_attempts (identifier, ip_address, success) VALUES (?, ?, ?)",
            (identifier, ip, 1 if success else 0),
        )

        if not success:
            return jsonify({"error": generic_error[0]}), generic_error[1]

        write_audit_log(conn, owner["id"], "LOGIN_SUCCESS", "owner", owner["id"])

    access_token = issue_access_token(owner["id"])
    refresh_token = issue_refresh_token(owner["id"])

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "owner": {
            "owner_name": owner["owner_name"],
            "mess_name": owner["mess_name"],
            "email": owner["email"],
        },
    })


@bp.post("/refresh")
def refresh():
    data = request.get_json(silent=True) or {}
    token = data.get("refresh_token")
    if not token:
        return jsonify({"error": "refresh_token is required"}), 400
    try:
        payload = decode_token(token, expected_type="refresh")
    except pyjwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token expired, please log in again"}), 401
    except pyjwt.InvalidTokenError:
        return jsonify({"error": "Invalid refresh token"}), 401

    with get_db() as conn:
        revoked = conn.execute(
            "SELECT 1 FROM revoked_tokens WHERE jti = ?", (payload["jti"],)
        ).fetchone()
    if revoked:
        return jsonify({"error": "Refresh token has been revoked"}), 401

    return jsonify({"access_token": issue_access_token(payload["sub"])})


@bp.post("/logout")
@require_auth
def logout():
    payload = g.jwt_payload
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO revoked_tokens (jti, owner_id, expires_at) VALUES (?, ?, ?)",
            (payload["jti"], payload["sub"], payload["exp"]),
        )
        write_audit_log(conn, g.owner_id, "LOGOUT", "owner", g.owner_id)
    return jsonify({"message": "Logged out"})


@bp.post("/password-reset/request")
def password_reset_request():
    try:
        check_rate_limit(f"pwreset:{client_ip()}", max_attempts=5, window_seconds=60 * 60)
    except RateLimitExceeded:
        return jsonify({"error": "Too many requests. Try again later."}), 429

    data = request.get_json(silent=True) or {}
    identifier = (data.get("email_or_mobile") or "").strip().lower()

    # Always return the same generic response whether or not the account
    # exists, so this endpoint cannot be used to enumerate registered users.
    generic_response = jsonify({
        "message": "If an account exists with these details, a reset link has been sent."
    })

    if not identifier:
        return generic_response

    with get_db() as conn:
        owner = conn.execute(
            "SELECT id FROM owners WHERE email = ? OR mobile = ?", (identifier, identifier)
        ).fetchone()
        if owner:
            raw_token = generate_token()
            conn.execute(
                """INSERT INTO password_reset_tokens (owner_id, token_hash, expires_at)
                   VALUES (?, ?, datetime('now', '+30 minutes'))""",
                (owner["id"], hash_token(raw_token)),
            )
            # In production: email/SMS `raw_token` to the owner via a secure
            # channel. Never log it or return it in the API response.

    return generic_response


@bp.post("/password-reset/confirm")
def password_reset_confirm():
    data = request.get_json(silent=True) or {}
    raw_token = data.get("token")
    new_password = data.get("new_password")

    if not raw_token or not new_password:
        return jsonify({"error": "token and new_password are required"}), 400
    try:
        new_password = valid_password(new_password)
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    token_hash = hash_token(raw_token)
    with get_db() as conn:
        record = conn.execute(
            """SELECT * FROM password_reset_tokens
               WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')""",
            (token_hash,),
        ).fetchone()
        if not record:
            return jsonify({"error": "Reset link is invalid or has expired"}), 400

        conn.execute(
            "UPDATE owners SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
            (hash_password(new_password), record["owner_id"]),
        )
        conn.execute(
            "UPDATE password_reset_tokens SET used = 1 WHERE id = ?", (record["id"],)
        )
        write_audit_log(conn, record["owner_id"], "PASSWORD_RESET", "owner", record["owner_id"])

    return jsonify({"message": "Password has been reset. Please log in."})
