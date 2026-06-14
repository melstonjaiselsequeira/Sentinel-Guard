import React, { useState, useRef } from 'react';
import { 
  X, 
  Database, 
  Upload, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Eye, 
  ArrowRight,
  Zap
} from 'lucide-react';

const REQUIRED_LOG_COLS = [
  'timestamp', 'user_id', 'username', 'department', 'data_asset', 
  'data_sensitivity', 'query_type', 'rowcount', 'access_method', 'destination'
];

const REQUIRED_PROFILE_COLS = [
  'user_id', 'username', 'department', 'role', 'tenure_months', 
  'approved_data_assets', 'typical_access_hours', 'avg_queries_per_day', 'avg_rowcount_per_query'
];

function DatasetManagementModal({ isOpen, onClose, onRefreshStats }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('upload'); // 'sample', 'upload', 'refresh'
  const [logFile, setLogFile] = useState(null);
  const [profileFile, setProfileFile] = useState(null);
  const [logHeaders, setLogHeaders] = useState([]);
  const [logPreview, setLogPreview] = useState([]);
  const [profileHeaders, setProfileHeaders] = useState([]);
  const [profilePreview, setProfilePreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [importingDataset, setImportingDataset] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [importResult, setImportResult] = useState(null);
  const [refreshResult, setRefreshResult] = useState(null);

  const logInputRef = useRef(null);
  const profileInputRef = useRef(null);

  const handleFileChange = (e, isLogs) => {
    const file = e.target.files[0];
    if (!file) return;

    if (isLogs) {
      setLogFile(file);
    } else {
      setProfileFile(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const previewRows = [];
        for (let i = 1; i < Math.min(lines.length, 5); i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] || '';
          });
          previewRows.push(rowObj);
        }
        if (isLogs) {
          setLogHeaders(headers);
          setLogPreview(previewRows);
        } else {
          setProfileHeaders(headers);
          setProfilePreview(previewRows);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleIngest = async (isLogs) => {
    const file = isLogs ? logFile : profileFile;
    if (!file) return;

    // Fast-pass auto schema support (backend handles mapping of sample alternate logs schema)
    if (!isLogs) {
      const headersToCheck = isLogs ? logHeaders : profileHeaders;
      const required = isLogs ? REQUIRED_LOG_COLS : REQUIRED_PROFILE_COLS;
      const missing = required.filter(col => !headersToCheck.includes(col));
      if (missing.length > 0) {
        setStatus({
          type: 'error',
          message: `Validation Failed. Missing required columns: ${missing.join(', ')}`
        });
        return;
      }
    }

    setUploading(true);
    setStatus({ type: 'info', message: `Uploading and analyzing ${isLogs ? 'access logs' : 'user profiles'}...` });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = isLogs ? 'http://localhost:5000/api/ingest/logs' : 'http://localhost:5000/api/ingest/profiles';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setStatus({ type: 'success', message: data.message });
        if (isLogs) {
          setLogFile(null);
          setLogPreview([]);
        } else {
          setProfileFile(null);
          setProfilePreview([]);
        }
        if (onRefreshStats) onRefreshStats();
      } else {
        setStatus({ type: 'error', message: data.error || 'Ingestion failed' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to connect to backend server' });
    } finally {
      setUploading(false);
    }
  };

  const handleImportDataset = async () => {
    setImportingDataset(true);
    setImportResult(null);
    setStatus({ type: 'info', message: 'Importing sample dataset... This may take a few seconds.' });
    try {
      const response = await fetch('http://localhost:5000/api/import-dataset', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        setImportResult(data);
        setStatus({ type: 'success', message: data.message });
        if (onRefreshStats) onRefreshStats();
      } else {
        setStatus({ type: 'error', message: data.error || 'Import failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Could not reach backend. Make sure Flask is running.' });
    } finally {
      setImportingDataset(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    setStatus({ type: 'info', message: 'Recalculating baseline statistics and retraining Isolation Forest... This might take up to 10 seconds.' });
    try {
      const response = await fetch('http://localhost:5000/api/refresh-analysis', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        setRefreshResult(data);
        setStatus({ type: 'success', message: data.message });
        if (onRefreshStats) onRefreshStats();
      } else {
        setStatus({ type: 'error', message: data.error || 'Analysis refresh failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Could not reach backend. Make sure Flask is running.' });
    } finally {
      setRefreshing(false);
    }
  };

  const downloadTemplate = (isLogs) => {
    let headers = REQUIRED_LOG_COLS;
    let sampleRow = ['2025-04-21 08:30:00', 'USR1022', 'john.doe', 'Engineering', 'production_postgres_db', 'HIGH', 'SELECT', '250', 'WEB_CONSOLE', 'INTERNAL'];
    if (!isLogs) {
      headers = REQUIRED_PROFILE_COLS;
      sampleRow = ['USR1022', 'john.doe', 'Engineering', 'Software Engineer', '24', '[production_postgres_db,github_repository]', '[8,9,10,11,12,13,14,15,16,17]', '25', '400'];
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n' 
      + sampleRow.map(val => `"${val}"`).join(',');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", isLogs ? "sentinel_logs_template.csv" : "sentinel_profiles_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-bg/85 backdrop-blur-md transition-all duration-300 p-4">
      {/* Modal Container */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyber-success via-cyber-info to-cyber-purple" />
        
        {/* Header */}
        <div className="p-6 border-b border-cyber-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-cyber-success filter drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            <div>
              <h3 className="font-bold text-lg text-gray-100 uppercase tracking-wider">Dataset Management Console</h3>
              <p className="text-xs text-cyber-textMuted font-mono">NODE-01 / RE-SEED / INGESTION / DYNAMIC TRAINING</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-cyber-bg border border-cyber-border hover:border-cyber-danger hover:text-cyber-danger flex items-center justify-center transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="bg-cyber-bg/50 border-b border-cyber-border px-6 py-2 flex gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
              activeTab === 'upload'
                ? 'bg-cyber-success/15 text-cyber-success border border-cyber-success/30'
                : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover'
            }`}
          >
            <Upload className="h-3.5 w-3.5 inline mr-1.5" />
            Upload Custom CSVs
          </button>
          <button
            onClick={() => setActiveTab('sample')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
              activeTab === 'sample'
                ? 'bg-cyber-info/15 text-cyber-info border border-cyber-info/30'
                : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover'
            }`}
          >
            <Zap className="h-3.5 w-3.5 inline mr-1.5" />
            Load Sample Dataset
          </button>
          <button
            onClick={() => setActiveTab('refresh')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
              activeTab === 'refresh'
                ? 'bg-cyber-purple/15 text-cyber-purple border border-cyber-purple/30'
                : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5 inline mr-1.5" />
            Refresh Analysis
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Status Message Banner */}
          {status.message && (
            <div className={`p-4 border rounded-xl flex items-center gap-3 font-mono text-xs ${
              status.type === 'success' ? 'bg-cyber-success/10 border-cyber-success/30 text-cyber-success glow-success' :
              status.type === 'error' ? 'bg-cyber-danger/10 border-cyber-danger/30 text-cyber-danger glow-danger' :
              'bg-cyber-info/10 border-cyber-info/30 text-cyber-info animate-pulse'
            }`}>
              {status.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" />}
              {status.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0" />}
              {status.type === 'info' && <Database className="h-5 w-5 shrink-0 animate-spin" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* TAB 1: UPLOAD CUSTOM DATASET */}
          {activeTab === 'upload' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Access Logs Upload */}
              <div className="bg-cyber-bg/40 border border-cyber-border rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-cyber-border pb-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-cyber-success" />
                      <h4 className="font-semibold text-sm uppercase font-mono tracking-wide text-gray-200">Access Audit Logs</h4>
                    </div>
                    <button 
                      onClick={() => downloadTemplate(true)}
                      className="text-[10px] font-mono text-cyber-success hover:underline flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Template
                    </button>
                  </div>
                  <p className="text-xs text-cyber-textMuted leading-relaxed">
                    Upload access logs containing action, resource sensitivity, source IP, timestamps, user ID, and destination node to evaluate insider threat signatures.
                  </p>
                  <div 
                    onClick={() => logInputRef.current.click()}
                    className="border-2 border-dashed border-cyber-border hover:border-cyber-success rounded-xl p-6 text-center cursor-pointer transition-all duration-200 bg-cyber-bg/30 hover:bg-cyber-success/5"
                  >
                    <input 
                      type="file" 
                      ref={logInputRef} 
                      className="hidden" 
                      accept=".csv"
                      onChange={(e) => handleFileChange(e, true)}
                    />
                    <Upload className="h-6 w-6 text-cyber-textMuted mx-auto mb-2" />
                    {logFile ? (
                      <span className="font-mono text-xs text-cyber-success font-semibold block truncate">{logFile.name}</span>
                    ) : (
                      <span className="font-mono text-[11px] text-cyber-textMuted block">Drag & Drop or <span className="text-cyber-success underline">Browse Logs CSV</span></span>
                    )}
                  </div>
                  {logPreview.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-cyber-info uppercase">
                        <Eye className="h-2.5 w-2.5" />
                        <span>Parsed Log Headers Preview</span>
                      </div>
                      <div className="overflow-x-auto border border-cyber-border rounded max-h-24">
                        <table className="w-full text-left font-mono text-[8px] bg-cyber-bg/25">
                          <thead>
                            <tr className="bg-cyber-bg border-b border-cyber-border text-cyber-textMuted uppercase">
                              {logHeaders.slice(0, 4).map(h => (
                                <th key={h} className="px-1.5 py-1">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cyber-border/40 text-gray-300">
                            {logPreview.map((row, idx) => (
                              <tr key={idx}>
                                {logHeaders.slice(0, 4).map(h => (
                                  <td key={h} className="px-1.5 py-1 truncate max-w-[80px]">{row[h]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleIngest(true)}
                  disabled={!logFile || uploading}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-cyber-success text-cyber-card rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-success/90 glow-success"
                >
                  INGEST & AUDIT LOGS
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* User Profiles Upload */}
              <div className="bg-cyber-bg/40 border border-cyber-border rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-cyber-border pb-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-cyber-purple" />
                      <h4 className="font-semibold text-sm uppercase font-mono tracking-wide text-gray-200">Employee Directories</h4>
                    </div>
                    <button 
                      onClick={() => downloadTemplate(false)}
                      className="text-[10px] font-mono text-cyber-purple hover:underline flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Template
                    </button>
                  </div>
                  <p className="text-xs text-cyber-textMuted leading-relaxed">
                    Upload employee registers detailing department, roles, typical login hours, and average daily volumes. Used to construct behavioral baselines.
                  </p>
                  <div 
                    onClick={() => profileInputRef.current.click()}
                    className="border-2 border-dashed border-cyber-border hover:border-cyber-purple rounded-xl p-6 text-center cursor-pointer transition-all duration-200 bg-cyber-bg/30 hover:bg-cyber-purple/5"
                  >
                    <input 
                      type="file" 
                      ref={profileInputRef} 
                      className="hidden" 
                      accept=".csv"
                      onChange={(e) => handleFileChange(e, false)}
                    />
                    <Upload className="h-6 w-6 text-cyber-textMuted mx-auto mb-2" />
                    {profileFile ? (
                      <span className="font-mono text-xs text-cyber-purple font-semibold block truncate">{profileFile.name}</span>
                    ) : (
                      <span className="font-mono text-[11px] text-cyber-textMuted block">Drag & Drop or <span className="text-cyber-purple underline">Browse Profiles CSV</span></span>
                    )}
                  </div>
                  {profilePreview.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-cyber-info uppercase">
                        <Eye className="h-2.5 w-2.5" />
                        <span>Parsed Profile Headers Preview</span>
                      </div>
                      <div className="overflow-x-auto border border-cyber-border rounded max-h-24">
                        <table className="w-full text-left font-mono text-[8px] bg-cyber-bg/25">
                          <thead>
                            <tr className="bg-cyber-bg border-b border-cyber-border text-cyber-textMuted uppercase">
                              {profileHeaders.slice(0, 4).map(h => (
                                <th key={h} className="px-1.5 py-1">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cyber-border/40 text-gray-300">
                            {profilePreview.map((row, idx) => (
                              <tr key={idx}>
                                {profileHeaders.slice(0, 4).map(h => (
                                  <td key={h} className="px-1.5 py-1 truncate max-w-[80px]">{row[h]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleIngest(false)}
                  disabled={!profileFile || uploading}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-cyber-purple text-cyber-card rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-purple/90 glow-purple"
                >
                  REGISTER PROFILES
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: LOAD SAMPLE DATASET */}
          {activeTab === 'sample' && (
            <div className="bg-cyber-bg/40 border border-cyber-border rounded-xl p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-cyber-info/10 border border-cyber-info/20 flex items-center justify-center shrink-0">
                  <Database className="h-6 w-6 text-cyber-info" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-100 uppercase tracking-wide">
                    Load Bundled Production Sample Dataset
                  </h4>
                  <p className="text-xs text-cyber-textMuted mt-1 max-w-2xl leading-relaxed">
                    Instantly loads and maps <span className="text-cyber-info font-bold">data_access_logs.csv</span> (1,200 events) and <span className="text-cyber-info font-bold">user_profiles.csv</span> (100 corporate employees) from the local repository directory. This triggers the full pipeline: automatic header alignment mapping, custom user tenure calculations, baseline compilation, and Isolation Forest training.
                  </p>
                </div>
              </div>

              {importResult && (
                <div className="grid grid-cols-3 gap-4 bg-cyber-bg/80 border border-cyber-border p-4 rounded-lg text-center font-mono">
                  <div>
                    <span className="block text-[10px] text-cyber-textMuted uppercase">Total Logs Ingested</span>
                    <span className="text-base font-bold text-cyber-success">{importResult.total_events?.toLocaleString()}</span>
                  </div>
                  <div className="border-x border-cyber-border">
                    <span className="block text-[10px] text-cyber-textMuted uppercase">Active Employees</span>
                    <span className="text-base font-bold text-cyber-info">{importResult.total_users}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-cyber-textMuted uppercase">High-Risk Alerts Detected</span>
                    <span className="text-base font-bold text-cyber-danger">{importResult.high_risk_alerts}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-cyber-border/40">
                <button
                  onClick={handleImportDataset}
                  disabled={importingDataset}
                  className="flex items-center gap-2 px-6 py-3 bg-cyber-info text-cyber-card rounded-lg text-xs font-mono font-bold uppercase transition-all hover:bg-cyber-info/90 disabled:opacity-50"
                >
                  {importingDataset ? (
                    <><Zap className="h-4 w-4 animate-spin" /> IMPORTING DATASET...</>
                  ) : (
                    <><Zap className="h-4 w-4" /> SEED DATABASE FROM LOCAL FILES</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: REFRESH ANALYSIS */}
          {activeTab === 'refresh' && (
            <div className="bg-cyber-bg/40 border border-cyber-border rounded-xl p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-6 w-6 text-cyber-purple" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-100 uppercase tracking-wide">
                    Retrain Models & Re-evaluate Baselines
                  </h4>
                  <p className="text-xs text-cyber-textMuted mt-1 max-w-2xl leading-relaxed">
                    Triggers a total platform audit recalculation on the active database logs. Recomputes statistical baselines for each employee, trains a new Isolation Forest outlier classifier model, re-calculates all individual multi-dimensional risk scores, and refreshes the SOC alerts in real-time.
                  </p>
                </div>
              </div>

              {refreshResult && (
                <div className="grid grid-cols-2 gap-4 bg-cyber-bg/80 border border-cyber-border p-4 rounded-lg text-center font-mono">
                  <div>
                    <span className="block text-[10px] text-cyber-textMuted uppercase">Processed Logs</span>
                    <span className="text-base font-bold text-cyber-success">{refreshResult.total_events?.toLocaleString()}</span>
                  </div>
                  <div className="border-l border-cyber-border">
                    <span className="block text-[10px] text-cyber-textMuted uppercase">Updated Alerts</span>
                    <span className="text-base font-bold text-cyber-warning">{refreshResult.high_risk_alerts}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-cyber-border/40">
                <button
                  onClick={handleRefreshAnalysis}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-6 py-3 bg-cyber-purple text-cyber-card rounded-lg text-xs font-mono font-bold uppercase transition-all hover:bg-cyber-purple/95 disabled:opacity-50"
                >
                  {refreshing ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> RECALCULATING...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" /> RETRAIN & RE-SCORE LOGS</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-cyber-bg/80 border-t border-cyber-border flex justify-between items-center font-mono text-[10px] text-cyber-textMuted">
          <span>PIPELINE ENGINE: ACTIVE</span>
          <span>SYSTEM TIME: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

export default DatasetManagementModal;
