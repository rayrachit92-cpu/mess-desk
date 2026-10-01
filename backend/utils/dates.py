from datetime import date, timedelta

ENDING_SOON_WINDOW_DAYS = 3


def add_days(iso_date: str, days: int) -> str:
    d = date.fromisoformat(iso_date)
    return (d + timedelta(days=days)).isoformat()


def calculate_original_end_date(start_date: str, plan_days: int) -> str:
    """Original end date is fixed at creation and never changes afterward."""
    return add_days(start_date, plan_days)


def calculate_holiday_days(holiday_start: str, holiday_end: str) -> int:
    """Inclusive day count, matching the spec's example: 15 Aug -> 17 Aug = 3 days."""
    start = date.fromisoformat(holiday_start)
    end = date.fromisoformat(holiday_end)
    if end < start:
        raise ValueError("Holiday end date cannot be before start date")
    return (end - start).days + 1


def is_currently_on_holiday(holidays: list, today: date = None) -> bool:
    today = today or date.today()
    for h in holidays:
        start = date.fromisoformat(h["start_date"])
        end = date.fromisoformat(h["end_date"])
        if start <= today <= end:
            return True
    return False


def calculate_status(current_end_date: str, holidays: list, today: date = None) -> str:
    """
    Status is always derived, never set manually.
    Priority: ON_HOLIDAY > EXPIRED > ENDING_TODAY(folded into ENDING_SOON) > ENDING_SOON > ACTIVE
    """
    today = today or date.today()
    end = date.fromisoformat(current_end_date)

    if is_currently_on_holiday(holidays, today):
        return "ON_HOLIDAY"
    if end < today:
        return "EXPIRED"
    days_left = (end - today).days
    if days_left <= ENDING_SOON_WINDOW_DAYS:
        return "ENDING_SOON"
    return "ACTIVE"


def days_until(iso_date: str, today: date = None) -> int:
    today = today or date.today()
    return (date.fromisoformat(iso_date) - today).days
