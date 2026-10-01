"""
Simple in-memory sliding-window rate limiter.

Good enough for a single-process dev/small deployment. For a multi-process
production deployment, back this with Redis (INCR + EXPIRE) instead — the
call sites (`check_rate_limit`) would not need to change.
"""
import time
import threading
from collections import defaultdict, deque

_lock = threading.Lock()
_hits = defaultdict(deque)


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded, retry after {retry_after}s")


def check_rate_limit(key: str, max_attempts: int, window_seconds: int):
    """Raises RateLimitExceeded if `key` has exceeded max_attempts in window_seconds."""
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and q[0] < now - window_seconds:
            q.popleft()
        if len(q) >= max_attempts:
            retry_after = int(window_seconds - (now - q[0]))
            raise RateLimitExceeded(max(retry_after, 1))
        q.append(now)


def reset_rate_limit(key: str):
    with _lock:
        _hits.pop(key, None)
