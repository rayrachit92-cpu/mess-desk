from datetime import date
from flask import Blueprint, jsonify, g

from db import get_db
from utils.auth_guard import require_auth
from utils.dates import calculate_status

bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


@bp.get("")
@require_auth
def dashboard():
    today = date.today().isoformat()

    with get_db() as conn:
        students = conn.execute(
            "SELECT * FROM students WHERE owner_id = ? AND is_deleted = 0", (g.owner_id,)
        ).fetchall()

        counts = {"ACTIVE": 0, "ENDING_SOON": 0, "EXPIRED": 0, "ON_HOLIDAY": 0}
        total_fees = 0.0
        total_collected = 0.0
        ending_today = 0

        for s in students:
            holidays = conn.execute(
                "SELECT * FROM holidays WHERE owner_id = ? AND student_id = ?",
                (g.owner_id, s["id"]),
            ).fetchall()
            status = calculate_status(s["current_end_date"], [dict(h) for h in holidays])
            counts[status] = counts.get(status, 0) + 1
            total_fees += s["total_fee"]
            total_collected += s["total_paid"]
            if s["current_end_date"] == today:
                ending_today += 1

    return jsonify({
        "total_students": len(students),
        "active_students": counts["ACTIVE"] + counts["ON_HOLIDAY"],
        "ending_today": ending_today,
        "ending_soon": counts["ENDING_SOON"],
        "expired": counts["EXPIRED"],
        "on_holiday": counts["ON_HOLIDAY"],
        "total_fees": round(total_fees, 2),
        "total_collected": round(total_collected, 2),
        "total_remaining": round(total_fees - total_collected, 2),
    })
