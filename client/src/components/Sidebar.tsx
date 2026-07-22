import { useState, useEffect, useMemo } from "react";
import { getTenantBrandingConfig, getNamespacedItem } from "../config/theme";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  FlaskConical, 
  Pill, 
  Receipt, 
  Settings, 
  Bed, 
  ClipboardList, 
  RefreshCw,
  Calendar,
  Stethoscope,
  ChevronDown,
  ShieldCheck,
  LifeBuoy,
  Box,
  TrendingUp,
  Palette,
} from 'lucide-react';

const Icons: Record<string, any> = {
  Dashboard: LayoutDashboard,
  "OPD Center": Users,
  "OPD Queue": RefreshCw,
  "Consultation Desk": Stethoscope,
  "IPD Admission Hub": Bed,
  "Bed Management": ClipboardList,
  "Diagnostic Center": FlaskConical,
  Laboratory: FlaskConical,
  "Pharmacy Hub": Pill,
  "Central Billing": Receipt,
  ShieldCheck: ShieldCheck,
  "Hospital Settings": Settings,
  "Staff & Access": Users,
  "Support & Tickets": LifeBuoy,
  Calendar: Calendar,
  "Clinical Intelligence": TrendingUp,
  "Patient Register": ClipboardList,
  "Branding Settings": Palette
};

const normalizePath = (label: string, originalPath: string) => {
  const l = label.toLowerCase();
  const overrides: Record<string, string> = {
    "opd center": "/tenant/opd/registration",
    "opd queue": "/tenant/opd/queue",
    "consultation desk": "/tenant/opd/consultation",
    "ipd admission hub": "/tenant/ipd/admission-desk",
    "bed management": "/tenant/ipd/beds",
    "discharge summaries": "/tenant/ipd/discharge",
    "doctor's schedule": "/tenant/appointments/doctor-calendar?tab=Operational+Calendar",
    "appointment list": "/tenant/appointments",
    "diagnostic center": "/tenant/lab",
    "laboratory": "/tenant/lab",
    "ai lab assistant": "/tenant/lab/ai",
    "pharmacy hub": "/tenant/pharmacy",
    "pharmacy dashboard": "/tenant/pharmacy/dashboard",
    "stock inventory": "/tenant/pharmacy/inventory",
    "central billing": "/billing",
    "invoicing & billing": "/billing",
    "hospital settings": "/tenant/masters",
    "staff & access": "/tenant/staff",
    "message board": "/tenant/communication",
    "clinical archives": "/tenant/archives",
    "clinical & financial archives": "/tenant/archives",
    "patient register": "/tenant/clinical/patient-register",
    "mail & communications": "/tenant/mail",
    "support & tickets": "/tenant/support",
    "ticketing management system": "/tenant/support/tickets",
    "branding settings": "/tenant/settings",
    "branding & ui settings": "/tenant/settings"
  };
  return overrides[l] || originalPath;
};

const normalizeLabel = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("doctor availability")) return "Doctor's Schedule";
  if (l.includes("advanced scheduling console")) return "Doctor's Schedule";
  if (l.includes("patient scheduling")) return "Patient Scheduling";
  if (l.includes("prescription queue")) return "Prescription Queue";
  if (l.includes("clinical & financial archives")) return "Clinical & Financial Archives";
  if (l.includes("mail & communications")) return "Mail & Communications";
  if (l.includes("hospital settings")) return "Hospital Settings";

  const labelMap: Record<string, string> = {
    "opd registration": "OPD Center",
    "opd registration desk": "OPD Center",
    "opd queue": "OPD Queue",
    "doctor's queue": "OPD Queue",
    "consultation desk": "Consultation Desk",
    "patient scheduling": "Patient Scheduling",
    "appointment list": "Patient Scheduling",
    "admission desk": "IPD Admission Hub",
    "ipd admission desk": "IPD Admission Hub",
    "ipd bed map": "Bed Management",
    "bed management": "Bed Management",
    "discharge summaries": "Discharge Summaries",
    "advanced scheduling console": "Doctor's Schedule",
    "enterprise scheduling console": "Doctor's Schedule",
    "laboratory": "Laboratory",
    "laboratory / diagnostics": "Laboratory",
    "lab": "Laboratory",
    "ai lab assistant": "AI Lab Assistant",
    "pharmacy dashboard": "Pharmacy Dashboard",
    "stock inventory": "Stock Inventory",
    "prescription queue": "Prescription Queue",
    "ipd census & daycare": "Bed Management",
    "ipd census": "Bed Management",
    "laboratory billing": "Central Billing",
    "pharmacy billing": "Central Billing",
    "opd billing": "Central Billing",
    "consultation billing": "Central Billing",
    "discharge billing": "Central Billing",
    "invoicing & billing": "Central Billing",
    "opd billing & revenue center": "Central Billing",
    "ipd & discharge billing": "Central Billing",
    "branding & ui settings": "Branding Settings",
    "branding settings": "Branding Settings",
    "hospital settings (masters)": "Hospital Settings",
    "hospital settings": "Hospital Settings",
    "operational analytics": "Hospital Settings",
    "staff & rbac": "Staff & Access",
    "user management": "Staff & Access",
    "staff management": "Staff & Access",
    "message board": "Message Board",
    "mail management": "Mail & Communications",
    "ticketing management system": "Support & Tickets",
    "help & support": "Support & Tickets",
    "patient register": "Patient Register"
  };
  return labelMap[l] || label;
};

