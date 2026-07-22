import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function MessageBoardPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      // For now, we use a simple audit-style fetch or specific communications table
      const res = await axios.get(`${API_BASE}/api/hospital/communications`, { headers });
      setMessages(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handlePost = async () => {
    if (!newMessage) return;
    try {
      await axios.post(`${API_BASE}/api/hospital/communications`, { content: newMessage }, { headers });
      setNewMessage("");
      fetchMessages();
    } catch (err) { alert("Failed to post message."); }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Hospital Message Board" />

        <div style={{ maxWidth: '800px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>Broadcast a Message</h3>
            <textarea 
              rows={3}
              placeholder="Post an announcement or internal update for staff..."
              style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', resize: 'none' }}
              value={newMessage} onChange={e => setNewMessage(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button onClick={handlePost} style={{ padding: '10px 24px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                Post Message
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             {messages.map((m, i) => (
               <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                     <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{m.author_name || 'Hospital Admin'}</span>
                     <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{m.content}</p>
               </div>
             ))}

             {messages.length === 0 && !loading && (
               <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '32px', border: '1px dashed #e2e8f0' }}>
                  <p style={{ color: '#94a3b8', fontWeight: 600 }}>No messages posted yet.</p>
               </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}
