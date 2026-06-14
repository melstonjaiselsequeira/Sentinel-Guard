import json
import re
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import IsolationForest
import database

# Rule Weights
RULE_WEIGHTS = {
    "Off-hours Access": 15,
    "Restricted Data Access": 20,
    "Bulk Export (>10k rows)": 25,
    "External Email Destination": 20,
    "USB Destination": 25,
    "Non-Approved Asset Access": 15,
    "Cross-Department Access": 15,
    "First-Time Sensitive Access": 15
}

def parse_hour_from_timestamp(ts_str):
    try:
        # Expected format: YYYY-MM-DD HH:MM:SS
        dt = datetime.strptime(ts_str.strip(), "%Y-%m-%d %H:%M:%S")
        return dt.hour
    except Exception:
        try:
            dt = datetime.fromisoformat(ts_str.strip())
            return dt.hour
        except Exception:
            return 12  # Default to mid-day if parsing fails

def is_external_email(dest):
    dest_lower = dest.lower()
    if '@' in dest_lower:
        # Check if it goes to common external domains
        external_domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com', 'mail.com']
        for domain in external_domains:
            if domain in dest_lower:
                return True
        # If it contains @ and doesn't contain company domain
        if 'sentinelguard.internal' not in dest_lower and 'company.com' not in dest_lower:
            return True
    return False

def is_usb_dest(dest):
    dest_lower = dest.lower()
    return any(keyword in dest_lower for keyword in ['usb', 'removable', 'external drive', 'thumb drive', 'flash drive', 'd:\\', 'e:\\'])

def is_cross_department(user_dept, asset_name):
    if not user_dept or not asset_name:
        return False
    
    asset_lower = asset_name.lower()
    user_dept_lower = user_dept.lower()
    
    # Common departments
    departments = ['finance', 'hr', 'sales', 'engineering', 'marketing', 'legal', 'executive', 'operations', 'support']
    
    # Check if the asset contains a department name that is NOT the user's department
    for dept in departments:
        if dept in asset_lower and dept != user_dept_lower:
            return True
    return False

def compute_baselines_from_logs(logs_df, users_dict):
    """
    Computes baseline statistics for users based on a historical log DataFrame.
    """
    baselines = []
    
    # Ensure timestamp is parsed
    logs_df = logs_df.copy()
    logs_df['hour'] = logs_df['timestamp'].apply(parse_hour_from_timestamp)
    logs_df['date'] = logs_df['timestamp'].str.slice(0, 10)
    
    for user_id, group in logs_df.groupby('user_id'):
        # Hours
        hours_counts = group['hour'].value_counts()
        # Typical hours are those that account for most activity, or let's say hours with count > 5% of total
        total_logs = len(group)
        typical_hours = [int(h) for h, count in hours_counts.items() if (count / total_logs) > 0.05]
        if not typical_hours:
            typical_hours = list(range(8, 18))  # default business hours
            
        # Daily queries
        queries_per_day = group.groupby('date').size()
        avg_queries = float(queries_per_day.mean())
        std_queries = float(queries_per_day.std()) if len(queries_per_day) > 1 else 1.0
        if np.isnan(std_queries) or std_queries == 0:
            std_queries = 1.0
            
        # Rowcounts
        avg_rowcount = float(group['rowcount'].mean())
        std_rowcount = float(group['rowcount'].std()) if len(group) > 1 else 100.0
        if np.isnan(std_rowcount) or std_rowcount == 0:
            std_rowcount = 100.0
            
        # Top assets
        asset_counts = group['data_asset'].value_counts().head(5)
        top_assets = [{"asset": str(k), "count": int(v)} for k, v in asset_counts.items()]
        
        # Top destinations
        dest_counts = group['destination'].value_counts().head(5)
        top_destinations = [{"destination": str(k), "count": int(v)} for k, v in dest_counts.items()]
        
        baselines.append({
            'user_id': user_id,
            'typical_hours': typical_hours,
            'avg_queries': avg_queries,
            'std_queries': std_queries,
            'avg_rowcount': avg_rowcount,
            'std_rowcount': std_rowcount,
            'top_assets': top_assets,
            'top_destinations': top_destinations
        })
        
    # Add defaults for users with no logs
    for user_id, u_info in users_dict.items():
        if user_id not in logs_df['user_id'].values:
            # Create a mock baseline from user profile
            typical_hours = u_info.get('typical_access_hours', [8,9,10,11,12,13,14,15,16,17])
            if isinstance(typical_hours, str):
                typical_hours = json.loads(typical_hours)
            
            baselines.append({
                'user_id': user_id,
                'typical_hours': typical_hours,
                'avg_queries': float(u_info.get('avg_queries_per_day', 10)),
                'std_queries': float(u_info.get('avg_queries_per_day', 10)) * 0.3,
                'avg_rowcount': float(u_info.get('avg_rowcount_per_query', 500)),
                'std_rowcount': float(u_info.get('avg_rowcount_per_query', 500)) * 0.4,
                'top_assets': [{"asset": a, "count": 1} for a in u_info.get('approved_data_assets', [])[:2]],
                'top_destinations': [{"destination": "INTERNAL", "count": 1}]
            })
            
    return baselines

