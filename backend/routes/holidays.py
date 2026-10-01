from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth, owned_resource_or_404
from utils.validation import valid_date, ValidationError
from utils.dates import calculate_holiday_days, add_days
from utils.audit import write_audit_log
from utils.notifications import notify_holiday_added

bp = Blueprint("holidays", __name__, url_prefix="/holidays")


@bp.get("")
@require_auth
def list_holidays():
    student_id = request.args.get("student_id", type=int)
    query = "SELECT * FROM holidays WHERE owner_id = ?"
    params = [g.owner_id]
    if student_id:
        query += " AND student_id = ?"
        params.append(student_id)
    query += " ORDER BY start_date DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify({"holidays": [dict(r) for r in rows]})


@bp.post("")
@require_auth
def create_holiday():
    data = request.get_json(silent=True) or {}
    try:
        student_id = int(data.get("student_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "student_id is required", "field": "student_id"}), 400

    try:
        start_date = valid_date(data.get("start_date"), "start_date")
        end_date = valid_date(data.get("end_date"), "end_date")
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    if end_date < start_date:
        return jsonify({"error": "end_date cannot be before start_date", "field": "end_date"}), 400

    with get_db() as conn:
        # IDOR check: verify the student belongs to this owner before
        # allowing a holiday to be attached to it.
        student = owned_resource_or_404(conn, "students", student_id, g.owner_id)
        if not student or student["is_deleted"]:
            return jsonify({"error": "Student not found"}), 404

        # Overlap check against this student's existing holidays
        overlap = conn.execute(
            """SELECT 1 FROM holidays WHERE owner_id = ? AND student_id = ?
               AND NOT (end_date < ? OR start_date > ?)""",
            (g.owner_id, student_id, start_date, end_date),
        ).fetchone()
        if overlap:
            return jsonify({"error": "This holiday overlaps with an existing holiday for this student"}), 409

        num_days = calculate_holiday_days(start_date, end_date)
        new_end_date = add_days(student["current_end_date"], num_days)

        cur = conn.execute(
            """INSERT INTO holidays (owner_id, student_id, start_date, end_date, number_of_days)
               VALUES (?, ?, ?, ?, ?)""",
            (g.owner_id, student_id, start_date, end_date, num_days),
        )
        holiday_id = cur.lastrowid

        conn.execute(
            "UPDATE students SET current_end_date = ?, updated_at = datetime('now') WHERE id = ?",
            (new_end_date, student_id),
        )

        notify_holiday_added(conn, g.owner_id, student["name"], student_id, num_days)
        write_audit_log(conn, g.owner_id, "HOLIDAY_ADDED", "holiday", holiday_id,
                         {"student_id": student_id, "days": num_days, "new_end_date": new_end_date})

        holiday = conn.execute("SELECT * FROM holidays WHERE id = ?", (holiday_id,)).fetchone()

    return jsonify({"holiday": dict(holiday), "new_current_end_date": new_end_date}), 201


@bp.put("/<int:holiday_id>")
@require_auth
def update_holiday(holiday_id):
    """Update holiday dates and recalculate the student's extended end date."""
    data = request.get_json(silent=True) or {}
    try:
        start_date = valid_date(data.get("start_date"), "start_date")
        end_date = valid_date(data.get("end_date"), "end_date")
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    if end_date < start_date:
        return jsonify({"error": "end_date cannot be before start_date", "field": "end_date"}), 400

    with get_db() as conn:
        holiday = owned_resource_or_404(conn, "holidays", holiday_id, g.owner_id)
        if not holiday:
            return jsonify({"error": "Holiday not found"}), 404

        student = conn.execute(
            "SELECT * FROM students WHERE id = ? AND owner_id = ?",
            (holiday["student_id"], g.owner_id),
        ).fetchone()
        if not student or student["is_deleted"]:
            return jsonify({"error": "Associated student not found"}), 404

        overlap = conn.execute(
            """SELECT 1 FROM holidays WHERE owner_id = ? AND student_id = ? AND id != ?
               AND NOT (end_date < ? OR start_date > ?)""",
            (g.owner_id, holiday["student_id"], holiday_id, start_date, end_date),
        ).fetchone()
        if overlap:
            return jsonify({"error": "Updated dates overlap with another holiday for this student"}), 409

        old_days = holiday["number_of_days"]
        new_days = calculate_holiday_days(start_date, end_date)
        day_delta = new_days - old_days
        new_end_date = add_days(student["current_end_date"], day_delta)

        conn.execute(
            """UPDATE holidays SET start_date = ?, end_date = ?, number_of_days = ?
               WHERE id = ? AND owner_id = ?""",
            (start_date, end_date, new_days, holiday_id, g.owner_id),
        )
        conn.execute(
            "UPDATE students SET current_end_date = ?, updated_at = datetime('now') WHERE id = ?",
            (new_end_date, student["id"]),
        )

        write_audit_log(conn, g.owner_id, "HOLIDAY_UPDATED", "holiday", holiday_id,
                         {"student_id": student["id"], "old_days": old_days, "new_days": new_days,
                          "new_end_date": new_end_date})

        updated = conn.execute("SELECT * FROM holidays WHERE id = ?", (holiday_id,)).fetchone()

    return jsonify({"holiday": dict(updated), "new_current_end_date": new_end_date})


@bp.delete("/<int:holiday_id>")
@require_auth
def delete_holiday(holiday_id):
    """Removes a holiday and reverses its day-extension from the student's current end date."""
    with get_db() as conn:
        holiday = owned_resource_or_404(conn, "holidays", holiday_id, g.owner_id)
        if not holiday:
            return jsonify({"error": "Holiday not found"}), 404

        student = conn.execute(
            "SELECT * FROM students WHERE id = ? AND owner_id = ?",
            (holiday["student_id"], g.owner_id),
        ).fetchone()
        if not student:
            return jsonify({"error": "Associated student not found"}), 404

        reversed_end_date = add_days(student["current_end_date"], -holiday["number_of_days"])
        conn.execute(
            "UPDATE students SET current_end_date = ?, updated_at = datetime('now') WHERE id = ?",
            (reversed_end_date, student["id"]),
        )
        conn.execute("DELETE FROM holidays WHERE id = ? AND owner_id = ?", (holiday_id, g.owner_id))

        write_audit_log(conn, g.owner_id, "HOLIDAY_DELETED", "holiday", holiday_id,
                         {"student_id": student["id"], "days_reversed": holiday["number_of_days"]})

    return jsonify({"message": "Holiday removed", "new_current_end_date": reversed_end_date})
