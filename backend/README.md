# Mess Management System — Backend

Multi-tenant REST API. Every mess owner's data is strictly isolated; the
owner's identity is derived **only** from a validated JWT, never from
anything the client sends in a request body or query string.

## Run locally

```bash
cd backend
pip install -r requirements.txt
export JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export FRONTEND_ORIGIN="http://localhost:5173"
python3 app.py
```

Server starts on `http://127.0.0.1:5000`. SQLite database file `mess.db` is
created automatically on first run (schema in `schema.sql`).

For production: set `FLASK_DEBUG=false` (default), run behind `gunicorn`,
put it behind HTTPS (nginx/Caddy/load balancer — Flask itself doesn't
terminate TLS), and swap SQLite for PostgreSQL (see `requirements.txt` for
the upgrade path — `db.py` is the only file that would need rewriting).

## Environment variables

| Variable          | Required | Purpose                                   |
|--------------------|----------|--------------------------------------------|
| `JWT_SECRET`       | Yes (prod) | Signs/verifies JWTs. Falls back to an insecure dev value if unset — the app will refuse to be safe in prod without this set explicitly, so set it. |
| `FRONTEND_ORIGIN`  | No       | CORS origin allowed to call the API. Defaults to `http://localhost:5173`. |
| `FLASK_DEBUG`      | No       | `true` enables Flask's debug reloader/tracebacks. Never enable in production. |

## API overview

All endpoints except `/health`, `/auth/register`, `/auth/login`,
`/auth/refresh`, and `/auth/password-reset/*` require:

```
Authorization: Bearer <access_token>
```

| Method | Path                              | Purpose |
|--------|------------------------------------|---------|
| POST   | `/auth/register`                   | Create owner account |
| POST   | `/auth/login`                      | Get access + refresh tokens |
| POST   | `/auth/refresh`                    | Exchange refresh token for new access token |
| POST   | `/auth/logout`                     | Revoke current access token |
| POST   | `/auth/password-reset/request`     | Request reset token (generic response, no enumeration) |
| POST   | `/auth/password-reset/confirm`     | Complete reset with token |
| GET    | `/students`                        | List own students (supports `?status=`, `?search=`) |
| POST   | `/students`                        | Create student (end date auto-calculated) |
| GET    | `/students/<id>`                   | Student detail incl. payments/holidays |
| PUT    | `/students/<id>`                   | Update name/mobile |
| DELETE | `/students/<id>`                   | Soft-delete student |
| GET    | `/payments`                        | List payments (`?student_id=` optional) |
| POST   | `/payments`                        | Record a payment (validates against remaining balance) |
| DELETE | `/payments/<id>`                   | Void a payment |
| GET    | `/holidays`                        | List holidays (`?student_id=` optional) |
| POST   | `/holidays`                        | Record holiday (auto-extends current_end_date) |
| DELETE | `/holidays/<id>`                   | Remove holiday (reverses the extension) |
| GET    | `/notifications`                   | List notifications (auto-generates due ones first) |
| PUT    | `/notifications/<id>/read`         | Mark one as read |
| PUT    | `/notifications/read-all`          | Mark all as read |
| GET    | `/dashboard`                       | Summary counts and totals |
| GET    | `/reports/monthly`                 | `?year=&month=` monthly report |
| GET    | `/profile`                         | Get own profile |
| PUT    | `/profile`                         | Update owner/mess name |
| PUT    | `/profile/password`                | Change password |
| GET    | `/audit-logs`                      | View own audit trail |

## Security properties enforced

- **Tenant isolation**: every query is scoped `WHERE owner_id = ?` using the
  ID extracted from the JWT (`utils/auth_guard.py`), never from the client.
- **IDOR protection**: single-resource routes use `owned_resource_or_404`,
  which 404s (not 403, to avoid confirming a resource exists) if the
  resource doesn't belong to the authenticated owner.
- **Password hashing**: `hashlib.scrypt`, a memory-hard KDF (same class as
  bcrypt/Argon2id). See `requirements.txt` for swapping to `argon2-cffi`.
- **Rate limiting**: login, registration, and password reset are
  throttled (`utils/ratelimit.py`).
- **No enumeration**: login and password-reset return identical responses
  whether or not an account exists.
- **Parameterized SQL only**: every query in every route file uses `?`
  placeholders — grep for string-formatted SQL and you won't find any.
- **Audit log**: every mutating action is recorded in the same DB
  transaction as the change it describes (`utils/audit.py`).
- **No raw error leakage**: 500s return a generic message; details go to
  the server log only.
