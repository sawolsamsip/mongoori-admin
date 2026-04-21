import sqlite3
from flask import g
import os

DB_PATH = "app.db"

def make_dict(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}

def get_conn():
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = make_dict
        conn.execute("PRAGMA foreign_keys = ON;")
        g.db = conn
    return g.db

def close_conn(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    db_exists = os.path.exists(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    
    if not db_exists:
        with open("./db/schema.sql", "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        
        with open("./db/seed.sql", "r", encoding="utf-8") as f:
            conn.executescript(f.read())

    conn.close()
