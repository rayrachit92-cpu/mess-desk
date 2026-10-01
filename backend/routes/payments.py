from flask import Blueprint, request, jsonify, g

from db import get_db
from utils.auth_guard import require_auth, owned_resource_or_404
from utils.validation import valid_date, valid_amount, ValidationError
from utils.audit import write_audit_log

bp = Blueprint("payments", __name__, url_prefix="/payments")

VALID_METHODS = {"CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"}


@bp.get("")
@require_auth
def list_payments():
    student_id = request.args.get("student_id", type=int)
    query = "SELECT * FROM payments WHERE owner_id = ?"
    params = [g.owner_id]
    if student_id:
        query += " AND student_id = ?"
        params.append(student_id)
    query += " ORDER BY payment_date DESC, created_at DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify({"payments": [dict(r) for r in rows]})


@bp.post("")
@require_auth
def create_payment():
    data = request.get_json(silent=True) or {}
    try:
        student_id = int(data.get("student_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "student_id is required", "field": "student_id"}), 400

    try:
        amount = valid_amount(data.get("amount"), "amount")
        payment_date = valid_date(data.get("payment_date"), "payment_date")
    except ValidationError as e:
        return jsonify({"error": e.message, "field": e.field}), 400

    method = (data.get("payment_method") or "CASH").upper()
    if method not in VALID_METHODS:
        return jsonify({"error": f"payment_method must be one of {sorted(VALID_METHODS)}"}), 400
    note = (data.get("note") or "").strip()[:500] or None

    with get_db() as conn:
        # IDOR check: student must belong to this owner before we touch it
        student = owned_resource_or_404(conn, "students", student_id, g.owner_id)
        if not student or student["is_deleted"]:
            return jsonify({"error": "Student not found"}), 404

        new_total_paid = round(student["total_paid"] + amount, 2)
        if new_total_paid > student["total_fee"]:
            return jsonify({
                "error": f"Payment would exceed total fee. Remaining due: "
                         f"{round(student['total_fee'] - student['total_paid'], 2)}"
            }), 400

        cur = conn.execute(
            """INSERT INTO payments (owner_id, student_id, amount, payment_date,
               payment_method, note, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (g.owner_id, student_id, amount, payment_date, method, note, g.owner_id),
        )
        payment_id = cur.lastrowid

        conn.execute(
            "UPDATE students SET total_paid = ?, updated_at = datetime('now') WHERE id = ?",
            (new_total_paid, student_id),
        )

        write_audit_log(conn, g.owner_id, "PAYMENT_ADDED", "payment", payment_id,
                         {"student_id": student_id, "amount": amount})

        payment = conn.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()

    return jsonify({"payment": dict(payment)}), 201


@bp.delete("/<int:payment_id>")
@require_auth
def delete_payment(payment_id):
    """Void a payment (e.g. it was entered in error). Reverses the amount from total_paid."""
    with get_db() as conn:
        payment = owned_resource_or_404(conn, "payments", payment_id, g.owner_id)
        if not payment:
            return jsonify({"error": "Payment not found"}), 404

        student = conn.execute(
            "SELECT * FROM students WHERE id = ? AND owner_id = ?",
            (payment["student_id"], g.owner_id),
        ).fetchone()
        if not student:
            return jsonify({"error": "Associated student not found"}), 404

        new_total_paid = max(0, round(student["total_paid"] - payment["amount"], 2))
        conn.execute(
            "UPDATE students SET total_paid = ?, updated_at = datetime('now') WHERE id = ?",
            (new_total_paid, student["id"]),
        )
        conn.execute("DELETE FROM payments WHERE id = ? AND owner_id = ?", (payment_id, g.owner_id))

        write_audit_log(conn, g.owner_id, "PAYMENT_VOIDED", "payment", payment_id,
                         {"student_id": student["id"], "amount": payment["amount"]})

    return jsonify({"message": "Payment voided"})
