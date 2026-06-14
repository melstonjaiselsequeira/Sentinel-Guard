import sqlite3
import os
import json

DB_FILE = os.path.join(os.path.dirname(__file__), 'sentinel_guard.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            department TEXT NOT NULL,
            role TEXT NOT NULL,
            tenure_months INTEGER,
            approved_data_assets TEXT,
            typical_access_hours TEXT,
            avg_queries_per_day REAL,
            avg_rowcount_per_query REAL
        )
    ''')
    
    # Create Access Logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            department TEXT NOT NULL,
            data_asset TEXT NOT NULL,
            data_sensitivity TEXT NOT NULL,
            query_type TEXT NOT NULL,
            rowcount INTEGER NOT NULL,
            access_method TEXT NOT NULL,
            destination TEXT NOT NULL,
            risk_score REAL DEFAULT 0.0,
            severity TEXT DEFAULT 'LOW',
            rules_violated TEXT, -- JSON array of strings
            anomalies_detected TEXT, -- JSON array of strings
            ai_narrative TEXT,
            status TEXT DEFAULT 'OPEN'
        )
    ''')
    
    # Create User Baselines table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_baselines (
            user_id TEXT PRIMARY KEY,
            typical_hours TEXT,       -- JSON array of hours (0-23)
            avg_queries REAL,
            std_queries REAL,
            avg_rowcount REAL,
            std_rowcount REAL,
            top_assets TEXT,         -- JSON array of dicts: {"asset": count}
            top_destinations TEXT,   -- JSON array of dicts: {"destination": count}
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def save_users(users_list):
    """
    Saves or updates user profiles.
    users_list: list of dicts representing user profiles
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    for user in users_list:
        cursor.execute('''
            INSERT OR REPLACE INTO users (
                user_id, username, department, role, tenure_months, 
                approved_data_assets, typical_access_hours, 
                avg_queries_per_day, avg_rowcount_per_query
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user['user_id'],
            user['username'],
            user['department'],
            user['role'],
            int(user['tenure_months']),
            user['approved_data_assets'] if isinstance(user['approved_data_assets'], str) else json.dumps(user['approved_data_assets']),
            user['typical_access_hours'] if isinstance(user['typical_access_hours'], str) else json.dumps(user['typical_access_hours']),
            float(user['avg_queries_per_day']),
            float(user['avg_rowcount_per_query'])
        ))
    conn.commit()
    conn.close()

def save_logs(logs_list):
    """
    Saves multiple access logs.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    for log in logs_list:
        cursor.execute('''
            INSERT INTO access_logs (
                timestamp, user_id, username, department, data_asset, 
                data_sensitivity, query_type, rowcount, access_method, 
                destination, risk_score, severity, rules_violated, 
                anomalies_detected, ai_narrative, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            log['timestamp'],
            log['user_id'],
            log['username'],
            log['department'],
            log['data_asset'],
            log['data_sensitivity'],
            log['query_type'],
            int(log['rowcount']),
            log['access_method'],
            log['destination'],
            float(log.get('risk_score', 0.0)),
            log.get('severity', 'LOW'),
            json.dumps(log.get('rules_violated', [])),
            json.dumps(log.get('anomalies_detected', [])),
            log.get('ai_narrative', ''),
            log.get('status', 'OPEN')
        ))
    conn.commit()
    conn.close()

def save_baselines(baselines):
    """
    Saves calculated user baselines.
    baselines: list of dicts representing user baselines
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    for ub in baselines:
        cursor.execute('''
            INSERT OR REPLACE INTO user_baselines (
                user_id, typical_hours, avg_queries, std_queries, 
                avg_rowcount, std_rowcount, top_assets, top_destinations
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ub['user_id'],
            json.dumps(ub['typical_hours']),
            float(ub['avg_queries']),
            float(ub['std_queries']),
            float(ub['avg_rowcount']),
            float(ub['std_rowcount']),
            json.dumps(ub['top_assets']),
            json.dumps(ub['top_destinations'])
        ))
    conn.commit()
    conn.close()

def get_users_dict():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users')
    rows = cursor.fetchall()
    conn.close()
    
    users = {}
    for r in rows:
        users[r['user_id']] = {
            'user_id': r['user_id'],
            'username': r['username'],
            'department': r['department'],
            'role': r['role'],
            'tenure_months': r['tenure_months'],
            'approved_data_assets': json.loads(r['approved_data_assets']) if r['approved_data_assets'] else [],
            'typical_access_hours': json.loads(r['typical_access_hours']) if r['typical_access_hours'] else [],
            'avg_queries_per_day': r['avg_queries_per_day'],
            'avg_rowcount_per_query': r['avg_rowcount_per_query']
        }
    return users

def get_user_baselines_dict():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM user_baselines')
    rows = cursor.fetchall()
    conn.close()
    
    baselines = {}
    for r in rows:
        baselines[r['user_id']] = {
            'user_id': r['user_id'],
            'typical_hours': json.loads(r['typical_hours']) if r['typical_hours'] else [],
            'avg_queries': r['avg_queries'],
            'std_queries': r['std_queries'],
            'avg_rowcount': r['avg_rowcount'],
            'std_rowcount': r['std_rowcount'],
            'top_assets': json.loads(r['top_assets']) if r['top_assets'] else [],
            'top_destinations': json.loads(r['top_destinations']) if r['top_destinations'] else []
        }
    return baselines

def clear_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DROP TABLE IF EXISTS users')
    cursor.execute('DROP TABLE IF EXISTS access_logs')
    cursor.execute('DROP TABLE IF EXISTS user_baselines')
    conn.commit()
    conn.close()
    init_db()
