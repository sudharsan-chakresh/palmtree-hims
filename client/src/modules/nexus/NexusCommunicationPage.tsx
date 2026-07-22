import { useState, useEffect } from "react";
import axios from "axios";
import Header from "../../components/Header";
import NexusSidebar from "../../components/NexusSidebar";
import { API_BASE_URL as API_BASE } from "../../config/api";

export default function NexusCommunicationPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [signalData, setSignalData] = useState({
    type: 'PASSWORD_RESET',
    tenantId: '',
    recipientOverride: '',
    subject: 'System Notice: Required Action',
    message: ''
  });

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`
  };

  useEffect(() => {
    fetchLogs();
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/nexus/tenants/public`, { headers });
      setTenants(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/nexus/communications`, { headers });
      setLogs(res.data);
    } catch (err) {
      console.error("Nexus communication logs fetch failed:", err);
    } finally { setLoading(false); }
  };

  const sendSignal = async () => {
    if (!signalData.subject || (!signalData.tenantId && !signalData.recipientOverride)) {
      alert("Subject and at least one target (Tenant ID or Email) are required.");
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API_BASE}/api/nexus/send-signal`, signalData, { headers });
      alert("Signal dispatched successfully!");
      setShowSignalModal(false);
      fetchLogs();
    } catch (err: any) {
      alert("Failed to send signal: " + (err.response?.data?.error || err.message));
    } finally { setSending(false); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <NexusSidebar />
      <main style={{ flex: 1, padding: '40px' }}>
        <Header title="Mail & Communication Management" />

        <div style={{ maxWidth: '1200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Global Signal History</h2>
              <p style={{ color: '#64748b', marginTop: '4px' }}>Monitor all critical system emails and notifications across all hospital shards</p>
            </div>
            <button 
              onClick={() => setShowSignalModal(true)}
              style={{ padding: '12px 24px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              TRIGGER SYSTEM SIGNAL
            </button>
          </div>

          {showSignalModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
               <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '500px' }}>
                  <h3 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: 900 }}>Send System Communication</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>SIGNAL TYPE</label>
                        <select 
                          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                          value={signalData.type}
                          onChange={(e) => setSignalData({...signalData, type: e.target.value})}
                        >
                          <option value="PASSWORD_RESET">Administrative Password Reset</option>
                          <option value="UPGRADE">Plan Upgrade Notification</option>
                          <option value="DISCOUNT">Promotional Discount Offer</option>
                          <option value="GENERIC">Standard System Notice</option>
                        </select>
                     </div>
                     <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>TARGET HOSPITAL SHARD</label>
                        <select 
                          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                          value={signalData.tenantId}
                          onChange={(e) => setSignalData({...signalData, tenantId: e.target.value})}
                        >
                          <option value="">-- Select Hospital --</option>
                          {tenants.map(t => (
                             <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                          ))}
                        </select>
                     </div>
                     <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>RECIPIENT EMAIL (Override)</label>
                        <input 
                          placeholder="admin@hospital.com"
                          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                          value={signalData.recipientOverride}
                          onChange={(e) => setSignalData({...signalData, recipientOverride: e.target.value})}
                        />
                     </div>
                     <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>SUBJECT</label>
                        <input 
                          placeholder="System Message Subject"
                          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                          value={signalData.subject}
                          onChange={(e) => setSignalData({...signalData, subject: e.target.value})}
                        />
                     </div>
                     <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>MESSAGE CONTENT</label>
                        <textarea 
                          rows={4}
                          placeholder="Type your message or offer details here..."
                          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                          value={signalData.message}
                          onChange={(e) => setSignalData({...signalData, message: e.target.value})}
                        />
                     </div>
                     <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button onClick={() => setShowSignalModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f1f5f9', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                        <button 
                          onClick={sendSignal}
                          disabled={sending}
                          style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {sending ? 'Sending...' : 'Dispatch Signal'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          )}

          <div className="manage-card" style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hospital / Tenant Name</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recipient</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Subject / Signal</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{log.tenant_name || 'System'}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: '14px', color: '#475569' }}>{log.recipient}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{log.subject}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 900, 
                        color: log.status === 'Sent' || log.status === 'Delivered' ? '#16a34a' : '#ca8a04',
                        background: log.status === 'Sent' || log.status === 'Delivered' ? '#dcfce7' : '#fef3c7',
                        padding: '4px 10px',
                        borderRadius: '8px'
                      }}>{log.status.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '13px', color: '#94a3b8' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && !loading && (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                No communication logs recorded yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
