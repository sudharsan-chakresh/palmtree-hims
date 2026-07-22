import { useNavigate } from "react-router-dom";

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  moduleName?: string;
}

/**
 * RoleGuard — wraps any page component and blocks access
 * if the logged-in user's role is not in allowedRoles.
 *
 * Usage:
 *   <RoleGuard allowedRoles={['lab_assistant', 'admin']} moduleName="Laboratory">
 *     <LabManagementPage />
 *   </RoleGuard>
 */
export default function RoleGuard({ allowedRoles, children, moduleName = "This Module" }: RoleGuardProps) {
  const navigate = useNavigate();
  // Normalize to lowercase — backend seeds roles as uppercase (ADMIN, DOCTOR, etc.)
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

  // Admin always bypasses all role guards
  if (role.includes("admin") || normalizedAllowedRoles.includes(role)) {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        textAlign: 'center',
        padding: '60px 80px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '32px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        maxWidth: '500px'
      }}>
        {/* Lock Icon */}
        <div style={{
          width: '80px', height: '80px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 32px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 12px' }}>
          Access Restricted
        </h1>
        <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, margin: '0 0 32px' }}>
          You don't have permission to access <strong style={{ color: '#94a3b8' }}>{moduleName}</strong>.
          This section is restricted to specific clinical roles.
        </p>

        <div style={{
          padding: '20px 24px',
          background: 'rgba(59, 130, 246, 0.08)',
          borderRadius: '16px',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Role Information
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '13px' }}>Your Role</span>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '13px', textTransform: 'capitalize' }}>
              {role.replace('_', ' ') || 'Unknown'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '13px' }}>Required Roles</span>
            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '13px' }}>
              {allowedRoles.map(r => r.replace('_', ' ')).join(', ')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              flex: 1, padding: '14px', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#94a3b8',
              fontWeight: 700, cursor: 'pointer', fontSize: '14px'
            }}
          >
            ← Go Back
          </button>
          <button
            onClick={() => navigate('/tenant/dashboard')}
            style={{
              flex: 1, padding: '14px', borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              fontWeight: 700, cursor: 'pointer', fontSize: '14px',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
            }}
          >
            Go to Dashboard
          </button>
        </div>

        <p style={{ color: '#334155', fontSize: '12px', marginTop: '24px' }}>
          Contact your system administrator to request access.
        </p>
      </div>
    </div>
  );
}
