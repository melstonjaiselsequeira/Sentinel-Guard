import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  AlertTriangle, 
  FileText, 
  Network, 
  CheckCircle2, 
  Database,
  Radio,
  Settings
} from 'lucide-react';

import Dashboard from './views/Dashboard';
import Alerts from './views/Alerts';
import Investigation from './views/Investigation';
import Architecture from './views/Architecture';
import DatasetManagementModal from './components/DatasetManagementModal';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
  const [statusText, setStatusText] = useState('System Online');
  const [statusColor, setStatusColor] = useState('text-cyber-success');
  const [dashboardStats, setDashboardStats] = useState({
    total_events: 0,
    total_users: 0,
    anomalies_detected: 0,
    critical_alerts: 0,
    high_risk_users: 0
  });

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/dashboard/summary');
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const navigateToAlert = (alertId) => {
    setSelectedAlertId(alertId);
    setActivePage('investigation');
  };

  return (
    <div className="flex h-screen bg-cyber-bg text-gray-100 font-sans overflow-hidden bg-grid-cyber">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gradient-to-b from-cyber-card to-[#0d1424] border-r border-cyber-border flex flex-col justify-between z-10 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        <div>
          {/* Logo Header */}
          <div className="h-16 flex items-center px-6 border-b border-cyber-border gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-success/5 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-cyber-success/50 via-cyber-info/30 to-transparent" />
            <Shield className="h-7 w-7 text-cyber-success drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] relative z-10" />
            <div className="relative z-10">
              <h1 className="font-bold text-base leading-tight tracking-widest bg-gradient-to-r from-cyber-success via-emerald-300 to-cyber-info bg-clip-text text-transparent">
                SENTINELGUARD
              </h1>
              <span className="text-[9px] text-cyber-textMuted font-mono tracking-wider">SOC THREAT PLATFORM v2</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-1">
            <button
              onClick={() => setActivePage('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activePage === 'dashboard'
                  ? 'bg-cyber-success/10 text-cyber-success border border-cyber-success/20 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                  : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover/40 border border-transparent'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              Executive Dashboard
            </button>

            <button
              onClick={() => setActivePage('alerts')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                activePage === 'alerts'
                  ? 'bg-cyber-success/10 text-cyber-success border border-cyber-success/20 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                  : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover/40 border border-transparent'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Alert Center
              {dashboardStats.critical_alerts > 0 && (
                <span className="absolute right-3 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-cyber-danger text-white rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                  {dashboardStats.critical_alerts}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (selectedAlertId) {
                  setActivePage('investigation');
                } else {
                  alert("Please select an alert from the Alert Center first to inspect.");
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activePage === 'investigation'
                  ? 'bg-cyber-success/10 text-cyber-success border border-cyber-success/20 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                  : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover/40 border border-transparent'
              } ${!selectedAlertId ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              Investigation Workspace
            </button>

            <button
              onClick={() => setActivePage('architecture')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activePage === 'architecture'
                  ? 'bg-cyber-success/10 text-cyber-success border border-cyber-success/20 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                  : 'text-cyber-textMuted hover:text-cyber-textActive hover:bg-cyber-cardHover/40 border border-transparent'
              }`}
            >
              <Network className="h-4 w-4 shrink-0" />
              Scalability Architecture
            </button>
          </nav>
        </div>

        {/* Node Info */}
        <div className="p-4 border-t border-cyber-border/50 bg-black/20 font-mono text-[11px] text-cyber-textMuted space-y-1.5">
          <div className="text-[9px] uppercase tracking-widest text-cyber-textMuted/60 mb-2">System Node</div>
          <div className="flex justify-between">
            <span>NODE ID:</span>
            <span className="text-cyber-info font-semibold">SG-NODE-01</span>
          </div>
          <div className="flex justify-between">
            <span>LOCATION:</span>
            <span>US-EAST-02</span>
          </div>
          <div className="flex justify-between">
            <span>LOG DB:</span>
            <span className="text-gray-400">SQLite (Dev)</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-cyber-border/30 mt-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-success animate-pulse" />
            <span className="text-cyber-success text-[10px]">All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-cyber-card/80 backdrop-blur border-b border-cyber-border flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="h-4 w-4 text-cyber-success" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-cyber-success animate-ping" />
            </div>
            <span className="text-xs font-mono tracking-wider font-semibold text-cyber-textMuted uppercase">
              STATUS: <span className={statusColor}>{statusText}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Summary Counts */}
            <div className="flex gap-4 text-xs font-mono bg-cyber-bg/50 border border-cyber-border rounded-lg px-4 py-1.5">
              <div>
                <span className="text-cyber-textMuted">EVENTS:</span>{' '}
                <span className="text-cyber-textActive font-bold">{dashboardStats.total_events}</span>
              </div>
              <div className="border-l border-cyber-border pl-3">
                <span className="text-cyber-textMuted">ALERTS:</span>{' '}
                <span className="text-cyber-warning font-bold">{dashboardStats.anomalies_detected}</span>
              </div>
              <div className="border-l border-cyber-border pl-3">
                <span className="text-cyber-textMuted">USERS:</span>{' '}
                <span className="text-cyber-info font-bold">{dashboardStats.total_users}</span>
              </div>
            </div>

            {/* Dataset Management Button */}
            <button
              onClick={() => setIsDatasetModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-cyber-success/30 hover:border-cyber-success bg-cyber-success/10 hover:bg-cyber-success/20 text-cyber-success text-xs font-mono font-bold uppercase rounded-lg transition-all"
            >
              <Database className="h-3.5 w-3.5" />
              Dataset Management
            </button>
          </div>
        </header>

        {/* View Router */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {activePage === 'dashboard' && (
            <Dashboard 
              navigateToAlert={navigateToAlert} 
              onStatsRefresh={fetchStats}
            />
          )}
          {activePage === 'alerts' && (
            <Alerts 
              navigateToAlert={navigateToAlert} 
            />
          )}
          {activePage === 'investigation' && (
            <Investigation 
              alertId={selectedAlertId} 
              onStatusChange={() => {
                fetchStats();
              }}
            />
          )}
          {activePage === 'architecture' && (
            <Architecture />
          )}
        </div>
      </main>

      {/* Dataset Management Modal Dialog */}
      <DatasetManagementModal 
        isOpen={isDatasetModalOpen}
        onClose={() => setIsDatasetModalOpen(false)}
        onRefreshStats={fetchStats}
      />
    </div>
  );
}

export default App;
