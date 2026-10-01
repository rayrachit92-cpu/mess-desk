"""
require_auth is the single choke point through which every protected
request must pass. It is the ONLY place owner_id gets set — routes read
`g.owner_id`, they never read an owner_id from the request body, query
string, or URL. This is what makes "never trust owner_id from the
frontend" actually true rather than just documented.
"""
from functools import wraps
from flask import request, g, jsonify
import jwt as pyjwt

from utils.jwt_auth import decode_token
from db import get_db


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401
        token = auth_header[len("Bearer "):].strip()

        try:
            payload = decode_token(token, expected_type="access")
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired, please log in again"}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token"}), 401

        # Check revocation (logout)
        with get_db() as conn:
            revoked = conn.execute(
                "SELECT 1 FROM revoked_tokens WHERE jti = ?", (payload["jti"],)
            ).fetchone()
        if revoked:
            return jsonify({"error": "Session has been logged out"}), 401

        g.owner_id = payload["sub"]
        g.jwt_payload = payload
        return fn(*args, **kwargs)
    return wrapper


def owned_resource_or_404(conn, table: str, resource_id: int, owner_id: int, id_col: str = "id"):
    """
    Enforces IDOR protection: fetch a resource ONLY if it belongs to the
    authenticated owner. Used by every single-resource GET/PUT/DELETE.
    Returns the row (as sqlite3.Row) or None.
    """
    return conn.execute(
        f"SELECT * FROM {table} WHERE {id_col} = ? AND owner_id = ?",
        (resource_id, owner_id),
    ).fetchone()
