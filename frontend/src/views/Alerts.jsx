import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Calendar,
  AlertOctagon,
  Download
} from 'lucide-react';

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];


function Alerts({ navigateToAlert }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Departments fetched from DB
  const [departments, setDepartments] = useState([]);
  const [deptsLoading, setDeptsLoading] = useState(true);

  // Fetch departments list once on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/departments')
      .then(r => r.ok ? r.json() : [])
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]))
      .finally(() => setDeptsLoading(false));
  }, []);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Accept explicit overrides so callers (clearFilters, useEffect) always pass
  // current values — avoids stale-closure bugs entirely.
  const fetchAlerts = async ({
    dept = selectedDept,
    severity = selectedSeverity,
    start = startDate,
    end = endDate,
    search = searchTerm,
  } = {}) => {
    try {
      setLoading(true);
      let url = 'http://localhost:5000/api/alerts?';

      if (dept)     url += `department=${encodeURIComponent(dept)}&`;
      if (severity) url += `severity=${encodeURIComponent(severity)}&`;
      if (start)    url += `startDate=${start}&`;
      if (end)      url += `endDate=${end}&`;
      if (search)   url += `search=${encodeURIComponent(search)}&`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch whenever any dropdown/date filter changes
  useEffect(() => {
    fetchAlerts({
      dept: selectedDept,
      severity: selectedSeverity,
      start: startDate,
      end: endDate,
      search: searchTerm,
    });
  }, [selectedDept, selectedSeverity, startDate, endDate]);

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchAlerts({
        dept: selectedDept,
        severity: selectedSeverity,
        start: startDate,
        end: endDate,
        search: searchTerm,
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedDept('');
    setSelectedSeverity('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    // Pass blank values directly — no stale state, no setTimeout hack
    fetchAlerts({ dept: '', severity: '', start: '', end: '', search: '' });
  };

  const handleExportCSV = () => {
    if (alerts.length === 0) return;
    
    const headers = ['Alert ID', 'Timestamp', 'User', 'Department', 'Data Asset', 'Risk Score', 'Severity', 'Status\n'];
    const rows = alerts.map(a => 
      `"SG-${a.id}","${a.timestamp}","${a.username}","${a.department}","${a.data_asset}",${a.risk_score},"${a.severity}","${a.status}"`
    );
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') 
      + rows.join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sentinelguard_alerts_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination Math
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAlerts = alerts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(alerts.length / itemsPerPage);

  const getSeverityStyle = (sev) => {
    const s = sev.toUpperCase();
    if (s === 'CRITICAL') return 'bg-cyber-danger/10 text-cyber-danger border border-cyber-danger/30';
    if (s === 'HIGH') return 'bg-cyber-warning/10 text-cyber-warning border border-cyber-warning/30';
    if (s === 'MEDIUM') return 'bg-cyber-info/10 text-cyber-info border border-cyber-info/30';
    return 'bg-cyber-success/10 text-cyber-success border border-cyber-success/30';
  };

  const getStatusStyle = (status) => {
    const s = status.toUpperCase();
    if (s === 'OPEN') return 'text-cyber-danger border border-cyber-danger/25 bg-cyber-danger/5';
    if (s === 'UNDER_INVESTIGATION') return 'text-cyber-warning border border-cyber-warning/25 bg-cyber-warning/5';
    if (s === 'ESCALATED') return 'text-cyber-purple border border-cyber-purple/25 bg-cyber-purple/5';
    return 'text-cyber-success border border-cyber-success/25 bg-cyber-success/5';
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 uppercase tracking-wide">Alert Center</h2>
          <p className="text-sm text-cyber-textMuted">Operational audit alerts generated by the SentinelGuard engine</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={alerts.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyber-border bg-cyber-cardHover hover:bg-cyber-cardHover/75 hover:border-cyber-textMuted text-xs font-mono transition-all text-cyber-textActive disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            EXPORT ALERTS CSV
          </button>
        </div>
      </div>

      {/* Filter and Query Console */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-cyber-success border-b border-cyber-border pb-3">
          <Filter className="h-3.5 w-3.5" />
          <span>FILTERING & THREAT SEARCH</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search User, Dept, Asset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="w-full bg-cyber-bg border border-cyber-border rounded-lg pl-9 pr-4 py-2 text-xs font-mono focus:outline-none focus:border-cyber-success text-cyber-textActive"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-cyber-textMuted" />
          </div>

          {/* Department Dropdown */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyber-success text-cyber-textActive"
            disabled={deptsLoading}
          >
            <option value="">{deptsLoading ? 'Loading...' : `All Departments (${departments.length})`}</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Severity Dropdown */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="w-full bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyber-success text-cyber-textActive"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Start Date */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
              className="w-full bg-cyber-bg border border-cyber-border rounded-lg pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-cyber-success text-cyber-textActive"
            />
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-cyber-textMuted pointer-events-none" />
          </div>

          {/* End Date */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
              className="w-full bg-cyber-bg border border-cyber-border rounded-lg pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-cyber-success text-cyber-textActive"
            />
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-cyber-textMuted pointer-events-none" />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-[11px] font-mono text-cyber-textMuted">
            {alerts.length} threats matching filters. Press <kbd className="bg-cyber-bg px-1 py-0.5 rounded border border-cyber-border text-cyber-success text-[10px]">Enter</kbd> to search text.
          </span>
          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 bg-cyber-cardHover hover:bg-cyber-cardHover/80 border border-cyber-border rounded-lg text-xs font-mono transition-all text-cyber-textMuted"
            >
              Clear Filters
            </button>
            <button
              onClick={() => fetchAlerts({
                dept: selectedDept,
                severity: selectedSeverity,
                start: startDate,
                end: endDate,
                search: searchTerm,
              })}
              className="px-4 py-1.5 bg-cyber-success/15 hover:bg-cyber-success/25 border border-cyber-success/35 text-cyber-success rounded-lg text-xs font-mono font-semibold transition-all"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Database Table */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-cyber-bg/40 border-b border-cyber-border text-cyber-textMuted uppercase text-[10px]">
              <tr>
                <th className="px-6 py-3.5">Alert ID</th>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Data Asset</th>
                <th className="px-6 py-3.5 text-center">Risk Score</th>
                <th className="px-6 py-3.5 text-center">Severity</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-border/30">
              {currentAlerts.map((alert) => (
                <tr 
                  key={alert.id} 
                  className="hover:bg-cyber-cardHover/20 border-b border-cyber-border/30 text-gray-300 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-cyber-info">
                    SG-{alert.id.toString().padStart(4, '0')}
                  </td>
                  <td className="px-6 py-4 font-bold text-cyber-textActive">
                    {alert.username}
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {alert.department}
                  </td>
                  <td className="px-6 py-4 max-w-[200px] truncate" title={alert.data_asset}>
                    {alert.data_asset}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-cyber-warning">
                    {alert.risk_score}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSeverityStyle(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(alert.status)}`}>
                      {alert.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigateToAlert(alert.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-cyber-success/10 hover:bg-cyber-success/20 text-cyber-success border border-cyber-success/20 rounded hover:border-cyber-success text-[10px] ml-auto transition-all"
                    >
                      <Eye className="h-3 w-3" />
                      ANALYZE
                    </button>
                  </td>
                </tr>
              ))}

              {alerts.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-cyber-textMuted font-mono text-xs">
                    <AlertOctagon className="h-8 w-8 text-cyber-textMuted mx-auto mb-3 animate-pulse" />
                    NO THREAT ALERT LOGS FOUND IN CURRENT DATABASE VIEW
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-cyber-success font-mono text-xs animate-pulse">
                    LOADING RECENT LOG AUDITS...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-cyber-bg/20 border-t border-cyber-border flex items-center justify-between text-xs font-mono">
            <span className="text-cyber-textMuted">
              Showing <span className="text-cyber-textActive font-bold">{indexOfFirstItem + 1}</span> to{' '}
              <span className="text-cyber-textActive font-bold">
                {Math.min(indexOfLastItem, alerts.length)}
              </span>{' '}
              of <span className="text-cyber-success font-bold">{alerts.length}</span> threats
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-cyber-card border border-cyber-border rounded hover:bg-cyber-cardHover disabled:opacity-30 disabled:cursor-not-allowed transition-all text-cyber-textActive"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-cyber-textMuted">
                Page <span className="text-cyber-textActive font-bold">{currentPage}</span> of{' '}
                <span className="text-cyber-textActive font-bold">{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-cyber-card border border-cyber-border rounded hover:bg-cyber-cardHover disabled:opacity-30 disabled:cursor-not-allowed transition-all text-cyber-textActive"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
