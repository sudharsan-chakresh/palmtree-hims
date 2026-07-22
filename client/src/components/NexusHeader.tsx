import { useNavigate } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function NexusHeader() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "SuperAdmin";

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '32px',
      paddingBottom: '16px',
      borderBottom: '1px solid #f1f5f9'
    }}>
      <div className="welcome-msg">
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Nexus Control Plane</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Global Healthcare Orchestration</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Official Branding */}
        <div style={{ transform: 'scale(0.8)', transformOrigin: 'right center' }}>
           <BrandLogo size="sm" />
        </div>

        {/* User Info & Quick Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
             <p style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{userName}</p>
             <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Root Access</p>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              padding: '10px 16px', 
              borderRadius: '10px', 
              background: '#fee2e2', 
              color: '#ef4444', 
              border: 'none', 
              fontSize: '12px', 
              fontWeight: 800, 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            LOGOUT
          </button>
        </div>
      </div>
    </header>
  );
}
