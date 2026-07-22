import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import NexusSidebar from "../../components/NexusSidebar";
import { API_BASE_URL as API_BASE } from "../../config/api";


export default function TenantDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const role = localStorage.getItem("role");

  useEffect(() => {
    if (role !== 'nexus') {
      navigate("/");
      return;
    }

    const fetchTenant = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/nexus/tenants/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setTenant(res.data);
      } catch (err) {
        console.error(err);
        navigate("/nexus/tenants");
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, [id, role, navigate]);

  const resetPassword = async () => {
    if (!newPassword) return alert("Please enter a new password");
    if (!window.confirm(`Are you sure you want to reset the admin password for ${tenant.name}?`)) return;
    
    setActionLoading(true);
    try {
      await axios.patch(`${API_BASE}/api/nexus/tenants/${id}/password`, {
        newPassword,
        adminEmail: "admin@hospital.com" // In production, this would be fetched from tenant contacts
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      alert("Password reset successfully and notification sent to hospital admin.");
      setNewPassword("");
    } catch (err) {
      alert("Failed to reset password. Please check backend connectivity.");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteShard = async () => {
    const confirmation = window.prompt(`Type DELETE to confirm decommissioning ${tenant.name}. This will PERMANENTLY erase all patient data.`);
    if (confirmation !== "DELETE") return;

    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE}/api/nexus/tenants/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      alert("Shard decommissioned and deleted successfully.");
      navigate("/nexus/tenants");
    } catch (err) {
      alert("Failed to delete shard. It might be in use or connection failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading shard details...</div>;
  if (!tenant) return <div style={{ padding: '40px', textAlign: 'center' }}>Shard not found.</div>;

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <header className="dashboard-header" style={{ marginBottom: '32px' }}>
          <div className="welcome-msg">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <button onClick={() => navigate('/nexus/tenants')} className="button-link" style={{ padding: 0 }}>← Back to Shards</button>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 900 }}>{tenant.name}</h1>
            <p style={{ color: '#64748b' }}>Shard ID: {tenant.id} • Status: <span className="status-pill success">Healthy</span></p>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Configuration Card */}
            <div className="page-card">
              <h3 className="section-title" style={{ marginBottom: '24px', color: '#0f172a' }}>Technical Configuration</h3>
              <div className="form-grid grid-2">
                <div className="info-card">
                   <p className="field-label">DATABASE SCHEMA</p>
                   <p className="field-value">{tenant.db_name || tenant.code}</p>
                </div>
                <div className="info-card">
                   <p className="field-label">SUBSCRIPTION PLAN</p>
                   <p className="field-value" style={{ color: '#8b5cf6' }}>{tenant.plan}</p>
                </div>
                <div className="info-card">
                   <p className="field-label">PROVISIONED ON</p>
                   <p className="field-value">{new Date(tenant.created_at).toLocaleDateString()}</p>
                </div>
                <div className="info-card">
                   <p className="field-label">OFFICIAL CONTACT</p>
                   <p className="field-value">{tenant.contact_email || 'N/A'}</p>
                </div>
                <div className="info-card">
                   <p className="field-label">SYSTEM ADMIN</p>
                   <p className="field-value">{tenant.admin_email || 'N/A'}</p>
                </div>
                <div className="info-card">
                   <p className="field-label">RESOURCE USAGE</p>
                   <p className="field-value">0.42 GB / 20 GB</p>
                </div>
              </div>
            </div>

            {/* Security Actions */}
            <div className="page-card">
              <h3 className="section-title" style={{ marginBottom: '24px', color: '#ef4444' }}>Security Controls</h3>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label" style={{ marginBottom: '8px' }}>Force Reset Admin Password</label>
                  <input 
                    type="text" 
                    placeholder="Enter new complex password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-field"
                  />
                </div>
                <button 
                  onClick={resetPassword}
                  disabled={actionLoading}
                  className="button-primary"
                  style={{ height: '48px' }}
                >
                  {actionLoading ? 'Processing...' : 'Execute Reset'}
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>This will immediately update the shard's admin account and send a notification email.</p>
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="page-card" style={{ background: '#fef2f2', borderColor: '#fee2e2' }}>
               <h4 style={{ color: '#991b1b', fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>Danger Zone</h4>
               <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '16px' }}>Decommissioning a tenant will permanently delete the database shard and all patient data. This action is irreversible.</p>
               <button 
                 onClick={deleteShard}
                 disabled={actionLoading}
                 className="button-primary"
                 style={{ width: '100%', background: '#ef4444', color: 'white' }}
               >
                 {actionLoading ? 'Deleting...' : 'Delete Shard'}
               </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
