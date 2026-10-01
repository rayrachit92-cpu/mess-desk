-- Mess Management System — Schema
-- Written for SQLite (dev). Types map 1:1 to PostgreSQL for a future swap:
--   INTEGER PRIMARY KEY AUTOINCREMENT  -> SERIAL / BIGSERIAL PRIMARY KEY
--   TEXT                               -> VARCHAR / TEXT
--   REAL                               -> NUMERIC(10,2)
--   TEXT (ISO date)                    -> DATE / TIMESTAMP

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owners (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_name      TEXT NOT NULL,
    mess_name       TEXT NOT NULL,
    mobile          TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    fee_one_time    REAL NOT NULL DEFAULT 0 CHECK (fee_one_time >= 0),
    fee_two_time    REAL NOT NULL DEFAULT 0 CHECK (fee_two_time >= 0),
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id            INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    mobile              TEXT NOT NULL,
    start_date          TEXT NOT NULL,
    plan_days           INTEGER NOT NULL CHECK (plan_days > 0),
    original_end_date   TEXT NOT NULL,
    current_end_date    TEXT NOT NULL,
    total_fee           REAL NOT NULL CHECK (total_fee >= 0),
    total_paid          REAL NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
    meal_plan           TEXT NOT NULL DEFAULT 'ONE_TIME'
                        CHECK (meal_plan IN ('ONE_TIME','TWO_TIME')),
    status              TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','ENDING_SOON','EXPIRED','ON_HOLIDAY')),
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (total_paid <= total_fee)
);
CREATE INDEX IF NOT EXISTS idx_students_owner ON students(owner_id);
CREATE INDEX IF NOT EXISTS idx_students_owner_status ON students(owner_id, status);

CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id        INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount          REAL NOT NULL CHECK (amount > 0),
    payment_date    TEXT NOT NULL,
    payment_method  TEXT NOT NULL DEFAULT 'CASH'
                    CHECK (payment_method IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    note            TEXT,
    created_by      INTEGER NOT NULL REFERENCES owners(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_owner ON payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);

CREATE TABLE IF NOT EXISTS holidays (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id        INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    number_of_days  INTEGER NOT NULL CHECK (number_of_days > 0),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_holidays_owner ON holidays(owner_id);
CREATE INDEX IF NOT EXISTS idx_holidays_student ON holidays(student_id);

CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN
                ('ENDING_TODAY','ENDING_SOON','EXPIRED','PAYMENT_PENDING','HOLIDAY')),
    message     TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_id);

-- Prevents duplicate "ending soon / expired / today" notices from piling up daily
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_dedupe
    ON notifications(owner_id, student_id, type, date(created_at));

CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti         TEXT PRIMARY KEY,
    owner_id    INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    revoked_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier  TEXT NOT NULL,   -- email/mobile attempted, or IP for pre-auth throttling
    ip_address  TEXT,
    success     INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   INTEGER,
    details     TEXT,
    ip_address  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_owner ON audit_logs(owner_id);

CREATE TABLE IF NOT EXISTS mobile_verifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    mobile      TEXT NOT NULL,
    otp_hash    TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mobile_verifications_lookup
    ON mobile_verifications(owner_id, mobile, created_at);

CREATE TABLE IF NOT EXISTS mobile_verification_tokens (
    token_hash  TEXT PRIMARY KEY,
    owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    mobile      TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mobile_tokens_lookup
    ON mobile_verification_tokens(owner_id, mobile, used);
