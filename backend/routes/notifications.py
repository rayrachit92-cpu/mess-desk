from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth, owned_resource_or_404
from utils.notifications import generate_for_student
from utils.dates import calculate_status

bp = Blueprint("notifications", __name__, url_prefix="/notifications")


def _refresh_notifications(conn, owner_id):
    """Sweep all active students and generate any newly-due notifications."""
    students = conn.execute(
        "SELECT * FROM students WHERE owner_id = ? AND is_deleted = 0", (owner_id,)
    ).fetchall()
    for s in students:
        holidays = conn.execute(
            "SELECT * FROM holidays WHERE owner_id = ? AND student_id = ?", (owner_id, s["id"])
        ).fetchall()
        generate_for_student(conn, owner_id, dict(s), [dict(h) for h in holidays])


@bp.get("")
@require_auth
def list_notifications():
    unread_only = request.args.get("unread_only") == "true"

    with get_db() as conn:
        _refresh_notifications(conn, g.owner_id)
        query = "SELECT * FROM notifications WHERE owner_id = ?"
        params = [g.owner_id]
        if unread_only:
            query += " AND is_read = 0"
        query += " ORDER BY created_at DESC LIMIT 200"
        rows = conn.execute(query, params).fetchall()

    return jsonify({"notifications": [dict(r) for r in rows]})


@bp.put("/<int:notification_id>/read")
@require_auth
def mark_read(notification_id):
    with get_db() as conn:
        row = owned_resource_or_404(conn, "notifications", notification_id, g.owner_id)
        if not row:
            return jsonify({"error": "Notification not found"}), 404
        conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND owner_id = ?",
                     (notification_id, g.owner_id))
    return jsonify({"message": "Marked as read"})


@bp.put("/read-all")
@require_auth
def mark_all_read():
    with get_db() as conn:
        conn.execute("UPDATE notifications SET is_read = 1 WHERE owner_id = ? AND is_read = 0",
                     (g.owner_id,))
    return jsonify({"message": "All notifications marked as read"})
