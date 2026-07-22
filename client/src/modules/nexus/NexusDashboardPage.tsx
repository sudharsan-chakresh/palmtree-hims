import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NexusSidebar from "../../components/NexusSidebar";
import NexusHeader from "../../components/NexusHeader";
import { API_BASE_URL as API_BASE } from "../../config/api";

const Icons = {
  Tenants: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Activity: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Plus: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Database: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  ),
  Users: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
};

export default function NexusDashboardPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const [tenantCount, setTenantCount] = useState(0);

  useEffect(() => {
    if (role !== 'nexus') {
       navigate("/");
    } else {
       axios.get(`${API_BASE}/api/nexus/tenants`, {
         headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
       })
       .then(res => setTenantCount(res.data.length))
       .catch(err => console.error("Failed to fetch tenants", err));
    }
  }, [role, navigate]);

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <NexusHeader />

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white' }}>
            <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="stat-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                <Icons.Tenants />
              </div>
              <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 700 }}>+4 New</span>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>{tenantCount}</div>
              <div className="stat-label" style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Active Hospital Shards</div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white' }}>
            <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="stat-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <Icons.Activity />
              </div>
              <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 700 }}>Live</span>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>99.9%</div>
              <div className="stat-label" style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Service Uptime</div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white' }}>
            <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="stat-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <Icons.Settings />
              </div>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>Normal</span>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>1.2ms</div>
              <div className="stat-label" style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Avg. API Latency</div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white' }}>
            <div className="stat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="stat-icon" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <Icons.Database />
              </div>
              <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 700 }}>Active</span>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>4.2 GB</div>
              <div className="stat-label" style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Total Cloud Storage</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px', color: '#0f172a', marginTop: '48px' }}>Management Actions</h2>
        <div className="action-grid">
          <div className="action-card" onClick={() => navigate('/nexus/tenants')}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -5px rgba(139, 92, 246, 0.5)' }}>
              <Icons.Plus />
            </div>
            <div className="action-content">
              <h3 style={{ fontWeight: 800 }}>Provision Shard</h3>
              <p>Setup a new hospital instance</p>
            </div>
          </div>

          <div className="action-card" onClick={() => navigate('/nexus/users')}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.5)' }}>
              <Icons.Users />
            </div>
            <div className="action-content">
              <h3 style={{ fontWeight: 800 }}>RBAC Controls</h3>
              <p>Configure Super Admin access</p>
            </div>
          </div>

          <div className="action-card" onClick={() => navigate('/nexus/activity')}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.5)' }}>
              <Icons.Activity />
            </div>
            <div className="action-content">
              <h3 style={{ fontWeight: 800 }}>Audit Logs</h3>
              <p>System telemetry & history</p>
            </div>
          </div>
          <div className="action-card" onClick={() => navigate('/nexus/tickets')}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -5px rgba(245, 158, 11, 0.5)' }}>
               <Icons.Settings />
            </div>
            <div className="action-content">
              <h3 style={{ fontWeight: 800 }}>Support Ticketing</h3>
              <p>Manage tenant requests & upgrades</p>
            </div>
          </div>

          <div className="action-card" onClick={() => navigate('/nexus/utilization')}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.5)' }}>
              <Icons.Database />
            </div>
            <div className="action-content">
              <h3 style={{ fontWeight: 800 }}>Resource Consumption</h3>
              <p>Cloud utilization & DB growth</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
