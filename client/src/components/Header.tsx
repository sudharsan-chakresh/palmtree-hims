import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import BrandLogo from "./BrandLogo";
import { applyTheme, getNamespacedItem } from "../config/theme";

interface HeaderProps {
  title: string;
  compact?: boolean;
}

export default function Header({ title, compact = false }: HeaderProps) {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "User";
  const tenantName = getNamespacedItem('tenantName') || localStorage.getItem("tenantName") || "Palmtree Wellness Hospital";

  const handleLogout = () => {
    localStorage.clear();
    applyTheme(); // Reset to platform defaults
    navigate("/");
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getTaglineForPage = (title: string) => {
    switch (title.toLowerCase()) {
      case 'staff':
      case 'staff addition':
      case 'staff management':
        return 'Manage credentials, schedules, and administrative permissions for your clinic staff.';
      case 'billing':
      case 'billing & queue':
      case 'billing & invoicing':
        return 'Process patient payments, generate invoices, and manage billing queues efficiently.';
      case 'pharmacy':
      case 'pharmacy management':
      case 'inventory':
      case 'pharmacy inventory':
        return 'Track medicine stocks, monitor batch expirations, and fulfill prescriptions.';
      case 'lab orders':
      case 'laboratory':
        return 'Monitor lab test orders, update diagnostic results, and track patient pathology files.';
      case 'settings':
      case 'hospital branding & ui':
        return 'Customize hospital metadata, UI branding, theme colors, and layout presets.';
      case 'patients':
      case 'patient management':
        return 'Register patients, track diagnostics history, and oversee clinic consultation queues.';
      default:
        return `Monitor, configure, and manage your ${title} operations with high precision.`;
    }
  };

  return (
    <header className="dashboard-header" style={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: compact ? '12px 24px' : '24px 32px',
      width: '100%',
      marginBottom: compact ? '12px' : '32px',
      gap: isMobile ? '20px' : '0'
    }}>
      {/* Left Welcome/Title block */}
      <div style={{ zIndex: 2, textAlign: 'left', width: isMobile ? '100%' : 'auto' }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', width: '100%' }}>
            <button 
              className="hamburger-menu"
              onClick={() => {
                document.querySelector('.sidebar')?.classList.add('mobile-open');
                document.querySelector('.mobile-overlay')?.classList.add('active');
              }}
              style={{ color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="7" x2="20" y2="7"></line>
                <line x1="4" y1="12" x2="20" y2="12"></line>
                <line x1="4" y1="17" x2="20" y2="17"></line>
              </svg>
            </button>
            <div style={{ transform: 'scale(0.8)', transformOrigin: 'right center' }}>
              <BrandLogo size="sm" />
            </div>
          </div>
        )}
        <h1 style={{ 
          fontSize: compact ? '20px' : (isMobile ? '24px' : '28px'), 
          fontWeight: 900, 
          color: '#ffffff', 
          margin: 0,
          letterSpacing: '-0.02em',
          textShadow: '0 2px 10px rgba(0,0,0,0.15)'
        }}>{title}</h1>
        <p style={{ margin: compact ? '2px 0 6px' : '4px 0 12px', color: 'rgba(255, 255, 255, 0.8)', fontSize: compact ? '12px' : '14px', fontWeight: 500 }}>
          {getTaglineForPage(title)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
          <span className="tenant-brand-text" style={{ fontSize: '13px' }}>
            {tenantName}
          </span>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.15)' }} />
          <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>{userName}</span>
        </div>
      </div>

      {/* Right side controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '20px', 
        zIndex: 2,
        width: isMobile ? '100%' : 'auto',
        justifyContent: isMobile ? 'center' : 'flex-end'
      }}>
        {!isMobile && (
          <div style={{ 
            transform: 'scale(0.55)', 
            transformOrigin: 'right center',
            opacity: 1,
            marginBottom: '-4px'
          }}>
            <BrandLogo size="sm" />
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="button-secondary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: compact ? '8px 14px' : '10px 18px',
            fontSize: '11px',
            fontWeight: 800,
            borderRadius: '12px',
            cursor: 'pointer',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          LOGOUT
        </button>
      </div>
    </header>
  );
}
