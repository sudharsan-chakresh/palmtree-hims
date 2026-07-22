import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import NexusSidebar from "../../components/NexusSidebar";
import NexusHeader from "../../components/Header";
import { API_BASE_URL as API_BASE } from "../../config/api";


export default function TenantsListPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/api/nexus/tenants`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setTenants(data);
    } catch (err) {
      console.error("Failed to fetch tenants", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently DELETE ${name}?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/nexus/tenants/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      alert("Tenant deleted.");
      fetchTenants();
    } catch (err) {
      alert("Failed to delete tenant.");
    }
  };

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <NexusHeader title="Infrastructure Control" />

        <div className="page-card">
          <div className="section-header" style={{ padding: '24px' }}>
             <h3 className="section-title">Active Hospital Shards</h3>
             <button 
               onClick={() => navigate('/nexus/tenants/new')}
               className="button-primary"
             >
               + Provision Tenant
             </button>
          </div>
          
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading shards...</div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  <th>TENANT NAME</th>
                  <th>SHARD ID</th>
                  <th>PLAN</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ color: '#64748b', fontSize: '13px' }}>{t.dbName || t.code || 'NO_SHARD'}</td>
                    <td>
                       <span className="status-pill success" style={{ fontWeight: 700 }}>{t.plan || 'Standard'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <button className="button-link" onClick={() => navigate(`/nexus/tenants/${t.id}`)}>Manage</button>
                        <button className="button-link" style={{ color: '#ef4444' }} onClick={() => handleDelete(t.id, t.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No tenants provisioned yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
