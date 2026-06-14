import React, { useState, useEffect } from 'react';
import { 
  User, 
  Terminal, 
  AlertCircle, 
  Cpu, 
  CheckSquare, 
  Download, 
  HelpCircle,
  FileCheck,
  ShieldAlert,
  ArrowLeft,
  Clock,
  HardDrive
} from 'lucide-react';

function Investigation({ alertId, onStatusChange }) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAlertDetail = async () => {
    if (!alertId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:5000/api/alerts/${alertId}`);
      if (response.ok) {
        const data = await response.json();
        setAlert(data);
      } else {
        setError("Alert details could not be retrieved from the server.");
      }
    } catch (err) {
      console.error('Error fetching alert details:', err);
      setError("Failed to connect to the backend API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertDetail();
  }, [alertId]);

  const handleStatusAction = async (statusValue) => {
    if (!alertId) return;
    try {
      setActionLoading(true);
      const response = await fetch(`http://localhost:5000/api/alerts/${alertId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: statusValue })
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Security action applied: ${statusValue.replace('_', ' ')}`);
        // Reload details
        fetchAlertDetail();
        if (onStatusChange) onStatusChange();
      } else {
        alert("Failed to execute containment action.");
      }
    } catch (err) {
      console.error("Action error:", err);
      alert("Failed to connect to backend server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!alertId) return;
    window.open(`http://localhost:5000/api/alerts/${alertId}/pdf`, '_blank');
  };

  if (!alertId) {
    return (
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-8 text-center text-cyber-textMuted font-mono h-96 flex flex-col justify-center items-center">
        <ShieldAlert className="h-12 w-12 text-cyber-warning mb-4 animate-bounce" />
        <h3 className="text-base font-bold text-gray-200 uppercase">NO ACTIVE FILE SELECTED</h3>
        <p className="text-xs mt-2 max-w-sm">Please navigate to the Alert Center and click "Analyze" on any suspicious event log to open the investigation console.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-cyber-success font-mono">
        <Cpu className="h-10 w-10 animate-spin mb-4" />
        <span>COMPUTING FORENSIC CORRELATIONS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cyber-card border border-cyber-danger/30 rounded-xl p-8 text-center text-cyber-danger font-mono h-96 flex flex-col justify-center items-center">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h3 className="text-base font-bold uppercase">SECURE FETCH ERROR</h3>
        <p className="text-xs mt-2">{error}</p>
      </div>
    );
  }

  // Format arrays safely
  const rules = alert.rules_violated || [];
  const anomalies = alert.anomalies_detected || [];
  const profile = alert.user_profile || {};
  const baseline = alert.user_baseline || {};

  const getStatusBadgeClass = (s) => {
    const status = s.toUpperCase();
    if (status === 'OPEN') return 'bg-cyber-danger/10 text-cyber-danger border border-cyber-danger/30';
    if (status === 'UNDER_INVESTIGATION') return 'bg-cyber-warning/10 text-cyber-warning border border-cyber-warning/30';
    if (status === 'ESCALATED') return 'bg-cyber-purple/10 text-cyber-purple border border-cyber-purple/30';
    return 'bg-cyber-success/10 text-cyber-success border border-cyber-success/30';
  };

  const getSeverityBadgeClass = (s) => {
    const status = s.toUpperCase();
    if (status === 'CRITICAL') return 'bg-cyber-danger text-white border border-cyber-danger';
    if (status === 'HIGH') return 'bg-cyber-warning text-cyber-card border border-cyber-warning';
    if (status === 'MEDIUM') return 'bg-cyber-info text-white border border-cyber-info';
    return 'bg-cyber-success text-white border border-cyber-success';
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Upper Navigation & Title */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-100 uppercase tracking-wide">Investigation Workspace</h2>
            <p className="text-sm text-cyber-textMuted">Analytic investigation file for incident: <span className="text-cyber-info font-mono">SG-{alert.id.toString().padStart(4, '0')}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 text-xs font-bold font-mono rounded border ${getStatusBadgeClass(alert.status)}`}>
            {alert.status.replace('_', ' ')}
          </span>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyber-success/15 hover:bg-cyber-success/25 border border-cyber-success/30 hover:border-cyber-success text-cyber-success rounded-lg text-xs font-mono font-semibold transition-all duration-200 glow-success"
          >
            <Download className="h-3.5 w-3.5" />
            PDF REPORT
          </button>
        </div>
      </div>

      {/* Main Core Layout: Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: User Identity & baseline parameters */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Profile Card */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <div className="flex items-center gap-2 border-b border-cyber-border pb-3 mb-4">
              <User className="h-4 w-4 text-cyber-info" />
              <h4 className="font-semibold text-xs uppercase font-mono tracking-wide text-gray-200">Monitored Profile Metadata</h4>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-cyber-border/20 pb-1.5">
                <span className="text-cyber-textMuted">Subject Name:</span>
                <span className="text-cyber-textActive font-bold">{alert.username}</span>
              </div>
              <div className="flex justify-between border-b border-cyber-border/20 pb-1.5">
                <span className="text-cyber-textMuted">Subject ID:</span>
                <span className="text-cyber-info font-bold">{alert.user_id}</span>
              </div>
              <div className="flex justify-between border-b border-cyber-border/20 pb-1.5">
                <span className="text-cyber-textMuted">Department:</span>
                <span>{alert.department}</span>
              </div>
              <div className="flex justify-between border-b border-cyber-border/20 pb-1.5">
                <span className="text-cyber-textMuted">Corporate Role:</span>
                <span className="text-gray-300">{profile.role || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyber-textMuted">Account Tenure:</span>
                <span>{profile.tenure_months ? `${profile.tenure_months} months` : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* User Behavioral Baseline Comparison Card */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <div className="flex items-center gap-2 border-b border-cyber-border pb-3 mb-4">
              <Clock className="h-4 w-4 text-cyber-success" />
              <h4 className="font-semibold text-xs uppercase font-mono tracking-wide text-gray-200">Behavioral Baseline Analysis</h4>
            </div>

            {baseline.typical_hours ? (
              <div className="space-y-4 font-mono text-xs">
                {/* 1. Typical Access Hours */}
                <div>
                  <div className="text-[11px] text-cyber-textMuted uppercase mb-1">Typical Login Hours:</div>
                  <div className="bg-cyber-bg/50 border border-cyber-border rounded p-2 text-[10px] text-gray-300 max-h-16 overflow-y-auto break-all leading-relaxed">
                    {baseline.typical_hours.map(h => `${String(h).padStart(2, '0')}:00`).sort().join(', ') || 'Standard Office Hours'}
                  </div>
                </div>

                {/* 2. Typical query row count vs actual */}
                <div>
                  <div className="flex justify-between text-[11px] text-cyber-textMuted uppercase mb-1.5">
                    <span>Queries Records</span>
                    <span>Baseline vs Incident</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Baseline Mean:</span>
                      <span>{Math.round(baseline.avg_rowcount).toLocaleString()} rows</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-cyber-danger font-semibold">
                      <span>Incident Volume:</span>
                      <span>{alert.rowcount.toLocaleString()} rows</span>
                    </div>
                    {/* Visual bar graph */}
                    <div className="w-full bg-cyber-bg h-2.5 rounded-full overflow-hidden border border-cyber-border mt-1 relative">
                      <div className="bg-cyber-success h-full absolute left-0" style={{ width: `${Math.min(100, (baseline.avg_rowcount / Math.max(1, alert.rowcount)) * 100)}%` }}></div>
                      {alert.rowcount > baseline.avg_rowcount && (
                        <div className="bg-cyber-danger h-full absolute right-0" style={{ left: `${Math.min(100, (baseline.avg_rowcount / Math.max(1, alert.rowcount)) * 100)}%`, right: 0 }}></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Top Targets */}
                <div>
                  <div className="text-[11px] text-cyber-textMuted uppercase mb-1">Top Approvals & Assets:</div>
                  <div className="space-y-1 text-[10px]">
                    {baseline.top_assets?.map(a => (
                      <div key={a.asset} className="flex justify-between text-gray-400">
                        <span className="truncate max-w-[130px]" title={a.asset}>{a.asset}</span>
                        <span>{a.count} queries</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Top Destinations */}
                <div>
                  <div className="text-[11px] text-cyber-textMuted uppercase mb-1">Common Destinations:</div>
                  <div className="space-y-1 text-[10px]">
                    {baseline.top_destinations?.map(d => (
                      <div key={d.destination} className="flex justify-between text-gray-400">
                        <span>{d.destination}</span>
                        <span>{d.count} times</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs py-4 text-cyber-textMuted font-mono">
                NO REGISTERED USER HISTORICAL BASELINES
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Suspicious Event Details & Remediation panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Detailed Alert Summary Card */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <div className="flex items-center gap-2 border-b border-cyber-border pb-3 mb-4">
              <Terminal className="h-4 w-4 text-cyber-warning" />
              <h4 className="font-semibold text-xs uppercase font-mono tracking-wide text-gray-200">Incident Event Indicators</h4>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 font-mono text-xs mb-4">
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Risk Score</span>
                <span className="text-lg font-bold text-cyber-warning">{alert.risk_score}/100</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Severity Class</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getSeverityBadgeClass(alert.severity)}`}>
                  {alert.severity}
                </span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Timestamp</span>
                <span className="text-gray-300">{alert.timestamp}</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Target Asset</span>
                <span className="text-cyber-info truncate block" title={alert.data_asset}>{alert.data_asset}</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Sensitivity Level</span>
                <span className="text-gray-300">{alert.data_sensitivity}</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Destination Node</span>
                <span className="text-gray-300 truncate block" title={alert.destination}>{alert.destination}</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Query Operation</span>
                <span className="text-gray-300">{alert.query_type}</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Transferred Size</span>
                <span className="text-cyber-danger font-semibold">{alert.rowcount.toLocaleString()} rows</span>
              </div>
              <div>
                <span className="text-cyber-textMuted block text-[10px]">Access Route</span>
                <span className="text-gray-300">{alert.access_method}</span>
              </div>
            </div>

            {/* Violation Badges */}
            <div className="space-y-3 border-t border-cyber-border/30 pt-4">
              {rules.length > 0 && (
                <div>
                  <span className="text-[10px] text-cyber-textMuted uppercase font-mono block mb-1.5">Rule Violations (Core):</span>
                  <div className="flex flex-wrap gap-2">
                    {rules.map(r => (
                      <span key={r} className="px-2 py-1 bg-cyber-danger/10 border border-cyber-danger/20 text-cyber-danger rounded text-[10px] font-mono">
                        Rule Match: {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {anomalies.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] text-cyber-textMuted uppercase font-mono block mb-1.5">Statistical Anomaly Indicators:</span>
                  <div className="flex flex-wrap gap-2">
                    {anomalies.map(a => (
                      <span key={a} className="px-2 py-1 bg-cyber-warning/10 border border-cyber-warning/20 text-cyber-warning rounded text-[10px] font-mono">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Investigation Narrative Card */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 bg-cyber-success/5 rounded-bl-full flex items-center justify-center pointer-events-none">
              <Cpu className="h-5 w-5 text-cyber-success/20 mr-[-10px] mt-[-10px]" />
            </div>
            
            <div className="flex items-center gap-2 border-b border-cyber-border pb-3 mb-4">
              <Cpu className="h-4 w-4 text-cyber-success" />
              <h4 className="font-semibold text-xs uppercase font-mono tracking-wide text-gray-200">AI Investigation Narrative</h4>
            </div>

            <blockquote className="p-4 bg-cyber-bg/50 border-l-4 border-cyber-success rounded text-sm text-gray-300 italic font-sans leading-relaxed shadow-inner">
              "{alert.ai_narrative || "No dynamic AI investigation summary is available for this log format."}"
            </blockquote>
          </div>

          {/* Incident Response & Recommendation Console */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <div className="flex items-center gap-2 border-b border-cyber-border pb-3 mb-4">
              <CheckSquare className="h-4 w-4 text-cyber-purple" />
              <h4 className="font-semibold text-xs uppercase font-mono tracking-wide text-gray-200">Analyst Workstation Remediation</h4>
            </div>

            <div className="space-y-4">
              {/* Alert Status Info */}
              <div className="bg-cyber-bg/30 border border-cyber-border/40 rounded-lg p-4 font-mono text-xs space-y-2">
                <div className="flex items-center gap-2 text-cyber-textActive font-bold">
                  <FileCheck className="h-4 w-4 text-cyber-success" />
                  <span>SentinelGuard Recommended Resolution:</span>
                </div>
                <p className="text-gray-400 pl-6 leading-relaxed">
                  {alert.severity === 'CRITICAL' && "ACCOUNT SUSPENSION AND ENDPOINT ISOLATION: The extreme score of this threat suggests exfiltration of critical logs. Recommend credential locking and host isolation immediately."}
                  {alert.severity === 'HIGH' && "IMMEDIATE FORENSIC REVIEW: Elevate this alert code to Level-2 security analysts. Inform the department head and investigate recent data access profiles."}
                  {alert.severity === 'MEDIUM' && "SUPERVISOR AUDIT REVIEW: Standard behavior deviation detected. Place the account on observation rules and consult supervisor for verification."}
                  {alert.severity === 'LOW' && "OBSERVATION ONLY: Low baseline variance. Monitor and recalculate baseline parameters during next schedule."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <span className="text-[10px] text-cyber-textMuted uppercase font-mono block mb-2.5">Apply Response Vector:</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusAction('CLOSED_RESOLVED')}
                    className="px-3 py-2 bg-cyber-success/10 border border-cyber-success/20 hover:border-cyber-success text-cyber-success rounded font-mono text-xs font-bold transition-all hover:bg-cyber-success/15 disabled:opacity-50"
                  >
                    RESOLVE ALERT
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusAction('UNDER_INVESTIGATION')}
                    className="px-3 py-2 bg-cyber-warning/10 border border-cyber-warning/20 hover:border-cyber-warning text-cyber-warning rounded font-mono text-xs font-bold transition-all hover:bg-cyber-warning/15 disabled:opacity-50"
                  >
                    MONITOR ACCOUNT
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusAction('ESCALATED')}
                    className="px-3 py-2 bg-cyber-purple/10 border border-cyber-purple/20 hover:border-cyber-purple text-cyber-purple rounded font-mono text-xs font-bold transition-all hover:bg-cyber-purple/15 disabled:opacity-50"
                  >
                    ESCALATE FILE
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusAction('CLOSED_FALSE_POSITIVE')}
                    className="px-3 py-2 bg-cyber-bg border border-cyber-border hover:border-cyber-textMuted text-cyber-textMuted rounded font-mono text-xs font-bold transition-all hover:bg-cyber-cardHover disabled:opacity-50"
                  >
                    FALSE POSITIVE
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Investigation;