def train_isolation_forest(logs_df):
    """
    Trains an Isolation Forest on numeric features derived from the logs.
    Returns the fitted model.
    """
    if len(logs_df) < 20:
        return None
        
    df = logs_df.copy()
    df['hour'] = df['timestamp'].apply(parse_hour_from_timestamp)
    
    # Map sensitivity to numeric
    sens_map = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
    df['sens_num'] = df['data_sensitivity'].map(sens_map).fillna(1)
    
    # Map query type
    q_map = {'SELECT': 1, 'UPDATE': 2, 'DELETE': 3, 'INSERT': 4, 'EXPORT': 5}
    df['q_num'] = df['query_type'].map(q_map).fillna(1)
    
    # Features: hour, rowcount, sens_num, q_num
    X = df[['hour', 'rowcount', 'sens_num', 'q_num']].values
    
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X)
    return model

def evaluate_log(log, users_dict, baselines_dict, iso_forest_model=None, prior_access_set=None):
    """
    Evaluates a single log event and calculates rule matches, anomalies, risk score, severity, and AI narrative.
    
    log: dict representing a log event
    users_dict: dict of user profiles (key: user_id)
    baselines_dict: dict of user baselines (key: user_id)
    iso_forest_model: trained Isolation Forest model
    prior_access_set: set of (user_id, data_asset) for first-time access evaluation
    """
    user_id = log['user_id']
    username = log['username']
    department = log['department']
    data_asset = log['data_asset']
    sensitivity = log['data_sensitivity']
    query_type = log['query_type']
    rowcount = int(log['rowcount'])
    destination = log['destination']
    timestamp = log['timestamp']
    
    # Fetch user info & baseline
    u_info = users_dict.get(user_id, {})
    baseline = baselines_dict.get(user_id, {})
    
    # If no baseline exists, set default
    if not baseline:
        typical_hours = list(range(8, 18))
        avg_queries = 15.0
        std_queries = 5.0
        avg_rowcount = 500.0
        std_rowcount = 200.0
        approved_assets = []
    else:
        typical_hours = baseline.get('typical_hours', list(range(8, 18)))
        avg_queries = baseline.get('avg_queries', 15.0)
        std_queries = baseline.get('std_queries', 5.0)
        avg_rowcount = baseline.get('avg_rowcount', 500.0)
        std_rowcount = baseline.get('std_rowcount', 200.0)
        approved_assets = [a['asset'] for a in baseline.get('top_assets', [])]
        
    hour = parse_hour_from_timestamp(timestamp)
    
    # --- 1. Rule-Based Evaluation ---
    rules_violated = []
    
    # Rule 1: Off-hours access
    if hour not in typical_hours:
        rules_violated.append("Off-hours Access")
        
    # Rule 2: Restricted data access
    if sensitivity in ['HIGH', 'CRITICAL']:
        rules_violated.append("Restricted Data Access")
        
    # Rule 3: Bulk export
    if rowcount > 10000:
        rules_violated.append("Bulk Export (>10k rows)")
        
    # Rule 4: External email
    if is_external_email(destination):
        rules_violated.append("External Email Destination")
        
    # Rule 5: USB destination
    if is_usb_dest(destination):
        rules_violated.append("USB Destination")
        
    # Rule 6: Non-approved asset
    # Check both profile and computed baseline
    profile_approved = u_info.get('approved_data_assets', [])
    if isinstance(profile_approved, str):
        try:
            profile_approved = json.loads(profile_approved)
        except Exception:
            profile_approved = []
    
    if data_asset not in profile_approved and data_asset not in approved_assets:
        rules_violated.append("Non-Approved Asset Access")
        
    # Rule 7: Cross-department access
    if is_cross_department(department, data_asset):
        rules_violated.append("Cross-Department Access")
        
    # Rule 8: First-time access to sensitive systems
    is_first_time = False
    if prior_access_set is not None:
        if (user_id, data_asset) not in prior_access_set:
            is_first_time = True
            
    if is_first_time and sensitivity in ['HIGH', 'CRITICAL']:
        rules_violated.append("First-Time Sensitive Access")
        
    # Calculate rule score
    rule_points = sum(RULE_WEIGHTS[r] for r in rules_violated)
    rule_score = min(100, rule_points * 1.5)  # Scale so that multiple rules push it to 100
    
    # --- 2. Statistical Anomaly Evaluation ---
    anomalies_detected = []
    statistical_points = 0
    
    # Z-Score for Rowcount
    z_rowcount = (rowcount - avg_rowcount) / std_rowcount if std_rowcount > 0 else 0
    if z_rowcount > 3.0:
        anomalies_detected.append("Abnormal Row Count (Z-Score: {:.2f})".format(z_rowcount))
        statistical_points += 30
    elif z_rowcount > 2.0:
        anomalies_detected.append("Elevated Row Count (Z-Score: {:.2f})".format(z_rowcount))
        statistical_points += 15
        
    # IQR for Rowcount (Alternative threshold)
    # We can model IQR anomaly by looking at rowcount exceeding median + 1.5 * IQR.
    # If standard deviation is high, IQR helps capture strict bounds.
    # For a log event, if rowcount > 5 * avg_rowcount, it is also flagged.
    if rowcount > (avg_rowcount + 3 * std_rowcount):
        anomalies_detected.append("Abnormal Query Size (IQR Outlier)")
        statistical_points += 20
        
    # Hour pattern deviation
    if hour not in typical_hours:
        # Check distance to nearest typical hour
        min_dist = min(abs(hour - th) for th in typical_hours) if typical_hours else 12
        if min_dist >= 4:
            anomalies_detected.append("Unusual Access Time ({} hrs offset)".format(min_dist))
            statistical_points += 25
            
    # Isolation Forest Anomaly
    if iso_forest_model is not None:
        sens_map = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
        q_map = {'SELECT': 1, 'UPDATE': 2, 'DELETE': 3, 'INSERT': 4, 'EXPORT': 5}
        x_val = np.array([[hour, rowcount, sens_map.get(sensitivity, 1), q_map.get(query_type, 1)]])
        pred = iso_forest_model.predict(x_val)[0]
        decision = iso_forest_model.decision_function(x_val)[0]
        if pred == -1:
            anomalies_detected.append("Multi-Dimensional Behavior Anomaly (Isolation Forest)")
            statistical_points += 40
            
    anomaly_score = min(100, statistical_points)
    
    # --- 3. Sensitivity Score ---
    sens_score_map = {'LOW': 25, 'MEDIUM': 50, 'HIGH': 75, 'CRITICAL': 100}
    sensitivity_score = sens_score_map.get(sensitivity, 25)
    
    # --- 4. Risk Scoring Engine ---
    # Weighting:
    # Rule Violations = 40%
    # Statistical Anomaly = 40%
    # Data Sensitivity = 20%
    final_risk_score = (0.40 * rule_score) + (0.40 * anomaly_score) + (0.20 * sensitivity_score)
    final_risk_score = round(max(0.0, min(100.0, final_risk_score)), 1)
    
    # Severity Levels:
    # 0-25 = LOW, 26-50 = MEDIUM, 51-75 = HIGH, 76-100 = CRITICAL
    if final_risk_score >= 76:
        severity = 'CRITICAL'
    elif final_risk_score >= 51:
        severity = 'HIGH'
    elif final_risk_score >= 26:
        severity = 'MEDIUM'
    else:
        severity = 'LOW'
        
    # --- 5. AI Investigation Narrative ---
    narrative = generate_ai_narrative(
        username=username,
        role=u_info.get('role', 'User'),
        department=department,
        rowcount=rowcount,
        sensitivity=sensitivity,
        data_asset=data_asset,
        timestamp=timestamp,
        rules_violated=rules_violated,
        anomalies_detected=anomalies_detected,
        destination=destination,
        avg_rowcount=avg_rowcount,
        typical_hours=typical_hours,
        risk_score=final_risk_score,
        severity=severity
    )
    
    # Recommendation
    recommendation = "Monitor"
    if severity == 'CRITICAL':
        recommendation = "Block Account"
    elif severity == 'HIGH':
        recommendation = "Escalate"
    elif severity == 'MEDIUM':
        recommendation = "Review"
        
    return {
        'timestamp': timestamp,
        'user_id': user_id,
        'username': username,
        'department': department,
        'data_asset': data_asset,
        'data_sensitivity': sensitivity,
        'query_type': query_type,
        'rowcount': rowcount,
        'access_method': log['access_method'],
        'destination': destination,
        'risk_score': final_risk_score,
        'severity': severity,
        'rules_violated': rules_violated,
        'anomalies_detected': anomalies_detected,
        'ai_narrative': narrative,
        'status': 'OPEN'
    }

