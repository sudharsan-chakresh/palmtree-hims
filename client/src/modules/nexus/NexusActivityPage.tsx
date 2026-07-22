import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NexusSidebar from "../../components/NexusSidebar";

export default function NexusActivityPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  useEffect(() => {
    if (role !== 'nexus') {
      navigate("/");
    }
  }, [role, navigate]);

  const logs = [
    { id: 1, action: "Tenant Provisioned", user: "admin@hmis-sys.com", target: "City Care Clinic", time: "2 mins ago" },
    { id: 2, action: "Settings Updated", user: "admin@hmis-sys.com", target: "System Config", time: "15 mins ago" },
    { id: 3, action: "User Login", user: "support@hmis-sys.com", target: "Nexus Dashboard", time: "1 hour ago" },
    { id: 4, action: "Database Backup", user: "System", target: "Global DB", time: "4 hours ago" },
  ];

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <header className="dashboard-header">
          <div className="welcome-msg">
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>System Activity Logs</h1>
            <p>Audit trail of all platform-wide operations.</p>
          </div>
        </header>

        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
             <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Real-time Events</h3>
          </div>
          <div style={{ padding: '0 24px' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ padding: '20px 0', borderBottom: log.id === logs.length ? 'none' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.action}</div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>by {log.user} • {log.target}</div>
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>{log.time}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
