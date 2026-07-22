import { NavLink, useNavigate } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import { applyTheme } from "../config/theme";

const Icons = {
  Overview: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>,
  Tenants: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  Admins: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Logs: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Tickets: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M2 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4"/><path d="M2 9a3 3 0 0 1 0 6"/><path d="M22 9a3 3 0 0 0 0 6"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  Mail: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><rect width="20" height="14" x="2" y="5" rx="2"/></svg>,
  Utilization: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10"/><path d="M18.4 4.6a9 9 0 1 1-12.8 0"/><path d="M12 12 7 7"/></svg>
};

export default function NexusSidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    applyTheme(); // Reset to platform defaults
    navigate("/");
  };

  return (
    <>
      <div className="mobile-overlay" onClick={() => {
        document.querySelector('.sidebar')?.classList.remove('mobile-open');
        document.querySelector('.mobile-overlay')?.classList.remove('active');
      }}></div>
      <div className="sidebar">
        <button className="sidebar-close" onClick={() => {
          document.querySelector('.sidebar')?.classList.remove('mobile-open');
          document.querySelector('.mobile-overlay')?.classList.remove('active');
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="sidebar-logo">
         <BrandLogo size="sm" light={true} />
          <p style={{ fontSize: '9px', color: '#64748b', margin: '2px 0 0 52px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', opacity: 0.8 }}>Nexus</p>
      </div>

      <nav className="nav-section">
        <SidebarLink to="/nexus/dashboard" icon={<Icons.Overview />} label="Overview" />
        <SidebarLink to="/nexus/tenants" icon={<Icons.Tenants />} label="Tenants" />
        <SidebarLink to="/nexus/tickets" icon={<Icons.Tickets />} label="Support Tickets" />
        <SidebarLink to="/nexus/communications" icon={<Icons.Mail />} label="Mail Management" />
        <SidebarLink to="/nexus/utilization" icon={<Icons.Utilization />} label="Cloud Utilization" />
        <SidebarLink to="/nexus/users" icon={<Icons.Admins />} label="Super Admins" />
        <SidebarLink to="/nexus/activity" icon={<Icons.Logs />} label="System Logs" />
        <SidebarLink to="/nexus/settings" icon={<Icons.Settings />} label="Settings" />
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
        <button 
          onClick={handleLogout}
          className="button-secondary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.1)'
          }}
        >
          <Icons.Logout />
          Logout
        </button>
      </div>
      </div>
    </>
  );
}

function SidebarLink({ to, icon, label }: { to: string, icon: any, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      onClick={() => {
        document.querySelector('.sidebar')?.classList.remove('mobile-open');
        document.querySelector('.mobile-overlay')?.classList.remove('active');
      }}
    >
      {icon}
      {label}
    </NavLink>
  );
}
