import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

const CATEGORIES = ["Tier Upgrade", "Technical Bug", "Feature Request", "Billing Issue", "Account Management"];

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const tenantId = localStorage.getItem("tenant") || ""; 

  const [form, setForm] = useState({
    subject: "",
    category: "Technical Bug",
    priority: "Medium",
    message: ""
  });

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/nexus/tickets?tenantId=${tenantId}`, { headers: getHeaders() });
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Ticketing fetch failed:", err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/nexus/tickets`, {
        ...form,
        tenantId
      }, { headers: getHeaders() });
      alert("Ticket submitted successfully! Our support team will respond shortly.");
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      alert("Failed to submit ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Help & Support Desk" />

        <div style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Support Tickets</h2>
              <p style={{ color: '#64748b', marginTop: '4px' }}>Track your requests and system upgrade status</p>
            </div>
            <button 
              onClick={() => setShowForm(!showForm)}
              style={{ padding: '12px 24px', borderRadius: '14px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              {showForm ? "Cancel Request" : "+ Raise New Ticket"}
            </button>
          </div>

          {showForm && (
            <div className="manage-card" style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>Category</label>
                    <select 
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                      value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>Priority</label>
                    <select 
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                      value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>Subject</label>
                  <input 
                    placeholder="Briefly describe the issue..."
                    required
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>Detailed Description</label>
                  <textarea 
                    rows={5}
                    placeholder="Provide context, error messages, or upgrade requirements..."
                    required
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', resize: 'none' }}
                    value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                  />
                </div>

                <button type="submit" disabled={loading} style={{ padding: '16px', borderRadius: '16px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                  {loading ? "SUBMITTING..." : "SUBMIT SUPPORT REQUEST"}
                </button>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Array.isArray(tickets) && tickets.map((ticket, i) => (
              <div key={i} style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Ticket #{ticket.id?.substring(0,8) || i}</span>
                    <h3 style={{ margin: '4px 0', fontSize: '18px', fontWeight: 800 }}>{ticket.subject}</h3>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                       <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>{ticket.category}</span>
                       <span style={{ 
                         fontSize: '10px', 
                         background: ticket.status === 'Open' ? '#fef3c7' : ticket.status === 'Resolved' ? '#dcfce7' : '#f1f5f9', 
                         color: ticket.status === 'Open' ? '#92400e' : ticket.status === 'Resolved' ? '#166534' : '#64748b', 
                         padding: '4px 8px', 
                         borderRadius: '6px', 
                         fontWeight: 900 
                       }}>{(ticket.status || 'Open').toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Raised on</p>
                    <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{new Date(ticket.created_at || Date.now()).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div style={{ background: 'var(--app-bg)', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                   <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>{ticket.message}</p>
                </div>

                {ticket.response && (
                  <div style={{ marginTop: '16px', padding: '16px', background: '#eff6ff', borderRadius: '16px', border: '1px solid #dbeafe' }}>
                     <p style={{ fontSize: '11px', fontWeight: 900, color: '#1e40af', marginBottom: '4px', textTransform: 'uppercase' }}>Response from Nexus Support</p>
                     <p style={{ fontSize: '14px', color: '#1e40af', margin: 0 }}>{ticket.response}</p>
                  </div>
                )}
              </div>
            ))}

            {(!Array.isArray(tickets) || tickets.length === 0) && !showForm && (
              <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '32px', border: '1px dashed #e2e8f0' }}>
                 <p style={{ color: '#94a3b8', fontWeight: 600 }}>No active support requests. Need help with an upgrade or a bug?</p>
                 <button onClick={() => setShowForm(true)} style={{ marginTop: '16px', background: 'none', border: 'none', color: '#0f172a', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Raise your first ticket</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
