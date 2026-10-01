"""
Database access layer.

Uses SQLite via stdlib sqlite3 with parameterized queries only — never
string-formatted SQL. Swapping to PostgreSQL later means replacing this
module with a SQLAlchemy engine/session; every route file only calls the
functions below, so the swap is isolated to this file.
"""
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "mess.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    """Context-managed connection: commits on success, rolls back on error."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    conn = get_connection()
    try:
        with open(SCHEMA_PATH, "r") as f:
            conn.executescript(f.read())
        _migrate(conn)
        conn.commit()
    finally:
        conn.close()


def _migrate(conn):
    """Apply additive schema changes for existing databases."""
    owner_cols = {r[1] for r in conn.execute("PRAGMA table_info(owners)").fetchall()}
    if "fee_one_time" not in owner_cols:
        conn.execute("ALTER TABLE owners ADD COLUMN fee_one_time REAL NOT NULL DEFAULT 0")
    if "fee_two_time" not in owner_cols:
        conn.execute("ALTER TABLE owners ADD COLUMN fee_two_time REAL NOT NULL DEFAULT 0")

    student_cols = {r[1] for r in conn.execute("PRAGMA table_info(students)").fetchall()}
    if "meal_plan" not in student_cols:
        conn.execute(
            "ALTER TABLE students ADD COLUMN meal_plan TEXT NOT NULL DEFAULT 'ONE_TIME'"
        )


def row_to_dict(row):
    return dict(row) if row is not None else None


def rows_to_list(rows):
    return [dict(r) for r in rows]
