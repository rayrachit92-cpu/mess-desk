from datetime import date
from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth
from utils.dates import calculate_status

bp = Blueprint("reports", __name__, url_prefix="/reports")


@bp.get("/monthly")
@require_auth
def monthly_report():
    year = request.args.get("year", type=int) or date.today().year
    month = request.args.get("month", type=int) or date.today().month
    month_prefix = f"{year:04d}-{month:02d}"

    with get_db() as conn:
        all_students = conn.execute(
            "SELECT * FROM students WHERE owner_id = ? AND is_deleted = 0", (g.owner_id,)
        ).fetchall()

        new_students = [s for s in all_students if s["start_date"].startswith(month_prefix)]

        active, expired = [], []
        for s in all_students:
            holidays = conn.execute(
                "SELECT * FROM holidays WHERE owner_id = ? AND student_id = ?",
                (g.owner_id, s["id"]),
            ).fetchall()
            status = calculate_status(s["current_end_date"], [dict(h) for h in holidays])
            if status == "EXPIRED" and s["current_end_date"].startswith(month_prefix):
                expired.append(s)
            elif status in ("ACTIVE", "ON_HOLIDAY", "ENDING_SOON"):
                active.append(s)

        month_payments = conn.execute(
            """SELECT * FROM payments WHERE owner_id = ? AND payment_date LIKE ?""",
            (g.owner_id, f"{month_prefix}%"),
        ).fetchall()
        total_collection = round(sum(p["amount"] for p in month_payments), 2)

        pending_payments = round(sum(s["total_fee"] - s["total_paid"] for s in all_students
                                      if s["total_fee"] > s["total_paid"]), 2)

        month_holidays = conn.execute(
            "SELECT * FROM holidays WHERE owner_id = ? AND start_date LIKE ?",
            (g.owner_id, f"{month_prefix}%"),
        ).fetchall()
        total_holiday_days = sum(h["number_of_days"] for h in month_holidays)

        # Renewals: students whose original_end_date already passed but who
        # still have an active/future current_end_date (holiday extension
        # aside) and received a payment this month - simple heuristic proxy
        # for "renewed" without a dedicated renewals table.
        renewals = [s for s in all_students
                    if s["original_end_date"] < s["current_end_date"]
                    and s["current_end_date"] >= f"{month_prefix}-01"]

    return jsonify({
        "period": f"{year:04d}-{month:02d}",
        "active_students": len(active),
        "new_students": len(new_students),
        "expired_students": len(expired),
        "total_collection": total_collection,
        "pending_payments": pending_payments,
        "total_holiday_days": total_holiday_days,
        "renewals": len(renewals),
    })