def generate_ai_narrative(username, role, department, rowcount, sensitivity, data_asset, timestamp, 
                           rules_violated, anomalies_detected, destination, avg_rowcount, typical_hours, 
                           risk_score, severity):
    """
    Generates a natural-sounding narrative report explaining the suspicious behavior.
    """
    time_str = timestamp.split(' ')[1] if ' ' in timestamp else timestamp
    
    rules_text = ", ".join(rules_violated) if rules_violated else "None"
    anoms_text = "; ".join(anomalies_detected) if anomalies_detected else "None"
    
    hour_list_str = ", ".join(f"{h:02d}:00" for h in sorted(typical_hours)) if typical_hours else "Standard Business Hours"
    
    # Calculate volume multiplier
    vol_mult = rowcount / avg_rowcount if avg_rowcount > 0 else 1.0
    
    # Sentence 1: Core Action Summary
    narrative = f"User {username} (Role: {role}, Dept: {department}) accessed the data asset '{data_asset}' (Sensitivity: {sensitivity}) at {time_str} via a database query, retrieving {rowcount:,} records and exporting to '{destination}'."
    
    # Sentence 2: Anomaly and rule violation details
    anom_details = []
    if "Off-hours Access" in rules_violated:
        anom_details.append(f"occurred outside their normal access window ({hour_list_str})")
    if vol_mult > 3.0:
        anom_details.append(f"exceeded their average query volume ({avg_rowcount:,.0f} records) by {vol_mult:.1f}x")
    if "USB Destination" in rules_violated:
        anom_details.append("targeted a local USB/removable media storage device, posing exfiltration risk")
    elif "External Email Destination" in rules_violated:
        anom_details.append(f"targeted an external public email address ({destination})")
    if "Cross-Department Access" in rules_violated:
        anom_details.append(f"accessed a data asset belonging to another department domain")
    if "First-Time Sensitive Access" in rules_violated:
        anom_details.append("involved their first documented interaction with this highly sensitive asset")
        
    if anom_details:
        narrative += " This action " + " and ".join(anom_details) + "."
    else:
        narrative += " This action conformed mostly to structural patterns but triggered minor alert thresholds."
        
    # Sentence 3: Risk Summary & Recommendation
    recs = {
        'CRITICAL': "immediate account containment, locking credentials, and network isolation",
        'HIGH': "escalation to the security response team for active forensic review",
        'MEDIUM': "scheduling a supervisor review and placing the user under active monitoring",
        'LOW': "continued automated surveillance"
    }
    
    narrative += f" Consequently, the system generated a {severity} risk profile (Score: {risk_score}/100) and recommends {recs.get(severity, 'continued observation')}."
    
    return narrative
