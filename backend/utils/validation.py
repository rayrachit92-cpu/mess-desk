import re
from datetime import date
from typing import Optional

GMAIL_RE = re.compile(r"^[a-z0-9._%+\-]+@gmail\.com$")
MOBILE_RE = re.compile(r"^[6-9][0-9]{9}$")


def normalize_mobile(value: str) -> Optional[str]:
    """Normalize to 10-digit Indian mobile, or None if invalid."""
    if not value:
        return None
    cleaned = value.strip().replace(" ", "").replace("-", "")
    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) >= 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) >= 11:
        cleaned = cleaned[1:]
    cleaned = re.sub(r"\D", "", cleaned)
    if len(cleaned) > 10 and cleaned.startswith("91"):
        cleaned = cleaned[-10:]
    if MOBILE_RE.match(cleaned):
        return cleaned
    return None


MEAL_PLANS = {"ONE_TIME", "TWO_TIME"}


class ValidationError(Exception):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


def require(value, field: str):
    if value is None or (isinstance(value, str) and value.strip() == ""):
        raise ValidationError(field, "is required")
    return value


def valid_name(value: str, field: str = "name", max_len: int = 100) -> str:
    require(value, field)
    value = value.strip()
    if len(value) < 2 or len(value) > max_len:
        raise ValidationError(field, f"must be between 2 and {max_len} characters")
    if not re.match(r"^[A-Za-z\s.'-]+$", value):
        raise ValidationError(field, "contains invalid characters")
    return value


def valid_email(value: str) -> str:
    require(value, "email")
    value = value.strip().lower()
    if not GMAIL_RE.match(value) or len(value) > 254:
        raise ValidationError("email", "must be a valid Gmail address (@gmail.com)")
    return value


def valid_mobile(value: str) -> str:
    require(value, "mobile")
    normalized = normalize_mobile(value)
    if not normalized:
        raise ValidationError(
            "mobile",
            "must be a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)",
        )
    return normalized


def valid_meal_plan(value: str) -> str:
    require(value, "meal_plan")
    plan = (value or "").strip().upper()
    if plan not in MEAL_PLANS:
        raise ValidationError("meal_plan", "must be ONE_TIME (1-time mess) or TWO_TIME (2-time mess)")
    return plan


def valid_password(value: str) -> str:
    require(value, "password")
    if len(value) < 8:
        raise ValidationError("password", "must be at least 8 characters")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"[0-9]", value):
        raise ValidationError("password", "must contain both letters and numbers")
    return value


def valid_date(value: str, field: str = "date") -> str:
    require(value, field)
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValidationError(field, "must be a valid date in YYYY-MM-DD format")
    return value


def valid_positive_int(value, field: str, max_value: int = None) -> int:
    require(value, field)
    try:
        ivalue = int(value)
    except (TypeError, ValueError):
        raise ValidationError(field, "must be an integer")
    if ivalue <= 0:
        raise ValidationError(field, "must be greater than 0")
    if max_value and ivalue > max_value:
        raise ValidationError(field, f"must be at most {max_value}")
    return ivalue


def valid_amount(value, field: str = "amount", allow_zero: bool = False) -> float:
    require(value, field)
    try:
        fvalue = round(float(value), 2)
    except (TypeError, ValueError):
        raise ValidationError(field, "must be a number")
    if allow_zero:
        if fvalue < 0:
            raise ValidationError(field, "cannot be negative")
    else:
        if fvalue <= 0:
            raise ValidationError(field, "must be greater than 0")
    if fvalue > 10_000_000:
        raise ValidationError(field, "is unrealistically large")
    return fvalue
