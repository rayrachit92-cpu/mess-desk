from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth, owned_resource_or_404
from utils.validation import valid_name, valid_mobile, valid_date, valid_positive_int, valid_amount, valid_meal_plan, ValidationError
from utils.dates import calculate_original_end_date, calculate_status
from utils.audit import write_audit_log
from utils.notifications import generate_for_student

bp = Blueprint("students", __name__, url_prefix="/students")


def _student_holidays(conn, owner_id, student_id):
    rows = conn.execute(
        "SELECT * FROM holidays WHERE owner_id = ? AND student_id = ? ORDER BY start_date",
        (owner_id, student_id),
    ).fetchall()
    return [dict(r) for r in rows]


def _serialize(conn, owner_id, student_row):
    student = dict(student_row)
    holidays = _student_holidays(conn, owner_id, student["id"])
    live_status = calculate_status(student["current_end_date"], holidays)
    if live_status != student["status"]:
        conn.execute("UPDATE students SET status = ? WHERE id = ?", (live_status, student["id"]))
        student["status"] = live_status
    student["remaining_amount"] = round(student["total_fee"] - student["total_paid"], 2)
    student["total_holiday_days"] = sum(h["number_of_days"] for h in holidays)
    return student


@bp.get("")
@require_auth
def list_students():
    status_filter = request.args.get("status")
    search = request.args.get("search", "").strip()

    query = "SELECT * FROM students WHERE owner_id = ? AND is_deleted = 0"
    params = [g.owner_id]
    if search:
        query += " AND (name LIKE ? OR mobile LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY created_at DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        students = [_serialize(conn, g.owner_id, r) for r in rows]

    if status_filter:
        students = [s for s in students if s["status"] == status_filter.upper()]

    return jsonify({"students": students})


@bp.post("")
@require_auth
def create_student():
    data = request.get_json(silent=True) or {}
    try:
        name = valid_name(data.get("name"))
        mobile = valid_mobile(data.get("mobile"))
        start_date = valid_date(data.get("start_date"), "start_date")
        plan_days = valid_positive_int(data.get("plan_days"), "plan_days", max_value=3650)
        meal_plan = valid_meal_plan(data.get("meal_plan", "ONE_TIME"))
        total_fee = valid_amount(data.get("total_fee"), "total_fee", allow_zero=True)
        amount_paid = valid_amount(data.get("amount_paid", 0), "amount_paid", allow_zero=True)
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    if amount_paid > total_fee:
        return jsonify({"error": "Amount paid cannot exceed total fee", "field": "amount_paid"}), 400

    original_end_date = calculate_original_end_date(start_date, plan_days)

    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO students
               (owner_id, name, mobile, start_date, plan_days, original_end_date,
                current_end_date, total_fee, total_paid, meal_plan, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')""",
            (g.owner_id, name, mobile, start_date, plan_days, original_end_date,
             original_end_date, total_fee, amount_paid, meal_plan),
        )
        student_id = cur.lastrowid

        if amount_paid > 0:
            conn.execute(
                """INSERT INTO payments (owner_id, student_id, amount, payment_date,
                   payment_method, note, created_by)
                   VALUES (?, ?, ?, date('now'), 'CASH', 'Initial payment at registration', ?)""",
                (g.owner_id, student_id, amount_paid, g.owner_id),
            )

        write_audit_log(conn, g.owner_id, "STUDENT_CREATED", "student", student_id,
                         {"name": name, "total_fee": total_fee})

        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        student = _serialize(conn, g.owner_id, row)

    return jsonify({"student": student}), 201


@bp.get("/<int:student_id>")
@require_auth
def get_student(student_id):
    with get_db() as conn:
        row = owned_resource_or_404(conn, "students", student_id, g.owner_id)
        if not row or row["is_deleted"]:
            return jsonify({"error": "Student not found"}), 404
        student = _serialize(conn, g.owner_id, row)
        student["holidays"] = _student_holidays(conn, g.owner_id, student_id)
        payments = conn.execute(
            "SELECT * FROM payments WHERE owner_id = ? AND student_id = ? ORDER BY payment_date DESC",
            (g.owner_id, student_id),
        ).fetchall()
        student["payments"] = [dict(p) for p in payments]
    return jsonify({"student": student})


@bp.put("/<int:student_id>")
@require_auth
def update_student(student_id):
    data = request.get_json(silent=True) or {}

    with get_db() as conn:
        row = owned_resource_or_404(conn, "students", student_id, g.owner_id)
        if not row or row["is_deleted"]:
            return jsonify({"error": "Student not found"}), 404

        updates = {}
        try:
            if "name" in data:
                updates["name"] = valid_name(data["name"])
            if "mobile" in data:
                updates["mobile"] = valid_mobile(data["mobile"])
            # start_date, plan_days and original_end_date are intentionally
            # NOT editable here - they're immutable historical facts. Use
            # holidays to extend a subscription instead.
        except ValidationError as e:
            return jsonify({"error": e.message, "field": e.field}), 400

        if not updates:
            return jsonify({"error": "No valid fields to update"}), 400

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE students SET {set_clause}, updated_at = datetime('now') WHERE id = ? AND owner_id = ?",
            (*updates.values(), student_id, g.owner_id),
        )
        write_audit_log(conn, g.owner_id, "STUDENT_UPDATED", "student", student_id, updates)

        refreshed = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        student = _serialize(conn, g.owner_id, refreshed)

    return jsonify({"student": student})


@bp.delete("/<int:student_id>")
@require_auth
def delete_student(student_id):
    with get_db() as conn:
        row = owned_resource_or_404(conn, "students", student_id, g.owner_id)
        if not row or row["is_deleted"]:
            return jsonify({"error": "Student not found"}), 404

        conn.execute(
            "UPDATE students SET is_deleted = 1, updated_at = datetime('now') WHERE id = ? AND owner_id = ?",
            (student_id, g.owner_id),
        )
        write_audit_log(conn, g.owner_id, "STUDENT_DELETED", "student", student_id,
                         {"name": row["name"], "reason": "left_mess"})

    return jsonify({"message": "Student removed from mess"})
