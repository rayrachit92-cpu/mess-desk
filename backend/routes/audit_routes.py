from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth

bp = Blueprint("audit", __name__, url_prefix="/audit-logs")


@bp.get("")
@require_auth
def list_audit_logs():
    limit = min(request.args.get("limit", default=100, type=int), 500)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_logs WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?",
            (g.owner_id, limit),
        ).fetchall()
    return jsonify({"audit_logs": [dict(r) for r in rows]})
