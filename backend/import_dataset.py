"""
import_dataset.py
Imports the sample_data CSVs (data_access_logs.csv + user_profiles.csv),
maps columns to the SentinelGuard schema, derives missing fields,
runs every log event through the detection engine, and seeds the database.
"""
import os
import sys
import json
import random
import numpy as np
import pandas as pd
from datetime import datetime

# Ensure backend modules are importable
sys.path.insert(0, os.path.dirname(__file__))
import database
import detection_engine

random.seed(42)
np.random.seed(42)

SAMPLE_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'sample_data')
LOGS_CSV    = os.path.join(SAMPLE_DATA_DIR, 'data_access_logs.csv')
PROFILES_CSV = os.path.join(SAMPLE_DATA_DIR, 'user_profiles.csv')

# ─── Column mapping helpers ────────────────────────────────────────────────────

ACTION_TO_QUERY_TYPE = {
    'export_data':      'EXPORT',
    'sql_query':        'SELECT',
    'api_call':         'API',
    'admin_operation':  'UPDATE',
    'login':            'SELECT',
    'file_access':      'SELECT',
}

SENSITIVITY_MAP = {
    'low':    'LOW',
    'medium': 'MEDIUM',
    'high':   'HIGH',
}

# Approximate rowcounts by action + sensitivity (realistic variation added later)
BASE_ROWCOUNTS = {
    ('EXPORT',  'LOW'):      5000,
    ('EXPORT',  'MEDIUM'):   9000,
    ('EXPORT',  'HIGH'):    18000,
    ('SELECT',  'LOW'):       300,
    ('SELECT',  'MEDIUM'):    800,
    ('SELECT',  'HIGH'):     2500,
    ('API',     'LOW'):       150,
    ('API',     'MEDIUM'):    500,
    ('API',     'HIGH'):     1200,
    ('UPDATE',  'LOW'):        50,
    ('UPDATE',  'MEDIUM'):    120,
    ('UPDATE',  'HIGH'):      300,
}

# systems_access values → normalised asset names
SYSTEMS_TO_ASSETS = {
    'AD':           'active_directory',
    'Azure_AD':     'azure_active_directory',
    'Salesforce':   'salesforce_crm',
    'EMAIL':        'corporate_email',
    'PROD_DB':      'production_database',
    'AWS_IAM':      'aws_iam_console',
    'ServiceNow':   'servicenow_portal',
    'JIRA':         'jira_project_tracker',
    'GitHub':       'github_repositories',
    'Confluence':   'confluence_wiki',
    'SAP':          'sap_erp',
    'Workday':      'workday_hr',
    'Slack':        'slack_workspace',
    'Zoom':         'zoom_meetings',
}

SENSITIVE_ASSETS = {
    'production_database', 'salesforce_crm', 'workday_hr',
    'sap_erp', 'aws_iam_console', 'active_directory',
}

RESOURCE_TO_ASSET = {
    'Customer_Vault':     'production_database',
    'File_Share':         'corporate_file_share',
    'HR_System':          'workday_hr',
    'Finance_DB':         'sap_erp',
    'CRM':                'salesforce_crm',
    'Admin_Panel':        'admin_panel',
    'Email_Server':       'corporate_email',
    'Cloud_Storage':      'aws_iam_console',
    'Code_Repository':    'github_repositories',
    'Analytics_DB':       'analytics_database',
}

TIME_CLASS_TO_HOURS = {
    'business_hours': list(range(8, 18)),
    'night':          list(range(0, 6)),
    'weekend':        list(range(9, 18)),
    'unusual_hours':  list(range(19, 24)),
}

def derive_destination(action, username, time_class):
    """Derive a realistic destination based on action type."""
    if action == 'export_data':
        roll = random.random()
        if roll < 0.10:
            return 'USB'
        elif roll < 0.20:
            return f"{username}@gmail.com"
        else:
            return 'INTERNAL'
    elif action == 'admin_operation':
        return 'INTERNAL'
    else:
        return 'INTERNAL'

def derive_access_method(action, source_ip):
    """Map action + source_ip to an access method."""
    if action == 'api_call':
        return 'API'
    elif action == 'admin_operation':
        return 'CLI'
    elif action == 'sql_query':
        return 'DIRECT_SQL'
    else:
        return 'WEB_CONSOLE'

def systems_to_approved_assets(systems_str):
    """Convert pipe-separated systems_access to list of normalised asset names."""
    if pd.isna(systems_str) or not systems_str:
        return ['corporate_file_share']
    parts = [p.strip() for p in str(systems_str).split('|')]
    assets = []
    for p in parts:
        assets.append(SYSTEMS_TO_ASSETS.get(p, p.lower().replace(' ', '_')))
    return assets

def tenure_months_from_hire(hire_date_str):
    """Compute tenure in months from hire_date string."""
    try:
        hire = datetime.strptime(str(hire_date_str).strip(), '%Y-%m-%d')
        delta = datetime.now() - hire
        return max(1, int(delta.days / 30))
    except Exception:
        return 12

