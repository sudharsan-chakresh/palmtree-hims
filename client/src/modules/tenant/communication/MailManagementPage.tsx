import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function MailManagementPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/mail-logs`, { headers });
      setLogs(res.data);
    } catch (err) { 
      console.error("Mail logs fetch failed:", err);
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "var(--app-bg)", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
        Loading Communication Logs...
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Mail & Communication Management" />

        <div style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Communication Logs</h2>
              <p style={{ color: '#64748b', marginTop: '4px' }}>Track outgoing emails and SMS notifications sent to patients</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button style={{ padding: '10px 20px', borderRadius: '12px', background: '#f1f5f9', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Export Logs</button>
               <button style={{ padding: '10px 20px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
            </div>
          </div>

          <div className="manage-card" style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recipient</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Subject / Message</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{log.recipient}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: '14px', color: '#475569' }}>{log.subject}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>{log.type}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontSize: '12px', 
                        fontWeight: 700, 
                        color: log.status === 'Sent' || log.status === 'Delivered' ? '#16a34a' : '#ca8a04' 
                      }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></div>
                        {log.status}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                No communication logs found.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