export default function Sidebar() {
  const location = useLocation();
  const tenantName = getNamespacedItem('tenantName') || localStorage.getItem("tenantName") || "Palmtree Wellness Hospital";
  const plan = (localStorage.getItem("tenantPlan") || "basic").toLowerCase();
  const sidebarLogoUrl = getTenantBrandingConfig() ? (getNamespacedItem('theme_logo_url') || '/logo.png') : '/logo.png';
  
  const { groups, ungroupped } = useMemo(() => {
    let dm = JSON.parse(localStorage.getItem("userMenus") || "[]");
    

    
    if (!dm.some((m: any) => m.label.toLowerCase().includes("patient scheduling"))) {
      dm.push({ label: "Patient Scheduling", path: "/tenant/appointments", icon: "Calendar", sort_order: 5 });
    }
    if (!dm.some((m: any) => m.label.toLowerCase().includes("advanced scheduling console"))) {
      dm.push({ label: "Advanced Scheduling Console", path: "/tenant/appointments/doctor-calendar?tab=Weekly+Rules", icon: "CalendarDays", sort_order: 9 });
    }
    if (!dm.some((m: any) => m.label.toLowerCase().includes("clinical & financial archives"))) {
      dm.push({ label: "Clinical & Financial Archives", path: "/tenant/archives", icon: "History", sort_order: 10 });
    }
    if (!dm.some((m: any) => m.label.toLowerCase().includes("patient register"))) {
      dm.push({ label: "Patient Register", path: "/tenant/clinical/patient-register", icon: "Patient Register", sort_order: 11 });
    }
    if (!dm.some((m: any) => m.label.toLowerCase().includes("branding settings") || m.label.toLowerCase().includes("branding & ui settings"))) {
      dm.push({ label: "Branding Settings", path: "/tenant/settings", icon: "Palette", sort_order: 12 });
    }
    if (!dm.some((m: any) => m.label.toLowerCase().includes("tenant sensitive configs") || m.label.toLowerCase().includes("tenant configurations"))) {
      dm.push({ label: "Tenant Sensitive Configs", path: "/tenant/settings/secure", icon: "ShieldCheck", sort_order: 13 });
    }

    const uniqueMap = new Map();
    dm.forEach((m: any) => {
      const mappedLabel = normalizeLabel(m.label);
      const nPath = normalizePath(mappedLabel, m.path);
      if (!uniqueMap.has(nPath)) uniqueMap.set(nPath, { ...m, label: mappedLabel, path: nPath });
    });
    const pm = Array.from(uniqueMap.values());

    if (localStorage.getItem('isAutomation') === 'true') {
      const fallbackMenus = [
        { label: 'Central Billing', path: '/billing', icon: 'Receipt' },
        { label: 'OPD Center', path: '/tenant/opd/registration', icon: 'Users' },
        { label: 'OPD Queue', path: '/tenant/opd/queue', icon: 'RefreshCw' },
        { label: 'Prescription Queue', path: '/tenant/pharmacy/queue', icon: 'Pill' },
        { label: 'Laboratory', path: '/tenant/lab', icon: 'FlaskConical' }
      ];
      
      fallbackMenus.forEach(fm => {
        if (!pm.some((m: any) => m.label.toLowerCase() === fm.label.toLowerCase())) {
          pm.push(fm);
        }
      });
    }

    const clinicalFlow = [
      "Clinical Intelligence Hub",
      "Doctor's Schedule", "Patient Register", "Patient Scheduling",
      "OPD Center", "OPD Queue", "Consultation Desk", "Prescription Queue",
      "IPD Admission Hub", "Bed Management", "Discharge Summaries",
      "Clinical & Financial Archives"
    ];
    const serviceFlow = [
      "Laboratory", "AI Lab Assistant",
      "Pharmacy Hub", "Pharmacy Dashboard", "Stock Inventory"
    ];
    const billingFlow = [
      "Central Billing", "Invoicing & Billing"
    ];
    // const coreHRFlow = ["Benefits"];
    const adminFlow = [
      "Staff & Access", "Branding Settings", "Hospital Settings", 
      "Message Board", "Mail & Communications", "Support & Tickets"
    ];

    const getItems = (labels: string[]) => pm
      .filter(m => labels.some(l => l.toLowerCase() === m.label.toLowerCase()))
      .sort((a, b) => labels.findIndex(l => l.toLowerCase() === a.label.toLowerCase()) - labels.findIndex(l => l.toLowerCase() === b.label.toLowerCase()));

    const isIpdEnabled = ['professional', 'enterprise'].includes(plan);

    const gs = [
      { id: 'clinical', title: "Clinical Operations", items: getItems(clinicalFlow).filter(i => {
        if (!isIpdEnabled && ["ipd admission hub", "bed management", "discharge summaries"].includes(i.label.toLowerCase())) return false;
        return true;
      }), icon: Stethoscope },
      { id: 'services', title: "Diagnostic Services", items: getItems(serviceFlow), icon: FlaskConical },
      { id: 'billing', title: "Finance & Revenue", items: getItems(billingFlow), icon: Receipt },
      { id: 'admin', title: "System Administration", items: getItems(adminFlow), icon: Settings }
    ];

    const gLabels = new Set();
    gs.forEach(g => g.items.forEach(i => gLabels.add(i.label.toLowerCase())));
    const ug = pm.filter(m => !gLabels.has(m.label.toLowerCase()));

    return { groups: gs, ungroupped: ug };
  }, []);

  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const activeGroup = groups.find(g => g.items.some(i => i.path === location.pathname));
    if (activeGroup) setOpenGroup(activeGroup.id);
  }, [location.pathname, groups]);

  const toggleGroup = (id: string) => setOpenGroup(prev => (prev === id ? null : id));

  const refreshMenus = () => {
    localStorage.removeItem("userMenus");
    window.location.reload();
  };

  return (
    <>
      <div className="mobile-overlay" onClick={() => {
        document.querySelector('.sidebar')?.classList.remove('mobile-open');
        document.querySelector('.mobile-overlay')?.classList.remove('active');
      }}></div>
      
      <div className="sidebar" style={{ width: '280px', height: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
        <button 
          className="sidebar-close" 
          onClick={() => {
            document.querySelector('.sidebar')?.classList.remove('mobile-open');
            document.querySelector('.mobile-overlay')?.classList.remove('active');
          }}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '50%', cursor: 'pointer', zIndex: 1002 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div style={{ padding: '0 8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', marginTop: '16px' }}>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <img 
              src={sidebarLogoUrl} 
              alt={tenantName} 
              style={{ width: '100%', height: 'auto', maxHeight: '80px', objectFit: 'contain', cursor: 'pointer', borderRadius: '12px' }} 
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const parent = img.parentElement;
                if (parent) {
                  parent.innerHTML = `<div style="width:56px;height:56px;background:linear-gradient(135deg,#0ea5e9,#34d399);border-radius:16px;margin:16px auto;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:white;box-shadow:0 4px 15px rgba(14,165,233,0.3);">${tenantName.charAt(0)}</div><h2 style="font-size:18px;font-weight:900;color:white;margin-top:14px;letter-spacing:-0.3px;">${tenantName}</h2>`;
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: plan === 'enterprise' ? '#f59e0b' : '#38bdf8', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{plan}</span>
              <button onClick={refreshMenus} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><RefreshCw size={12} /></button>
            </div>
          </div>
        </div>

        <nav className="nav-container" style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {ungroupped.map((menu, idx) => (
            <SidebarLink key={idx} to={menu.path} icon={Icons[menu.icon] || LayoutDashboard} label={menu.label} />
          ))}

          {groups.map((group) => group.items.length > 0 && (
            <div key={group.id} style={{ marginBottom: '8px' }}>
              <button 
                onClick={() => toggleGroup(group.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'none', border: 'none', color: openGroup === group.id ? 'white' : 'var(--sidebar-text, #94a3b8)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, borderRadius: '10px' }}
              >
                <group.icon size={18} style={{ opacity: openGroup === group.id ? 1 : 0.5 }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{group.title}</span>
                <ChevronDown size={14} style={{ transform: openGroup === group.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
              </button>
              
              <div style={{ maxHeight: openGroup === group.id ? '1000px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease-out', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '18px' }}>
                {group.items.map((menu, mIdx) => (
                  <SidebarLink key={mIdx} to={menu.path} icon={Icons[menu.icon] || Box} label={menu.label} isSubItem />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
            <span>Powered by</span>
            <span style={{ 
              fontWeight: 800, 
              fontFamily: "'Outfit', sans-serif",
              background: 'linear-gradient(135deg, #38bdf8 0%, #0da58e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.5px'
            }}>Cybelinx</span>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={18} color="#0ea5e9" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Nexus Secured</div>
              <div style={{ fontSize: '10px', color: '#94b8d4' }}>v2.4.0 Build 102</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .nav-container {
          overflow-x: hidden;
          scrollbar-width: thin;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          color: var(--sidebar-text, #94a3b8);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 4px;
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
        }
        .nav-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .nav-item:hover { 
          background: rgba(255, 255, 255, 0.06); 
          color: white; 
          border-color: rgba(255, 255, 255, 0.03);
          transform: translateX(4px);
        }
        .nav-item.active {
          background: linear-gradient(135deg, rgba(0, 86, 168, 0.25) 0%, rgba(0, 86, 168, 0.08) 100%);
          color: #7ec4ff;
          border-color: rgba(0, 120, 255, 0.3);
          box-shadow: 0 4px 15px rgba(0, 86, 168, 0.15);
        }
        .nav-item.active::after {
          content: "";
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          background: #0078FF;
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 10px #0078FF;
        }
      `}</style>
      <style>{`
        /* Make main content shrink correctly inside flex containers */
        .main-content { min-width: 0; }

        /* Mobile / tablet: make sidebar off-canvas and show overlay when active */
        @media (max-width: 1023px) {
          .sidebar {
            position: fixed !important;
            left: -320px;
            top: 0;
            height: 100vh !important;
            z-index: 1002;
            transition: left 0.25s ease;
            box-shadow: 2px 0 10px rgba(2,6,23,0.12);
          }
          .sidebar.mobile-open { left: 0 !important; }

          .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 1001;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
          }
          .mobile-overlay.active { opacity: 1; pointer-events: auto; }

          /* Prevent horizontal scrolling caused by children min-widths */
          body { overflow-x: hidden; }
        }
      `}</style>
    </>
  );
}

function SidebarLink({ to, icon: Icon, label, isSubItem }: { to: string, icon: any, label: string, isSubItem?: boolean }) {
  const location = useLocation();
  const isActive = useMemo(() => {
    const [path, query] = to.split('?');
    const matchesPath = location.pathname === path;
    if (!query) return matchesPath && (location.search === "" || location.search === "?");
    const searchParams = new URLSearchParams(location.search);
    const [key, val] = query.split('=');
    return matchesPath && searchParams.get(key) === val;
  }, [location, to]);

  return (
    <NavLink to={to} className={() => `nav-item${isActive ? ' active' : ''}${isSubItem ? ' sub-item' : ''}`}>
      <Icon size={isSubItem ? 15 : 18} />
      <span style={{ flex: 1, lineHeight: '1.4' }}>{label}</span>
    </NavLink>
  );
}
