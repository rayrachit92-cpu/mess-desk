"""
SMS delivery for mobile OTP codes.

Without an SMS provider configured, codes are logged server-side and returned
in the API response when FLASK_DEBUG=true (local development only).

To enable real SMS in production, set SMS_PROVIDER=twilio and the Twilio env vars,
then extend send_sms() below.
"""
import logging
import os

logger = logging.getLogger(__name__)


def send_sms(mobile: str, message: str) -> bool:
    provider = os.environ.get("SMS_PROVIDER", "").lower()
    if provider == "twilio":
        return _send_twilio(mobile, message)
    logger.info("SMS to %s: %s", mobile, message)
    return True


def _send_twilio(mobile: str, message: str) -> bool:
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_FROM_NUMBER")
    if not all([account_sid, auth_token, from_number]):
        logger.error("Twilio env vars missing — cannot send SMS")
        return False
    try:
        from twilio.rest import Client  # optional: pip install twilio
        client = Client(account_sid, auth_token)
        client.messages.create(body=message, from_=from_number, to=mobile)
        return True
    except Exception:
        logger.exception("Twilio SMS failed for %s", mobile)
        return False


def is_dev_expose_codes() -> bool:
    if os.environ.get("FLASK_DEBUG", "false").lower() == "true":
        return True
    return not os.environ.get("SMS_PROVIDER")
