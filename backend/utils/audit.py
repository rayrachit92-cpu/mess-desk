import json
from flask import request


def write_audit_log(conn, owner_id: int, action: str, entity_type: str,
                     entity_id: int = None, details: dict = None):
    """
    Every mutating action goes through here. Called with the SAME connection
    as the surrounding transaction so the audit entry commits/rolls back
    atomically with the change it describes.
    """
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) if request else None
    conn.execute(
        """INSERT INTO audit_logs (owner_id, action, entity_type, entity_id, details, ip_address)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (owner_id, action, entity_type, entity_id,
         json.dumps(details) if details else None, ip),
    )
