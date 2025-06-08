from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

app = FastAPI()

origins = ["http://localhost:3000", "http://localhost:5173"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def get_db_connection():
    return psycopg2.connect(dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT)

@app.get("/channels")
def get_channel_names():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT channel_name FROM chat_logs ORDER BY channel_name")
    channel_names = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return channel_names

@app.get("/messages")
def get_messages(
    channel_name: Optional[str] = None, 
    username: Optional[str] = None,
    before_timestamp: Optional[str] = None,
    after_timestamp: Optional[str] = None
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = "SELECT id, channel_name, username, message, created_at FROM chat_logs"
    
    where_clauses = []
    params = []
    order_by = "ORDER BY created_at DESC"

    if channel_name:
        where_clauses.append("channel_name = %s")
        params.append(channel_name)

    if username:
        where_clauses.append("username ILIKE %s")
        params.append(f"%{username}%")

    if before_timestamp:
        where_clauses.append("created_at < %s")
        params.append(before_timestamp)
        order_by = "ORDER BY created_at DESC"

    if after_timestamp:
        where_clauses.append("created_at > %s")
        params.append(after_timestamp)
        order_by = "ORDER BY created_at ASC"

    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)

    query += f" {order_by} LIMIT 50"

    cur.execute(query, tuple(params))
    messages = cur.fetchall()

    cur.close()
    conn.close()
    return messages

# --- MODIFIED ENDPOINT ---
@app.get("/messages_around_time")
def get_messages_around_time(target_timestamp: str, channel_name: Optional[str] = None):
    """
    Fetches messages around a timestamp. Channel_name is now optional.
    If no channel_name is provided, it searches across all channels.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Base queries for the two halves of the search
    query_before = "SELECT * FROM chat_logs WHERE created_at <= %s"
    query_after = "SELECT * FROM chat_logs WHERE created_at > %s"
    
    params = [target_timestamp]

    # Dynamically add channel filter if provided
    if channel_name:
        query_before += " AND channel_name = %s"
        query_after += " AND channel_name = %s"
        params.append(channel_name)

    # The final parameter list needs the timestamp and optional channel for both halves
    final_params = params + params

    # Combine the queries with UNION ALL
    full_query = f"""
    SELECT * FROM (
        ({query_before} ORDER BY created_at DESC LIMIT 50)
        UNION ALL
        ({query_after} ORDER BY created_at ASC LIMIT 50)
    ) AS messages_around_time
    ORDER BY created_at ASC;
    """
    
    cur.execute(full_query, tuple(final_params))
    messages = cur.fetchall()

    cur.close()
    conn.close()
    return messages