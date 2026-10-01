from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth
from utils.validation import valid_name, valid_amount, ValidationError
from utils.security import verify_password, hash_password, generate_token
from utils.audit import write_audit_log

bp = Blueprint("profile", __name__, url_prefix="/profile")


@bp.get("")
@require_auth
def get_profile():
    with get_db() as conn:
        owner = conn.execute(
            """SELECT id, owner_name, mess_name, mobile, email, fee_one_time, fee_two_time, created_at
               FROM owners WHERE id = ?""",
            (g.owner_id,),
        ).fetchone()
    if not owner:
        return jsonify({"error": "Owner not found"}), 404
    return jsonify({"profile": dict(owner)})


@bp.put("")
@require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    updates = {}
    try:
        if "owner_name" in data:
            updates["owner_name"] = valid_name(data["owner_name"], "owner_name")
        if "mess_name" in data:
            updates["mess_name"] = valid_name(data["mess_name"], "mess_name", max_len=150)
        if "fee_one_time" in data:
            updates["fee_one_time"] = valid_amount(data["fee_one_time"], "fee_one_time")
        if "fee_two_time" in data:
            updates["fee_two_time"] = valid_amount(data["fee_two_time"], "fee_two_time")
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    with get_db() as conn:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE owners SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            (*updates.values(), g.owner_id),
        )
        write_audit_log(conn, g.owner_id, "PROFILE_UPDATED", "owner", g.owner_id, updates)

    return jsonify({"message": "Profile updated"})


@bp.put("/password")
@require_auth
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    with get_db() as conn:
        owner = conn.execute("SELECT * FROM owners WHERE id = ?", (g.owner_id,)).fetchone()
        if not owner or not verify_password(current_password, owner["password_hash"]):
            return jsonify({"error": "Current password is incorrect"}), 401

        try:
            from utils.validation import valid_password
            new_password = valid_password(new_password)
        except ValidationError as e:
            return jsonify({"error": e.message, "field": e.field}), 400

        conn.execute(
            "UPDATE owners SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
            (hash_password(new_password), g.owner_id),
        )
        write_audit_log(conn, g.owner_id, "PASSWORD_CHANGED", "owner", g.owner_id)

    return jsonify({"message": "Password updated"})