def derive_rowcount(query_type, sensitivity):
    """Derive a realistic rowcount with noise."""
    base = BASE_ROWCOUNTS.get((query_type, sensitivity), 300)
    noise = np.random.normal(0, base * 0.25)
    return max(10, int(base + noise))

# ─── Main import logic ─────────────────────────────────────────────────────────

def run_import():
    print("=" * 60)
    print("SentinelGuard Dataset Importer")
    print("=" * 60)

    # 1. Load raw CSVs
    print("\n[1/6] Loading CSV files...")
    logs_df     = pd.read_csv(LOGS_CSV)
    profiles_df = pd.read_csv(PROFILES_CSV)
    print(f"      Access logs  : {len(logs_df):,} rows")
    print(f"      User profiles: {len(profiles_df):,} rows")

    # 2. Transform user profiles
    print("\n[2/6] Transforming user profiles...")
    users = []
    for _, row in profiles_df.iterrows():
        approved = systems_to_approved_assets(row.get('systems_access', ''))
        tenure   = tenure_months_from_hire(row.get('hire_date', ''))
        priv     = str(row.get('privilege_level', 'user'))
        if priv in ('admin', 'service-account'):
            typical_hours = list(range(0, 24, 3))
        else:
            typical_hours = list(range(8, 18))

        users.append({
            'user_id':               row['user_id'],
            'username':              row['username'],
            'department':            row['department'],
            'role':                  row.get('job_title', 'Employee'),
            'tenure_months':         tenure,
            'approved_data_assets':  approved,
            'typical_access_hours':  typical_hours,
            'avg_queries_per_day':   float(random.randint(8, 35)),
            'avg_rowcount_per_query': float(random.randint(150, 1200)),
        })

    # 3. Clear DB and save users
    print("\n[3/6] Seeding database with user profiles...")
    database.clear_db()
    database.save_users(users)
    users_dict = database.get_users_dict()
    print(f"      Saved {len(users)} user profiles.")

    # 4. Build user_id lookup
    uid_to_dept = {u['user_id']: u['department'] for u in users}

    # 5. Transform access logs
    print("\n[4/6] Transforming access log records...")
    raw_logs = []
    for _, row in logs_df.iterrows():
        action       = str(row.get('action', 'sql_query')).strip().lower()
        query_type   = ACTION_TO_QUERY_TYPE.get(action, 'SELECT')
        sensitivity  = SENSITIVITY_MAP.get(
            str(row.get('resource_sensitivity', 'low')).strip().lower(), 'LOW'
        )
        resource     = str(row.get('resource', 'unknown_resource')).strip()
        data_asset   = RESOURCE_TO_ASSET.get(resource, resource.lower().replace(' ', '_'))
        user_id      = str(row['user_id']).strip()
        username     = str(row['username']).strip()
        department   = uid_to_dept.get(user_id, 'Unknown')
        rowcount     = derive_rowcount(query_type, sensitivity)
        destination  = derive_destination(action, username, '')
        access_meth  = derive_access_method(action, row.get('source_ip', ''))

        ts = str(row['timestamp']).strip()
        if len(ts) == 16:
            ts += ':00'

        raw_logs.append({
            'timestamp':        ts,
            'user_id':          user_id,
            'username':         username,
            'department':       department,
            'data_asset':       data_asset,
            'data_sensitivity': sensitivity,
            'query_type':       query_type,
            'rowcount':         rowcount,
            'access_method':    access_meth,
            'destination':      destination,
        })

    print(f"      Transformed {len(raw_logs):,} log records.")

    # 6. Compute baselines, train model, evaluate
    print("\n[5/6] Computing baselines and running detection engine...")
    logs_for_baseline = pd.DataFrame(raw_logs)
    baselines = detection_engine.compute_baselines_from_logs(logs_for_baseline, users_dict)
    database.save_baselines(baselines)
    baselines_dict = database.get_user_baselines_dict()

    iso_forest = detection_engine.train_isolation_forest(logs_for_baseline)

    raw_logs.sort(key=lambda x: x['timestamp'])
    prior_access_set = set()
    evaluated_logs = []

    for log in raw_logs:
        ev = detection_engine.evaluate_log(
            log=log,
            users_dict=users_dict,
            baselines_dict=baselines_dict,
            iso_forest_model=iso_forest,
            prior_access_set=prior_access_set,
        )
        evaluated_logs.append(ev)
        prior_access_set.add((log['user_id'], log['data_asset']))

    database.save_logs(evaluated_logs)

    # 7. Summary
    print(f"\n[6/6] Import complete!")
    print("=" * 60)
    evdf = pd.DataFrame(evaluated_logs)
    sev_counts = evdf['severity'].value_counts()
    print(f"  Total records ingested : {len(evaluated_logs):,}")
    print(f"  CRITICAL alerts        : {sev_counts.get('CRITICAL', 0)}")
    print(f"  HIGH alerts            : {sev_counts.get('HIGH', 0)}")
    print(f"  MEDIUM alerts          : {sev_counts.get('MEDIUM', 0)}")
    print(f"  LOW alerts             : {sev_counts.get('LOW', 0)}")
    print(f"  Average risk score     : {evdf['risk_score'].mean():.1f}/100")
    print("=" * 60)

if __name__ == '__main__':
    run_import()
