import { useState, useEffect } from "react";
import axios from "axios";
import Header from "../../components/Header";
import NexusSidebar from "../../components/NexusSidebar";
import { API_BASE_URL as API_BASE } from "../../config/api";

export default function NexusTicketingPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [response, setResponse] = useState("");

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/nexus/tickets`, { headers });
      setTickets(res.data);
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (status: string) => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      await axios.patch(`${API_BASE}/api/nexus/tickets/${selectedTicket.id}`, {
        status,
        response
      }, { headers });
      alert("The ticket is resolved");
      setSelectedTicket(null);
      setResponse("");
      fetchTickets();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Unable to resolve: Database or network connectivity issue.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <NexusSidebar />
      <main style={{ flex: 1, padding: '40px' }}>
        <Header title="Nexus Support Command Center" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '32px' }}>
          <div>
             <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Active Tickets</p>
                   <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 900 }}>{tickets.filter(t => t.status === 'Open').length}</p>
                </div>
                <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Resolved (7d)</p>
                   <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 900 }}>{tickets.filter(t => t.status === 'Resolved').length}</p>
                </div>
             </div>

             <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                   <thead style={{ background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9' }}>
                      <tr>
                         <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>TENANT / SUBJECT</th>
                         <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>CATEGORY</th>
                         <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>STATUS</th>
                         <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>DATE</th>
                      </tr>
                   </thead>
                   <tbody>
                      {tickets.map((t, i) => (
                        <tr key={i} onClick={() => setSelectedTicket(t)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedTicket?.id === t.id ? '#f1f5f9' : 'transparent' }}>
                           <td style={{ padding: '20px 24px' }}>
                              <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{t.tenant_name}</p>
                              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>{t.subject}</p>
                           </td>
                           <td style={{ padding: '20px 24px' }}>
                              <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>{t.category}</span>
                           </td>
                           <td style={{ padding: '20px 24px' }}>
                              <span style={{ 
                                fontSize: '10px', 
                                background: t.status === 'Open' ? '#fef3c7' : t.status === 'Resolved' ? '#dcfce7' : '#f1f5f9', 
                                color: t.status === 'Open' ? '#92400e' : t.status === 'Resolved' ? '#166534' : '#64748b', 
                                padding: '4px 8px', borderRadius: '6px', fontWeight: 900 
                              }}>{t.status.toUpperCase()}</span>
                           </td>
                           <td style={{ padding: '20px 24px', textAlign: 'right', fontSize: '13px', color: '#94a3b8' }}>
                              {new Date(t.created_at).toLocaleDateString()}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

          <aside>
             {selectedTicket ? (
               <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0', position: 'sticky', top: '40px' }}>
                  <div style={{ marginBottom: '24px' }}>
                     <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Resolution Center</span>
                     <h2 style={{ margin: '8px 0', fontSize: '20px', fontWeight: 900 }}>Ticket Details</h2>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                     <label style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Inquiry from {selectedTicket.tenant_name}</label>
                     <p style={{ fontSize: '15px', color: '#0f172a', fontWeight: 600, lineHeight: 1.6, marginTop: '8px' }}>{selectedTicket.message}</p>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                     <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Admin Response (Will notify tenant via email)</label>
                     <textarea 
                       rows={6}
                       placeholder="Enter resolution or upgrade confirmation..."
                       style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', resize: 'none', fontSize: '14px' }}
                       value={response} onChange={e => setResponse(e.target.value)}
                     />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                     <button 
                       disabled={loading}
                       onClick={() => handleUpdate('Resolved')}
                       style={{ flex: 1, padding: '16px', borderRadius: '16px', background: '#10b981', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                     >
                       {loading ? 'RESOLVING...' : 'RESOLVE'}
                     </button>
                     <button 
                       disabled={loading}
                       onClick={() => handleUpdate('In Progress')}
                       style={{ flex: 1, padding: '16px', borderRadius: '16px', background: '#f59e0b', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                     >
                       {loading ? 'UPDATING...' : 'UPDATE'}
                     </button>
                  </div>
               </div>
             ) : (
               <div style={{ textAlign: 'center', padding: '80px 40px', background: '#f1f5f9', borderRadius: '32px', border: '2px dashed #cbd5e1' }}>
                  <p style={{ color: '#64748b', fontWeight: 600 }}>Select a ticket from the left to view details and respond.</p>
               </div>
             )}
          </aside>
        </div>
      </main>
    </div>
  );
}
