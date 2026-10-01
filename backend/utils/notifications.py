"""
Notification generation. Called after any action that could change a
student's status (holiday added, payment recorded) and also sweep-able on
a schedule (e.g. a daily cron hitting /internal/generate-notifications, or
just each time the owner loads their dashboard).

Dedup is enforced at the DB layer via a UNIQUE(owner_id, student_id, type,
date(created_at)) index, so calling this multiple times per day is safe.
"""
from utils.dates import calculate_status, days_until


def generate_for_student(conn, owner_id: int, student: dict, holidays: list):
    status = calculate_status(student["current_end_date"], holidays)
    remaining = round(student["total_fee"] - student["total_paid"], 2)

    candidates = []
    if status == "EXPIRED":
        candidates.append(("EXPIRED", f"{student['name']}'s mess subscription has expired."))
    else:
        days_left = days_until(student["current_end_date"])
        if days_left == 0:
            candidates.append(("ENDING_TODAY", f"{student['name']}'s mess subscription ends today."))
        elif 0 < days_left <= 3:
            candidates.append(("ENDING_SOON", f"{student['name']}'s mess subscription ends in {days_left} days."))

    if remaining > 0:
        candidates.append(("PAYMENT_PENDING", f"{student['name']} has \u20b9{remaining:,.2f} remaining."))

    for ntype, message in candidates:
        try:
            conn.execute(
                """INSERT INTO notifications (owner_id, student_id, type, message)
                   VALUES (?, ?, ?, ?)""",
                (owner_id, student["id"], ntype, message),
            )
        except Exception:
            # Unique constraint hit -> already notified today for this type, skip silently
            pass


def notify_holiday_added(conn, owner_id: int, student_name: str, student_id: int, days: int):
    conn.execute(
        """INSERT INTO notifications (owner_id, student_id, type, message)
           VALUES (?, ?, 'HOLIDAY', ?)""",
        (owner_id, student_id,
         f"{student_name}'s holiday has been recorded and {days} days have been added to the mess subscription."),
    )
