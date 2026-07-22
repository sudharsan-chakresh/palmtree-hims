import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NexusSidebar from "../../components/NexusSidebar";

export default function NexusSettingsPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  useEffect(() => {
    if (role !== 'nexus') {
      navigate("/");
    }
  }, [role, navigate]);

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <header className="dashboard-header">
          <div className="welcome-msg">
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Nexus Configuration</h1>
            <p>Global platform settings and API integrations.</p>
          </div>
        </header>

        <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>System Integrations</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: 'var(--app-bg)', borderRadius: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Resend API</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Used for transactional hospital provisioning emails.</div>
              </div>
              <div style={{ color: '#10b981', fontWeight: 800, fontSize: '12px' }}>CONNECTED</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: 'var(--app-bg)', borderRadius: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Stripe Connect</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Used for global tenant subscription billing.</div>
              </div>
              <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '12px' }}>PENDING SETUP</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: 'var(--app-bg)', borderRadius: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Global DB (Supabase)</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Primary nexus registry and communication hub.</div>
              </div>
              <div style={{ color: '#10b981', fontWeight: 800, fontSize: '12px' }}>CONNECTED</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
