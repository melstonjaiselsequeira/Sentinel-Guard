import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  AlertOctagon, 
  Skull, 
  Lock, 
  Download, 
  ArrowRight,
  TrendingUp,
  Map,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e'
};

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

function Dashboard({ navigateToAlert, onStatsRefresh }) {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Summary
      const sumRes = await fetch('http://localhost:5000/api/dashboard/summary');
      const sumData = await sumRes.json();
      setSummary(sumData);

      // Fetch Charts
      const chartRes = await fetch('http://localhost:5000/api/dashboard/charts');
      const chartData = await chartRes.json();
      setCharts(chartData);

      // Fetch Recent Alerts
      const alertsRes = await fetch('http://localhost:5000/api/alerts?limit=5');
      const alertsData = await alertsRes.json();
      setRecentAlerts(alertsData.slice(0, 5)); // show top 5

      if (onStatsRefresh) onStatsRefresh();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleExportCSV = () => {
    if (!charts || !charts.risk_trend) return;
    
    // Construct CSV content for risk trends
    const headers = ['Date', 'Total Events', 'High Risk Alerts', 'Avg Risk Score\n'];
    const rows = charts.risk_trend.map(item => 
      `"${item.date}",${item.total_events},${item.high_risk_alerts},${item.avg_risk}`
    );
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') 
      + rows.join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sentinelguard_trend_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-cyber-success font-mono">
        <Activity className="h-10 w-10 animate-spin mb-4" />
        <span>PARSING THREAT DATABASES...</span>
      </div>
    );
  }

  // Format charts distribution
  const severityDistData = charts?.severity_dist || [];

  return (
    <div className="space-y-8 fade-in">
      {/* Title & Actions Row */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 uppercase tracking-wide">Executive Security Posture</h2>
          <p className="text-sm text-cyber-textMuted">Data Access Audits & Statistical Insider Threat Analysis</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-cyber-success/15 hover:bg-cyber-success/25 border border-cyber-success/30 hover:border-cyber-success text-cyber-success rounded-lg text-sm font-semibold transition-all duration-200 glow-success"
        >
          <Download className="h-4 w-4" />
          EXPORT TREND REPORT
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* KPI 1: Total Events */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-cyber-info/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.12)] group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-info/8 rounded-bl-3xl" />
          <Activity className="absolute top-3 right-3 h-5 w-5 text-cyber-info/30" />
          <span className="text-[10px] font-mono text-cyber-textMuted uppercase tracking-widest block mb-2">Total Events</span>
          <h3 className="text-3xl font-bold text-cyber-textActive font-mono tabular-nums">{summary?.total_events?.toLocaleString()}</h3>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-info animate-pulse" />
            <p className="text-[10px] text-cyber-info/70 font-mono">Real-time capture</p>
          </div>
        </div>

        {/* KPI 2: Total Users */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-cyber-purple/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.12)] group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-purple/8 rounded-bl-3xl" />
          <Users className="absolute top-3 right-3 h-5 w-5 text-cyber-purple/30" />
          <span className="text-[10px] font-mono text-cyber-textMuted uppercase tracking-widest block mb-2">Monitored Users</span>
          <h3 className="text-3xl font-bold text-cyber-textActive font-mono tabular-nums">{summary?.total_users}</h3>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-purple animate-pulse" />
            <p className="text-[10px] text-cyber-purple/70 font-mono">Dynamic baselines</p>
          </div>
        </div>

        {/* KPI 3: Anomalies */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-cyber-warning/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)] group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-warning/8 rounded-bl-3xl" />
          <AlertOctagon className="absolute top-3 right-3 h-5 w-5 text-cyber-warning/30" />
          <span className="text-[10px] font-mono text-cyber-textMuted uppercase tracking-widest block mb-2">Anomalies</span>
          <h3 className="text-3xl font-bold text-cyber-warning font-mono tabular-nums">{summary?.anomalies_detected}</h3>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-warning animate-pulse" />
            <p className="text-[10px] text-cyber-warning/70 font-mono">Score &gt; 25</p>
          </div>
        </div>

        {/* KPI 4: Critical Alerts */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-cyber-danger/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-danger/8 rounded-bl-3xl" />
          <Skull className="absolute top-3 right-3 h-5 w-5 text-cyber-danger/30" />
          <span className="text-[10px] font-mono text-cyber-textMuted uppercase tracking-widest block mb-2">Critical Alerts</span>
          <h3 className="text-3xl font-bold text-cyber-danger font-mono tabular-nums">{summary?.critical_alerts}</h3>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-danger animate-pulse" />
            <p className="text-[10px] text-cyber-danger/70 font-mono">Containment needed</p>
          </div>
        </div>

        {/* KPI 5: High Risk Users */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-cyber-purple/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.12)] group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-purple/8 rounded-bl-3xl" />
          <Lock className="absolute top-3 right-3 h-5 w-5 text-cyber-purple/30" />
          <span className="text-[10px] font-mono text-cyber-textMuted uppercase tracking-widest block mb-2">High-Risk Accounts</span>
          <h3 className="text-3xl font-bold text-cyber-purple font-mono tabular-nums">{summary?.high_risk_users}</h3>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-purple animate-pulse" />
            <p className="text-[10px] text-cyber-purple/70 font-mono">Under investigation</p>
          </div>
        </div>
      </div>

      {/* Main Charts Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend Over Time */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-cyber-success" />
            <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Access Risk & Volume Trends</h4>
          </div>
          <div className="h-72">
            {charts?.risk_trend && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.risk_trend}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151' }}
                    labelStyle={{ color: '#9ca3af', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Line name="Avg Risk Score" type="monotone" dataKey="avg_risk" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  <Line name="High Risk Alerts" type="monotone" dataKey="high_risk_alerts" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 1 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-cyber-warning" />
            <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Severity Breakdown</h4>
          </div>
          <div className="h-72 flex flex-col justify-center items-center relative">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={severityDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {severityDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name.toUpperCase()] || '#8b5cf6'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                  itemStyle={{ fontFamily: 'monospace' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend */}
            <div className="grid grid-cols-4 gap-4 text-xs font-mono mt-2">
              {severityDistData.map((entry, index) => (
                <div key={entry.name} className="flex flex-col items-center">
                  <span className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: COLORS[entry.name.toUpperCase()] }}></span>
                  <span className="text-gray-400 text-[10px] uppercase">{entry.name}</span>
                  <span className="text-gray-200 font-bold">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts by Department — dynamic height so ALL department names are visible */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-cyber-purple" />
            <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Alerts by Department</h4>
            {charts?.department_alerts && (
              <span className="ml-auto text-[10px] font-mono text-cyber-textMuted">
                {charts.department_alerts.length} depts
              </span>
            )}
          </div>
          {charts?.department_alerts && (() => {
            const deptCount = charts.department_alerts.length;
            // 48px per bar row + 60px for X-axis + legend
            const chartPx = deptCount * 48 + 60;
            return (
              <div style={{ height: chartPx }} className="overflow-y-auto">
                <ResponsiveContainer width="100%" height={chartPx}>
                  <BarChart
                    data={charts.department_alerts}
                    layout="vertical"
                    barSize={22}
                    barCategoryGap="30%"
                    margin={{ top: 4, right: 20, left: 0, bottom: 28 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#4b5563"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis
                      dataKey="department"
                      type="category"
                      stroke="#4b5563"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                      tick={{ fill: '#d1d5db' }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '6px', position: 'absolute', bottom: 0 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="critical" name="Critical" stackId="a" fill={COLORS.CRITICAL} />
                    <Bar dataKey="high"     name="High"     stackId="a" fill={COLORS.HIGH} />
                    <Bar dataKey="medium"   name="Medium"   stackId="a" fill={COLORS.MEDIUM} />
                    <Bar dataKey="low"      name="Low"      stackId="a" fill={COLORS.LOW} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
          {!charts?.department_alerts && (
            <div className="h-40 flex items-center justify-center text-xs font-mono text-cyber-textMuted">
              Loading department data...
            </div>
          )}
        </div>

        {/* Top Sensitive Assets Audited — custom CSS bars, no fixed height */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-cyber-info" />
            <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Top Sensitive Assets Audited</h4>
          </div>
          {charts?.top_assets && charts.top_assets.length > 0 ? (
            <div className="flex-1 space-y-3">
              {(() => {
                const maxCount = Math.max(...charts.top_assets.map(a => a.count));
                return charts.top_assets.map((asset, idx) => {
                  const pct = Math.round((asset.count / maxCount) * 100);
                  const colors = [
                    { bar: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
                    { bar: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', text: '#a78bfa' },
                    { bar: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#34d399' },
                    { bar: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
                    { bar: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#f87171' },
                  ];
                  const c = colors[idx % colors.length];
                  return (
                    <div key={asset.name}
                      className="rounded-lg p-3 border transition-all duration-200 hover:scale-[1.01]"
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-mono font-semibold text-gray-200 truncate max-w-[70%]" title={asset.name}>
                          {asset.name}
                        </span>
                        <span className="text-xs font-bold font-mono" style={{ color: c.text }}>
                          {asset.count.toLocaleString()}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: c.bar }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-cyber-textMuted">
              No asset data available
            </div>
          )}
        </div>
      </div>

      {/* Grid: Heatmap & Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap & Leaderboard Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Department Risk Matrix */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Map className="h-4 w-4 text-cyber-success" />
              <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Department Risk Heatmap (Avg Score)</h4>
            </div>
            <div className="grid grid-cols-4 gap-3 font-mono text-center">
              {/* Table header */}
              <div className="text-[10px] text-cyber-textMuted uppercase py-1 border-b border-cyber-border text-left">Department</div>
              <div className="text-[10px] text-cyber-textMuted uppercase py-1 border-b border-cyber-border">Night (0-5h)</div>
              <div className="text-[10px] text-cyber-textMuted uppercase py-1 border-b border-cyber-border">Daytime (6-17h)</div>
              <div className="text-[10px] text-cyber-textMuted uppercase py-1 border-b border-cyber-border">Evening (18-23h)</div>
              
              {/* Dynamic rows */}
              {charts?.heatmap_data && (() => {
                // Parse pivot data
                const depts = Array.from(new Set(charts.heatmap_data.map(h => h.department)));
                
                const getScore = (dept, bucketRegex) => {
                  const item = charts.heatmap_data.find(h => h.department === dept && h.hour_bucket.toLowerCase().includes(bucketRegex));
                  return item ? Math.round(item.risk_score) : 0;
                };

                const getColorClass = (score) => {
                  if (score === 0) return 'bg-cyber-bg border border-cyber-border text-gray-500';
                  if (score >= 70) return 'bg-cyber-danger/35 text-red-100 border border-cyber-danger/50';
                  if (score >= 50) return 'bg-cyber-warning/35 text-amber-100 border border-cyber-warning/50';
                  if (score >= 25) return 'bg-cyber-info/20 text-blue-100 border border-cyber-border';
                  return 'bg-cyber-success/20 text-emerald-100 border border-cyber-success/30';
                };

                return depts.map(dept => (
                  <React.Fragment key={dept}>
                    <div className="text-left text-xs font-semibold py-2 self-center text-gray-300">{dept}</div>
                    <div className={`text-xs py-2 px-1 rounded font-bold ${getColorClass(getScore(dept, 'night'))}`}>
                      {getScore(dept, 'night') || '0.0'}
                    </div>
                    <div className={`text-xs py-2 px-1 rounded font-bold ${getColorClass(Math.max(getScore(dept, 'morning'), getScore(dept, 'afternoon')))}`}>
                      {Math.max(getScore(dept, 'morning'), getScore(dept, 'afternoon')) || '0.0'}
                    </div>
                    <div className={`text-xs py-2 px-1 rounded font-bold ${getColorClass(getScore(dept, 'evening'))}`}>
                      {getScore(dept, 'evening') || '0.0'}
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>
          </div>

          {/* Leaderboard Grid */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Skull className="h-4 w-4 text-cyber-danger" />
                <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Top Insider Threat Risk Profiles</h4>
              </div>
              <span className="text-[10px] font-mono text-cyber-danger bg-cyber-danger/10 border border-cyber-danger/20 px-2 py-0.5 rounded animate-pulse">POTENTIAL EXFILTRATION RISK</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-cyber-border text-cyber-textMuted uppercase text-[10px]">
                    <th className="py-2">Subject User</th>
                    <th className="py-2">Department</th>
                    <th className="py-2 text-center">Total Events</th>
                    <th className="py-2 text-center">Max Risk Score</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/40">
                  {charts?.top_users?.map((user, idx) => (
                    <tr key={user.username} className="hover:bg-cyber-cardHover/20 text-gray-300">
                      <td className="py-3 font-semibold text-cyber-textActive flex items-center gap-2">
                        <span className="text-cyber-textMuted">#{idx+1}</span>
                        {user.username}
                      </td>
                      <td className="py-3">{user.department}</td>
                      <td className="py-3 text-center">{user.event_count}</td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          user.max_score >= 76 ? 'bg-cyber-danger/10 text-cyber-danger border border-cyber-danger/30' :
                          user.max_score >= 51 ? 'bg-cyber-warning/10 text-cyber-warning border border-cyber-warning/30' :
                          'bg-cyber-info/10 text-cyber-info border border-cyber-info/30'
                        }`}>
                          {user.max_score}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            // Find the first alert for this user to transition to
                            fetch(`http://localhost:5000/api/alerts?user=${user.username}`)
                              .then(res => res.json())
                              .then(data => {
                                if (data && data.length > 0) {
                                  navigateToAlert(data[0].id);
                                } else {
                                  alert("No specific alerts found for user.");
                                }
                              });
                          }}
                          className="text-cyber-success hover:underline inline-flex items-center gap-1 hover:gap-1.5 transition-all text-[11px]"
                        >
                          INVESTIGATE
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Real-time Alert Feed — fills full height of its grid cell */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-cyber-border mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyber-success animate-pulse" />
              <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-200">Live Alert Feed</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyber-textMuted">{recentAlerts.length} recent</span>
              <span className="text-[10px] font-mono text-cyber-success border border-cyber-success/30 px-2 py-0.5 rounded bg-cyber-success/5 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-success animate-pulse" />
                LIVE
              </span>
            </div>
          </div>

          {/* Scrollable alert list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {recentAlerts.map((alert, idx) => (
              <div
                key={alert.id}
                onClick={() => navigateToAlert(alert.id)}
                className="group p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-cyber-success/40 hover:shadow-[0_0_14px_rgba(16,185,129,0.07)]"
                style={{
                  backgroundColor: 'rgba(10,15,29,0.6)',
                  borderColor: 'rgba(55,65,81,0.6)'
                }}
              >
                {/* Top row: user + severity badge */}
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-cyber-textActive font-mono truncate">{alert.username}</div>
                    <div className="text-[10px] text-cyber-textMuted font-mono">{alert.department}</div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono border ${
                    alert.severity === 'CRITICAL' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                    alert.severity === 'HIGH'     ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    alert.severity === 'MEDIUM'   ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                                                   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {alert.severity}
                  </span>
                </div>

                {/* Asset name */}
                <div className="text-[10px] text-gray-500 font-mono mb-2 truncate">
                  <span className="text-gray-600">▸ </span>
                  <span className="text-gray-400 group-hover:text-gray-300 transition-colors">{alert.data_asset}</span>
                </div>

                {/* Bottom row: score chip + time */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    alert.risk_score >= 76 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    alert.risk_score >= 51 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    alert.risk_score >= 26 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    ⚡ {alert.risk_score}
                  </span>
                  <span className="text-[10px] font-mono text-gray-600">
                    {alert.timestamp.split(' ')[1]?.slice(0,5) || alert.timestamp.slice(0,5)}
                  </span>
                </div>
              </div>
            ))}

            {recentAlerts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <Activity className="h-8 w-8 text-cyber-textMuted/30 mb-3" />
                <span className="text-xs font-mono text-cyber-textMuted">NO ALERTS IN FEED</span>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="shrink-0 mt-3 pt-3 border-t border-cyber-border/50">
            <div className="text-[10px] font-mono text-cyber-textMuted text-center">
              Auto-refreshes every <span className="text-cyber-success">10s</span> · Click any alert to investigate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
