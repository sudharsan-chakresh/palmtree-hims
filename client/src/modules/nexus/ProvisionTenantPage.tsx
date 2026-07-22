import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import NexusSidebar from "../../components/NexusSidebar";
import { API_BASE_URL as API_BASE } from "../../config/api";


export default function ProvisionTenantPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dbName: "",
    plan: "Standard",
    contactName: "",
    contactEmail: "", // Official communications
    adminEmail: "",   // Login credentials
    adminPassword: "",
    uiSettings: {
      backgroundColor: "#ffffff",
      textColor: "#1e293b",
      heroBackgroundColor: "#f8fafc",
      overallTextColor: "#475569"
    }
  });

  useEffect(() => {
    if (role !== 'nexus') {
      navigate("/");
    }
  }, [role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/nexus/tenants`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      alert("Tenant provisioned successfully! Onboarding email sent to " + formData.contactEmail);
      navigate("/nexus/tenants");
    } catch (err: any) {
      alert(err.response?.data?.error || "Provisioning failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <header className="dashboard-header" style={{ marginBottom: '32px' }}>
          <div className="welcome-msg">
             <button onClick={() => navigate('/nexus/tenants')} style={{ background: 'none', border: 'none', color: '#8b5cf6', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '8px' }}>← Back to Tenants</button>
             <h1 style={{ fontSize: '28px', fontWeight: 900 }}>Provision New Shard</h1>
             <p style={{ color: '#64748b' }}>Deploy an isolated clinical instance in the cloud.</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Core Hospital Info */}
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Hospital Identity</h3>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Legal Entity Name</label>
                    <input required placeholder="e.g. Apollo Hospitals" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Unique Shard Code (Slug)</label>
                    <input required placeholder="e.g. apollo_chennai" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.dbName} onChange={e => setFormData({...formData, dbName: e.target.value.toLowerCase().replace(/\s/g, '_')})} />
                  </div>
               </div>
            </div>

            {/* Contacts & Admin */}
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Administrative Setup</h3>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Primary Contact Name (MD/Owner)</label>
                    <input required placeholder="Full Name" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Official Contact Email (For Communications)</label>
                    <input required type="email" placeholder="contact@hospital.com" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} />
                  </div>
                  <div style={{ gridColumn: 'span 2', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>System Admin Email (Login Account)</label>
                    <input required type="email" placeholder="admin@hospital.com" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>System Admin Password</label>
                    <input required type="text" placeholder="Admin@123" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
                  </div>
               </div>
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Service Plan</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['Basic', 'Standard', 'Professional', 'Enterprise'].map(plan => (
                    <label key={plan} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', border: `2px solid ${formData.plan === plan ? '#8b5cf6' : '#f1f5f9'}`, background: formData.plan === plan ? '#f5f3ff' : 'white', cursor: 'pointer' }}>
                      <input type="radio" name="plan" value={plan} checked={formData.plan === plan} onChange={() => setFormData({...formData, plan})} style={{ display: 'none' }} />
                      <span style={{ fontWeight: 800, color: formData.plan === plan ? '#8b5cf6' : '#64748b' }}>{plan}</span>
                    </label>
                  ))}
               </div>
               <button 
                 type="submit" 
                 disabled={loading}
                 style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#8b5cf6', color: 'white', border: 'none', fontWeight: 800, fontSize: '16px', marginTop: '24px', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(139, 92, 246, 0.4)' }}
               >
                 {loading ? 'PROVISIONING...' : 'DEPLOY SHARD'}
               </button>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}
