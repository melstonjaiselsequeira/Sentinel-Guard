import os
import csv
import io
import json
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import pandas as pd

import database
import detection_engine
import report_generator
import import_dataset

app = Flask(__name__)
# Enable CORS for all routes (important for development React frontend)
CORS(app)

# Ensure the database is initialized
database.init_db()

# Ensure reports directory exists
REPORTS_DIR = os.path.join(os.path.dirname(__file__), 'reports')
os.makedirs(REPORTS_DIR, exist_ok=True)


@app.route('/api/ingest/logs', methods=['POST'])
def ingest_logs():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    try:
        # Read the file content
        stream = io.StringIO(file.stream.read().decode("utf8"), newline=None)
        reader = csv.DictReader(stream)
        
        # Load active baselines and users for evaluation
        users_dict = database.get_users_dict()
        baselines_dict = database.get_user_baselines_dict()
        
        # Train Isolation Forest on existing database logs
        conn = database.get_db_connection()
        db_logs = pd.read_sql_query("SELECT * FROM access_logs", conn)
        conn.close()
        
        iso_forest = None
        if len(db_logs) > 20:
            iso_forest = detection_engine.train_isolation_forest(db_logs)
            
        prior_access_set = set()
        if not db_logs.empty:
            for _, row in db_logs.iterrows():
                prior_access_set.add((row['user_id'], row['data_asset']))
                
        imported_count = 0
        evaluated_logs = []
        rows_list = list(reader)
        
        if not rows_list:
            return jsonify({'error': 'CSV file is empty'}), 400

        # Auto-detect schema: standard vs. sample_data alternate schema
        first_row_keys = set(rows_list[0].keys())
        is_alternate_schema = 'action' in first_row_keys and 'resource' in first_row_keys

        for row in rows_list:
            if is_alternate_schema:
                # Remap alternate schema columns to standard schema
                action      = str(row.get('action', 'sql_query')).strip().lower()
                sensitivity = import_dataset.SENSITIVITY_MAP.get(
                    str(row.get('resource_sensitivity', 'low')).strip().lower(), 'LOW'
                )
                resource    = str(row.get('resource', 'unknown')).strip()
                user_id     = str(row.get('user_id', '')).strip()
                u_info      = users_dict.get(user_id, {})
                norm_row = {
                    'timestamp':        str(row['timestamp']).strip(),
                    'user_id':          user_id,
                    'username':         str(row.get('username', '')).strip(),
                    'department':       u_info.get('department', 'Unknown'),
                    'data_asset':       import_dataset.RESOURCE_TO_ASSET.get(resource, resource.lower().replace(' ', '_')),
                    'data_sensitivity': sensitivity,
                    'query_type':       import_dataset.ACTION_TO_QUERY_TYPE.get(action, 'SELECT'),
                    'rowcount':         import_dataset.derive_rowcount(
                                            import_dataset.ACTION_TO_QUERY_TYPE.get(action, 'SELECT'),
                                            sensitivity
                                        ),
                    'access_method':    import_dataset.derive_access_method(action, row.get('source_ip', '')),
                    'destination':      import_dataset.derive_destination(action, row.get('username', ''), ''),
                }
            else:
                # Standard schema — validate required columns
                required_cols = ['timestamp', 'user_id', 'username', 'department', 'data_asset',
                                 'data_sensitivity', 'query_type', 'rowcount', 'access_method', 'destination']
                if not all(col in row for col in required_cols):
                    return jsonify({'error': f'Missing columns in CSV. Required: {required_cols}'}), 400
                norm_row = row

            # Run evaluation
            eval_log = detection_engine.evaluate_log(
                log=norm_row,
                users_dict=users_dict,
                baselines_dict=baselines_dict,
                iso_forest_model=iso_forest,
                prior_access_set=prior_access_set
            )
            evaluated_logs.append(eval_log)
            prior_access_set.add((norm_row['user_id'], norm_row['data_asset']))
            imported_count += 1
            
        if evaluated_logs:
            database.save_logs(evaluated_logs)
            
        return jsonify({
            'success': True,
            'message': f'Successfully ingested and analyzed {imported_count} access logs.',
            'count': imported_count
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to process CSV file: {str(e)}'}), 500


@app.route('/api/ingest/profiles', methods=['POST'])
def ingest_profiles():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    try:
        stream = io.StringIO(file.stream.read().decode("utf8"), newline=None)
        reader = csv.DictReader(stream)
        
        users_list = []
        for row in reader:
            # Validation
            required_cols = ['user_id', 'username', 'department', 'role', 'tenure_months', 'approved_data_assets', 'typical_access_hours', 'avg_queries_per_day', 'avg_rowcount_per_query']
            if not all(col in row for col in required_cols):
                return jsonify({'error': f'Missing columns. Required: {required_cols}'}), 400
                
            # Process array columns
            try:
                approved = json.loads(row['approved_data_assets'])
            except Exception:
                approved = [x.strip() for x in row['approved_data_assets'].split(',') if x.strip()]
                
            try:
                typical = json.loads(row['typical_access_hours'])
            except Exception:
                typical = [int(x.strip()) for x in row['typical_access_hours'].split(',') if x.strip()]
                
            users_list.append({
                'user_id': row['user_id'],
                'username': row['username'],
                'department': row['department'],
                'role': row['role'],
                'tenure_months': int(row['tenure_months']),
                'approved_data_assets': approved,
                'typical_access_hours': typical,
                'avg_queries_per_day': float(row['avg_queries_per_day']),
                'avg_rowcount_per_query': float(row['avg_rowcount_per_query'])
            })
            
        if users_list:
            database.save_users(users_list)
            
            # Recalculate baselines since profile rules updated
            conn = database.get_db_connection()
            logs_df = pd.read_sql_query("SELECT * FROM access_logs", conn)
            conn.close()
            
            users_dict = database.get_users_dict()
            if not logs_df.empty:
                baselines = detection_engine.compute_baselines_from_logs(logs_df, users_dict)
                database.save_baselines(baselines)
                
        return jsonify({
            'success': True,
            'message': f'Successfully ingested and registered {len(users_list)} user profiles.',
            'count': len(users_list)
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to process user profile CSV: {str(e)}'}), 500


@app.route('/api/dashboard/summary', methods=['GET'])
def get_summary():
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        # Total events
        cursor.execute("SELECT COUNT(*) FROM access_logs")
        total_events = cursor.fetchone()[0]
        
        # Total users
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        # Anomalies / Alerts detected (Risk Score > 25, which corresponds to MEDIUM, HIGH, CRITICAL severity)
        cursor.execute("SELECT COUNT(*) FROM access_logs WHERE risk_score > 25")
        anomalies_detected = cursor.fetchone()[0]
        
        # Critical alerts
        cursor.execute("SELECT COUNT(*) FROM access_logs WHERE severity = 'CRITICAL'")
        critical_alerts = cursor.fetchone()[0]
        
        # High Risk Users (Distinct users with any HIGH or CRITICAL alert)
        cursor.execute("SELECT COUNT(DISTINCT user_id) FROM access_logs WHERE severity IN ('HIGH', 'CRITICAL')")
        high_risk_users = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'total_events': total_events,
            'total_users': total_users,
            'anomalies_detected': anomalies_detected,
            'critical_alerts': critical_alerts,
            'high_risk_users': high_risk_users
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/dashboard/charts', methods=['GET'])
def get_charts_data():
    try:
        conn = database.get_db_connection()
        
        # 1. Risk Trend over time
        risk_trend = pd.read_sql_query('''
            SELECT SUBSTR(timestamp, 1, 10) as date, 
                   COUNT(*) as total_events,
                   SUM(CASE WHEN severity IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END) as high_risk_alerts,
                   ROUND(AVG(risk_score), 1) as avg_risk
            FROM access_logs
            GROUP BY date
            ORDER BY date ASC
        ''', conn).to_dict(orient='records')
        
        # 2. Alerts by department
        dept_alerts = pd.read_sql_query('''
            SELECT department,
                   SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low,
                   SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium,
                   SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high,
                   SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
                   COUNT(*) as total
            FROM access_logs
            GROUP BY department
        ''', conn).to_dict(orient='records')
        
        # 3. Severity Distribution
        severity_dist = pd.read_sql_query('''
            SELECT severity as name, COUNT(*) as value
            FROM access_logs
            GROUP BY severity
        ''', conn).to_dict(orient='records')
        
        # 4. Top Risky Users
        top_users = pd.read_sql_query('''
            SELECT username, department, 
                   MAX(risk_score) as max_score, 
                   ROUND(AVG(risk_score), 1) as avg_score,
                   COUNT(*) as event_count
            FROM access_logs
            GROUP BY user_id, username, department
            ORDER BY max_score DESC
            LIMIT 5
        ''', conn).to_dict(orient='records')
        
        # 5. Top Sensitive Assets Accessed
        top_assets = pd.read_sql_query('''
            SELECT data_asset as name, COUNT(*) as count
            FROM access_logs
            WHERE data_sensitivity IN ('HIGH', 'CRITICAL')
            GROUP BY data_asset
            ORDER BY count DESC
            LIMIT 5
        ''', conn).to_dict(orient='records')
        
        # 6. Heatmap Data (Department Risk Heatmap: Department vs. Hour Bucket)
        # Buckets: Night (0-5), Morning (6-11), Afternoon (12-17), Evening (18-23)
        logs = pd.read_sql_query("SELECT department, timestamp, risk_score FROM access_logs", conn)
        conn.close()
        
        heatmap_data = []
        if not logs.empty:
            logs['hour'] = logs['timestamp'].apply(detection_engine.parse_hour_from_timestamp)
            def get_bucket(h):
                if 0 <= h <= 5: return 'Night (00-05)'
                elif 6 <= h <= 11: return 'Morning (06-11)'
                elif 12 <= h <= 17: return 'Afternoon (12-17)'
                else: return 'Evening (18-23)'
            logs['hour_bucket'] = logs['hour'].apply(get_bucket)
            
            heatmap_pivot = logs.groupby(['department', 'hour_bucket'])['risk_score'].mean().reset_index()
            heatmap_data = heatmap_pivot.to_dict(orient='records')
            
        return jsonify({
            'risk_trend': risk_trend,
            'department_alerts': dept_alerts,
            'severity_dist': severity_dist,
            'top_users': top_users,
            'top_assets': top_assets,
            'heatmap_data': heatmap_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/departments', methods=['GET'])
def get_departments():
    """Return the sorted list of all distinct departments present in the access_logs table."""
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT department
            FROM access_logs
            WHERE department IS NOT NULL AND department != ''
            ORDER BY department ASC
        """)
        rows = cursor.fetchall()
        conn.close()
        departments = [r['department'] for r in rows]
        return jsonify(departments)
    except Exception as e:
        return jsonify({'error': str(e)}), 500




@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        severity = request.args.get('severity')
        department = request.args.get('department')
        user = request.args.get('user')
        search = request.args.get('search')
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        
        query = "SELECT id, timestamp, username, department, data_asset, risk_score, severity, status FROM access_logs WHERE 1=1"
        params = []
        
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        if department:
            query += " AND department = ?"
            params.append(department)
        if user:
            query += " AND username LIKE ?"
            params.append(f"%{user}%")
        if start_date:
            # DB timestamps are stored as 'DD-MM-YYYY HH:MM:SS'
            # Reconstruct as YYYY-MM-DD for ISO comparison with the picker value
            query += (
                " AND (SUBSTR(timestamp,7,4) || '-' || SUBSTR(timestamp,4,2) || '-' || SUBSTR(timestamp,1,2)) >= ?"
            )
            params.append(start_date)
        if end_date:
            query += (
                " AND (SUBSTR(timestamp,7,4) || '-' || SUBSTR(timestamp,4,2) || '-' || SUBSTR(timestamp,1,2)) <= ?"
            )
            params.append(end_date)
        if search:
            query += " AND (username LIKE ? OR department LIKE ? OR data_asset LIKE ? OR destination LIKE ?)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param, search_param])
            
        # Sort by timestamp desc, then risk score desc
        query += " ORDER BY timestamp DESC, risk_score DESC"
        
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        alerts = []
        for r in rows:
            alerts.append({
                'id': r['id'],
                'timestamp': r['timestamp'],
                'username': r['username'],
                'department': r['department'],
                'data_asset': r['data_asset'],
                'risk_score': r['risk_score'],
                'severity': r['severity'],
                'status': r['status']
            })
            
        return jsonify(alerts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/<int:alert_id>', methods=['GET'])
def get_alert_detail(alert_id):
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        # Get log entry
        cursor.execute("SELECT * FROM access_logs WHERE id = ?", (alert_id,))
        log_row = cursor.fetchone()
        
        if not log_row:
            conn.close()
            return jsonify({'error': 'Alert not found'}), 404
            
        # Get profile
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (log_row['user_id'],))
        user_row = cursor.fetchone()
        
        # Get baseline
        cursor.execute("SELECT * FROM user_baselines WHERE user_id = ?", (log_row['user_id'],))
        baseline_row = cursor.fetchone()
        
        conn.close()
        
        # Format baseline JSON
        baseline_data = None
        if baseline_row:
            baseline_data = {
                'typical_hours': json.loads(baseline_row['typical_hours']),
                'avg_queries': baseline_row['avg_queries'],
                'std_queries': baseline_row['std_queries'],
                'avg_rowcount': baseline_row['avg_rowcount'],
                'std_rowcount': baseline_row['std_rowcount'],
                'top_assets': json.loads(baseline_row['top_assets']),
                'top_destinations': json.loads(baseline_row['top_destinations'])
            }
            
        user_data = None
        if user_row:
            user_data = {
                'user_id': user_row['user_id'],
                'username': user_row['username'],
                'department': user_row['department'],
                'role': user_row['role'],
                'tenure_months': user_row['tenure_months'],
                'approved_data_assets': json.loads(user_row['approved_data_assets']) if user_row['approved_data_assets'] else []
            }
            
        alert_detail = {
            'id': log_row['id'],
            'timestamp': log_row['timestamp'],
            'user_id': log_row['user_id'],
            'username': log_row['username'],
            'department': log_row['department'],
            'data_asset': log_row['data_asset'],
            'data_sensitivity': log_row['data_sensitivity'],
            'query_type': log_row['query_type'],
            'rowcount': log_row['rowcount'],
            'access_method': log_row['access_method'],
            'destination': log_row['destination'],
            'risk_score': log_row['risk_score'],
            'severity': log_row['severity'],
            'rules_violated': json.loads(log_row['rules_violated']) if log_row['rules_violated'] else [],
            'anomalies_detected': json.loads(log_row['anomalies_detected']) if log_row['anomalies_detected'] else [],
            'ai_narrative': log_row['ai_narrative'],
            'status': log_row['status'],
            'user_profile': user_data,
            'user_baseline': baseline_data
        }
        
        return jsonify(alert_detail)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/<int:alert_id>/action', methods=['POST'])
def take_alert_action(alert_id):
    try:
        data = request.json
        new_status = data.get('status') # e.g. ESCALATED, UNDER_INVESTIGATION, CLOSED_RESOLVED, CLOSED_FALSE_POSITIVE
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
            
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE access_logs SET status = ? WHERE id = ?", (new_status, alert_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Alert not found'}), 404
            
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': f'Alert status updated to {new_status}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/<int:alert_id>/pdf', methods=['GET'])
def download_pdf(alert_id):
    try:
        pdf_filename = f"incident_report_{alert_id}.pdf"
        pdf_path = os.path.join(REPORTS_DIR, pdf_filename)
        
        # Generate the PDF
        report_generator.generate_pdf_report(alert_id, pdf_path)
        
        return send_file(
            pdf_path,
            as_attachment=True,
            download_name=pdf_filename,
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({'error': f'Failed to generate PDF: {str(e)}'}), 500




@app.route('/api/import-dataset', methods=['POST'])
def import_sample_dataset():
    """Trigger full import of the sample_data/ CSVs into the database."""
    try:
        import_dataset.run_import()
        # Return updated summary counts
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM access_logs")
        total_events = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM access_logs WHERE severity IN ('HIGH','CRITICAL')")
        high_risk = cursor.fetchone()[0]
        conn.close()
        return jsonify({
            'success': True,
            'message': f'Successfully imported sample dataset: {total_events:,} events from {total_users} users.',
            'total_events': total_events,
            'total_users': total_users,
            'high_risk_alerts': high_risk
        })
    except Exception as e:
        return jsonify({'error': f'Dataset import failed: {str(e)}'}), 500


@app.route('/api/refresh-analysis', methods=['POST'])
def refresh_analysis():
    """Recalculate baselines, retrain Isolation Forest, and recompute risk scores for all events."""
    try:
        conn = database.get_db_connection()
        # Read raw columns from access_logs (ignoring previous scoring output columns to prevent pollution)
        db_logs = pd.read_sql_query("""
            SELECT timestamp, user_id, username, department, data_asset, 
                   data_sensitivity, query_type, rowcount, access_method, 
                   destination, status 
            FROM access_logs
        """, conn)
        conn.close()

        if db_logs.empty:
            return jsonify({'success': True, 'message': 'No logs in database to analyze.'})

        # Load users dict
        users_dict = database.get_users_dict()

        # Recompute baselines
        baselines = detection_engine.compute_baselines_from_logs(db_logs, users_dict)
        database.save_baselines(baselines)
        baselines_dict = database.get_user_baselines_dict()

        # Retrain Isolation Forest
        iso_forest = detection_engine.train_isolation_forest(db_logs)

        # Recompute logs
        evaluated_logs = []
        prior_access_set = set()
        
        # Sort by timestamp to correctly recompute sequential "first-time access" triggers
        db_logs_sorted = db_logs.sort_values('timestamp')
        
        for _, row in db_logs_sorted.iterrows():
            log_item = {
                'timestamp': row['timestamp'],
                'user_id': row['user_id'],
                'username': row['username'],
                'department': row['department'],
                'data_asset': row['data_asset'],
                'data_sensitivity': row['data_sensitivity'],
                'query_type': row['query_type'],
                'rowcount': row['rowcount'],
                'access_method': row['access_method'],
                'destination': row['destination'],
            }
            eval_log = detection_engine.evaluate_log(
                log=log_item,
                users_dict=users_dict,
                baselines_dict=baselines_dict,
                iso_forest_model=iso_forest,
                prior_access_set=prior_access_set
            )
            eval_log['status'] = row['status']
            evaluated_logs.append(eval_log)
            prior_access_set.add((row['user_id'], row['data_asset']))

        # Clear and save updated logs
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM access_logs")
        conn.commit()
        conn.close()

        database.save_logs(evaluated_logs)

        # Query counts for return
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM access_logs")
        total_events = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM access_logs WHERE severity IN ('HIGH','CRITICAL')")
        high_risk = cursor.fetchone()[0]
        conn.close()

        return jsonify({
            'success': True,
            'message': 'Successfully recalculated baselines, retrained anomaly models, and refreshed score parameters.',
            'total_events': total_events,
            'high_risk_alerts': high_risk
        })
    except Exception as e:
        return jsonify({'error': f'Failed to refresh analysis: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
