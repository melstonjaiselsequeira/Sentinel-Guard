import os
import json
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import database

def get_severity_color(severity):
    sev = severity.upper()
    if sev == 'CRITICAL':
        return colors.HexColor("#ef4444")  # Red
    elif sev == 'HIGH':
        return colors.HexColor("#f97316")  # Orange
    elif sev == 'MEDIUM':
        return colors.HexColor("#eab308")  # Yellow
    else:
        return colors.HexColor("#22c55e")  # Green

def generate_pdf_report(alert_id, dest_path):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM access_logs WHERE id = ?', (alert_id,))
    alert = cursor.fetchone()
    
    if not alert:
        conn.close()
        raise ValueError(f"Alert with ID {alert_id} not found.")
        
    cursor.execute('SELECT * FROM users WHERE user_id = ?', (alert['user_id'],))
    user = cursor.fetchone()
    
    cursor.execute('SELECT * FROM user_baselines WHERE user_id = ?', (alert['user_id'],))
    baseline = cursor.fetchone()
    conn.close()
    
    doc = SimpleDocTemplate(
        dest_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=20
    )
    
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )
    
    narrative_style = ParagraphStyle(
        'NarrativeText',
        parent=body_style,
        fontName='Helvetica-Oblique',
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor('#1e293b')
    )
    
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#334155')
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.white
    )
    
    story = []
    
    # 1. Header Band
    story.append(Paragraph("SENTINELGUARD SECURITY INCIDENT REPORT", title_style))
    story.append(Paragraph(f"INCIDENT REF: SG-2026-{alert['id']:04d}  |  STATUS: {alert['status']}  |  GENERATED: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style))
    
    # 2. Executive Alert Banner
    sev_color = get_severity_color(alert['severity'])
    banner_data = [
        [
            Paragraph(f"<font color='white'><b>RISK SEVERITY: {alert['severity']}</b></font>", table_header_style),
            Paragraph(f"<font color='white'><b>RISK SCORE: {alert['risk_score']}/100</b></font>", table_header_style)
        ]
    ]
    banner_table = Table(banner_data, colWidths=[270, 270])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), sev_color),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 15))
    
    # 3. Subject Information & Event Metadata
    story.append(Paragraph("1. Incident Summary & Profiles", heading_style))
    
    meta_data = [
        [
            Paragraph("<b>Subject User</b>", table_cell_style),
            Paragraph(alert['username'], table_cell_style),
            Paragraph("<b>Timestamp</b>", table_cell_style),
            Paragraph(alert['timestamp'], table_cell_style)
        ],
        [
            Paragraph("<b>Department</b>", table_cell_style),
            Paragraph(alert['department'], table_cell_style),
            Paragraph("<b>Data Asset</b>", table_cell_style),
            Paragraph(alert['data_asset'], table_cell_style)
        ],
        [
            Paragraph("<b>Role</b>", table_cell_style),
            Paragraph(user['role'] if user else "Unknown", table_cell_style),
            Paragraph("<b>Data Sensitivity</b>", table_cell_style),
            Paragraph(alert['data_sensitivity'], table_cell_style)
        ],
        [
            Paragraph("<b>Tenure</b>", table_cell_style),
            Paragraph(f"{user['tenure_months']} months" if user else "N/A", table_cell_style),
            Paragraph("<b>Access Method</b>", table_cell_style),
            Paragraph(alert['access_method'], table_cell_style)
        ],
        [
            Paragraph("<b>Export Rowcount</b>", table_cell_style),
            Paragraph(f"{alert['rowcount']:,} records", table_cell_style),
            Paragraph("<b>Destination</b>", table_cell_style),
            Paragraph(alert['destination'], table_cell_style)
        ]
    ]
    
    meta_table = Table(meta_data, colWidths=[100, 170, 100, 170])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))
    
    # 4. Behavioral Baseline vs Actual Access
    story.append(Paragraph("2. Subject Behavioral Baseline Statistics", heading_style))
    if baseline:
        b_hours = json.loads(baseline['typical_hours'])
        hours_str = ", ".join(f"{h:02d}:00" for h in sorted(b_hours))
        
        base_data = [
            [
                Paragraph("<b>Baseline Metric</b>", table_header_style),
                Paragraph("<b>Established User Baseline</b>", table_header_style),
                Paragraph("<b>Observed Current Activity</b>", table_header_style)
            ],
            [
                Paragraph("Typical Access Hours", table_cell_style),
                Paragraph(hours_str if hours_str else "N/A", table_cell_style),
                Paragraph(f"{detection_engine.parse_hour_from_timestamp(alert['timestamp'])}:00", table_cell_style)
            ],
            [
                Paragraph("Average Records Accessed", table_cell_style),
                Paragraph(f"{baseline['avg_rowcount']:,.1f} ± {baseline['std_rowcount']:,.1f}", table_cell_style),
                Paragraph(f"{alert['rowcount']:,} records", table_cell_style)
            ],
            [
                Paragraph("Primary Destinations", table_cell_style),
                Paragraph(", ".join([d['destination'] for d in json.loads(baseline['top_destinations'])[:3]]), table_cell_style),
                Paragraph(alert['destination'], table_cell_style)
            ]
        ]
    else:
        base_data = [
            [
                Paragraph("<b>Baseline Metric</b>", table_header_style),
                Paragraph("<b>Established User Baseline</b>", table_header_style),
                Paragraph("<b>Observed Current Activity</b>", table_header_style)
            ],
            [
                Paragraph("Profile Base Hours", table_cell_style),
                Paragraph("Standard Business Hours (08:00 - 18:00)", table_cell_style),
                Paragraph(f"{detection_engine.parse_hour_from_timestamp(alert['timestamp'])}:00", table_cell_style)
            ],
            [
                Paragraph("Average Records Accessed", table_cell_style),
                Paragraph(f"Avg: {user['avg_rowcount_per_query'] if user else 500} rows", table_cell_style),
                Paragraph(f"{alert['rowcount']:,} records", table_cell_style)
            ]
        ]
        
    base_table = Table(base_data, colWidths=[150, 220, 170])
    base_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(base_table)
    story.append(Spacer(1, 15))
    
    # 5. Security Violations & Anomalies
    story.append(Paragraph("3. Log Ingestion Rule Violations & Anomaly Indicators", heading_style))
    rules_violated = json.loads(alert['rules_violated']) if alert['rules_violated'] else []
    anoms_detected = json.loads(alert['anomalies_detected']) if alert['anomalies_detected'] else []
    
    violations_data = []
    if rules_violated:
        violations_data.append([Paragraph("<b>Rule Violations Checked:</b>", table_cell_style), Paragraph("<br/>".join([f"• {r} (Weight: {detection_engine.RULE_WEIGHTS.get(r, 10)})" for r in rules_violated]), table_cell_style)])
    else:
        violations_data.append([Paragraph("<b>Rule Violations Checked:</b>", table_cell_style), Paragraph("No predefined static security rules violated.", table_cell_style)])
        
    if anoms_detected:
        violations_data.append([Paragraph("<b>Statistical Anomalies:</b>", table_cell_style), Paragraph("<br/>".join([f"• {a}" for a in anoms_detected]), table_cell_style)])
    else:
        violations_data.append([Paragraph("<b>Statistical Anomalies:</b>", table_cell_style), Paragraph("No statistical anomalies detected.", table_cell_style)])
        
    v_table = Table(violations_data, colWidths=[150, 390])
    v_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(v_table)
    story.append(Spacer(1, 15))
    
    # 6. AI Analysis & Narrative
    story.append(Paragraph("4. AI Investigation Narrative", heading_style))
    narrative_p = Paragraph(alert['ai_narrative'] if alert['ai_narrative'] else "No auto-narrative available.", narrative_style)
    narrative_table = Table([[narrative_p]], colWidths=[540])
    narrative_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(narrative_table)
    story.append(Spacer(1, 15))
    
    # 7. Remediation and Action Checklist
    story.append(Paragraph("5. Recommended Action Framework", heading_style))
    rec_actions = {
        'CRITICAL': [
            "Immediate Lock: Suspend credentials and directory access for subject user account.",
            "Security Isolation: Isolate any endpoints used by subject user from enterprise network.",
            "Device Check: Terminate any active VPN / cloud portal access tokens.",
            "Forensics: Initiate incident response protocol and collect endpoint syslogs."
        ],
        'HIGH': [
            "Escalation: Elevate this file to Level 2 security response team.",
            "Supervisor Notification: Inform department manager of subject user's anomalous database operations.",
            "Historical Review: Verify prior 7 days of logs for user search pattern expansion.",
            "User Interview: Conduct audit check verification call with user."
        ],
        'MEDIUM': [
            "Supervisor Verification: Confirm with department manager if this activity was pre-approved.",
            "Log Monitoring: Set user under temporary active observation rule (14 days).",
            "Access Correction: Recalculate if user's approved_data_assets is overly broad."
        ],
        'LOW': [
            "Automated Tracking: Standard observation. No direct alert intervention necessary.",
            "Baseline Recalculation: Incorporate access pattern in baseline on next scheduled run."
        ]
    }
    
    checklist_list = rec_actions.get(alert['severity'], rec_actions['LOW'])
    checklist_p = Paragraph("<br/>".join([f"<b>[ ]</b> {c}" for c in checklist_list]), body_style)
    
    chk_table = Table([[checklist_p]], colWidths=[540])
    chk_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(chk_table)
    
    # Signatures
    story.append(Spacer(1, 25))
    sig_data = [
        [Paragraph("<b>Audited By:</b> SentinelGuard Detection Engine", body_style), Paragraph("<b>Security Analyst Sign-off:</b> ____________________", body_style)],
        [Paragraph("<b>Date Resolved:</b> ____________________", body_style), Paragraph("<b>Signature Date:</b> ____________________", body_style)]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(sig_table)
    
    doc.build(story)
