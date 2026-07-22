import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../../components/BrandLogo";
import { API_BASE_URL as API_BASE } from "../../config/api";
import { applyTheme, setNamespacedItem } from "../../config/theme";

const RESERVED_SUBDOMAINS = ['dev', 'staging', 'stage', 'test', 'www', 'api', 'app', 'mail', 'admin', 'support', 'help', 'docs', 'status', 'uat', 'qa'];

function getSubdomain(): string | null {
  const host = window.location.hostname;
  if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1")) return null;
  const parts = host.split(".");
  if (parts.length >= 3 && !parts[0].startsWith("www") && !RESERVED_SUBDOMAINS.includes(parts[0])) return parts[0];
  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<"nexus" | "tenant">("tenant");
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facility, setFacility] = useState("");
  const [domainFacility, setDomainFacility] = useState<string | null>(null);
  const [domainName, setDomainName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/api/nexus/tenants/public`).then(res => {
      const list: any[] = res.data;
      setFacilities(list);
      const subdomain = getSubdomain();
      if (subdomain) {
        const matched = list.find(f => f.domain === subdomain);
        if (matched) {
          setFacility(matched.id);
          setDomainFacility(matched.id);
          setDomainName(matched.name);
        }
      }
    });
  }, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const landingPage = type === "nexus" ? "/nexus/dashboard" : "/tenant/dashboard";
      const { data } = await axios.post(`${API_BASE}/api/auth/login`, {
        email, password, type, facility, landingPage
      });
      
      localStorage.setItem("token", data.token);
      localStorage.setItem("tenant", data.tenantId);
      localStorage.setItem("tenantName", data.tenantName || "Palmtree Wellness Hospital");
      localStorage.setItem("tenantPlan", data.tenantPlan || "basic");
      localStorage.setItem("landingPage", data.landingPage);
      localStorage.setItem("userType", data.type);
      localStorage.setItem("role", data.role || "");
      localStorage.setItem("userName", data.userName || "User");
      localStorage.setItem("userId", data.userId || "");
      
      // Save dynamic RBAC data
      localStorage.setItem("userMenus", JSON.stringify(data.menus || []));
      localStorage.setItem("userPermissions", JSON.stringify(data.permissions || []));
      
      // Save branding configuration (namespaced per-tenant)
      if (data.uiSettings) {
        if (data.uiSettings.primaryDark) setNamespacedItem('theme_primary_dark', data.uiSettings.primaryDark);
        if (data.uiSettings.primaryAccent) setNamespacedItem('theme_primary_accent', data.uiSettings.primaryAccent);
        if (data.uiSettings.appBg) setNamespacedItem('theme_app_bg', data.uiSettings.appBg);
        if (data.uiSettings.textMain) setNamespacedItem('theme_text_main', data.uiSettings.textMain);
        if (data.uiSettings.fontSize) setNamespacedItem('theme_font_size', data.uiSettings.fontSize);
        if (data.uiSettings.logoUrl) setNamespacedItem('theme_logo_url', data.uiSettings.logoUrl);
        if (data.uiSettings.heroBg) setNamespacedItem('theme_hero_bg', data.uiSettings.heroBg);
        if (data.uiSettings.heroText) setNamespacedItem('theme_hero_text', data.uiSettings.heroText);
        if (data.uiSettings.sidebarText) setNamespacedItem('theme_sidebar_text', data.uiSettings.sidebarText);
      }

      // Apply theme immediately after saving to localStorage
      applyTheme();

      navigate(data.landingPage);
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ 
        width: isMobile ? '90%' : '1040px', 
        maxWidth: '1040px',
        height: isMobile ? 'auto' : '640px',
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        background: 'white', 
        borderRadius: isMobile ? '24px' : '32px', 
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
        margin: isMobile ? '20px 0' : '0'
      }}>
        {!isMobile && (
          <div style={{ 
            flex: 1, 
            background: 'linear-gradient(135deg, #003870 0%, #0056A8 100%)', 
            padding: '60px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle Background Pattern */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, pointerEvents: 'none' }}>
              <svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ marginBottom: '40px' }}>
                 <BrandLogo size="md" light={true} />
              </div>

              <h1 style={{ color: 'white', fontSize: '48px', fontWeight: 900, lineHeight: 1.1, marginBottom: '24px', fontFamily: "'Poppins', sans-serif" }}>
                Precision Care <br/>
                <span style={{ background: 'linear-gradient(135deg, #00C897, #0078FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Intelligence Platform.</span>
              </h1>
              
              <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: 1.6, marginBottom: '48px', maxWidth: '400px' }}>
                Empowering healthcare providers with modern EMR solutions and unified hospital orchestration.
              </p>

              <div style={{ display: 'flex', gap: '20px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94b8d4', fontSize: '12px', fontWeight: 700 }}>
                    <div style={{ width: '6px', height: '6px', background: '#00C897', borderRadius: '50%' }}></div>
                    HIPAA COMPLIANT
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94b8d4', fontSize: '12px', fontWeight: 700 }}>
                    <div style={{ width: '6px', height: '6px', background: '#0078FF', borderRadius: '50%' }}></div>
                    SOC 2 CERTIFIED
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: Login Form */}
        <div style={{ 
          width: isMobile ? '100%' : '480px', 
          padding: isMobile ? '40px 24px' : '60px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center' 
        }}>
          {isMobile && (
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
              <BrandLogo size="md" />
            </div>
          )}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Welcome Back</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Sign in to access your healthcare workspace</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Workspace Type</label>
              <select 
                value={type} 
                onChange={(e: any) => setType(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: 'var(--app-bg)', fontWeight: 600, outline: 'none' }}
              >
                <option value="tenant">Hospital Facility</option>
                <option value="nexus">Nexus Administration</option>
              </select>
            </div>

            {type === "tenant" && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Select Hospital</label>
                {domainFacility && domainName ? (
                  <div style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #0d9488', background: '#f0fdfa', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#0d9488', fontSize: '14px' }}>&#10003;</span>
                    {domainName}
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b' }}>via domain</span>
                  </div>
                ) : (
                  <select 
                    required
                    value={facility} 
                    onChange={(e) => setFacility(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: 'var(--app-bg)', fontWeight: 600, outline: 'none' }}
                  >
                    <option value="">Choose your facility...</option>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}{f.domain ? ` (${f.domain})` : ''}</option>)}
                  </select>
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Email Address</label>
              <input 
                required
                type="email" 
                placeholder="name@hospital.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: 'var(--app-bg)', fontWeight: 600, outline: 'none' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Password</label>
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input 
                required
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: 'var(--app-bg)', fontWeight: 600, outline: 'none' }}
              />
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '10px' }}>{error}</div>}

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '14px', 
                background: 'linear-gradient(135deg, #0056A8 0%, #003870 100%)', 
                color: 'white', 
                border: 'none', 
                fontWeight: 800, 
                fontSize: '16px', 
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 14px rgba(0, 86, 168, 0.35)',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              {loading ? "AUTHENTICATING..." : "SIGN IN TO WORKSPACE"}
            </button>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
               <p style={{ fontSize: '12px', color: '#94b8d4', fontWeight: 600 }}>POWERED BY <span style={{ color: '#00C897', fontWeight: 900 }}>CYBELINX</span></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
