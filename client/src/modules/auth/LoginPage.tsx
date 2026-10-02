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
    const fallbackFacilities = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Demo Hospital One', domain: 'demo-one' },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Demo Hospital Two', domain: 'demo-two' }
    ];

    axios.get(`${API_BASE}/api/nexus/tenants/public`).then(res => {
      const list: any[] = res.data;
      const finalList = list && list.length ? list : fallbackFacilities;
      setFacilities(finalList);
      const subdomain = getSubdomain();
      if (subdomain) {
        const matched = finalList.find(f => f.domain === subdomain);
        if (matched) {
          setFacility(matched.id);
          setDomainFacility(matched.id);
          setDomainName(matched.name);
        }
      }
    }).catch(() => {
      setFacilities(fallbackFacilities);
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
    <div className="login-bg" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes gradientBG {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-bg {
          background: radial-gradient(circle at top right, #e2e8f0, #f8fafc, #e2e8f0);
          background-size: 200% 200%;
          animation: gradientBG 15s ease infinite;
        }
        .login-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .left-panel {
          background: linear-gradient(135deg, #003870, #0056A3, #003870);
          background-size: 300% 300%;
          animation: gradientBG 12s ease infinite;
          position: relative;
          overflow: hidden;
        }
        .glass-input {
          background: #ffffff !important;
          border: 1px solid rgba(0, 86, 163, 0.15) !important;
          color: #0f172a !important;
          transition: all 0.3s ease;
        }
        .glass-input:focus {
          border-color: #0056A3 !important;
          box-shadow: 0 0 0 4px rgba(0, 86, 163, 0.1) !important;
          outline: none;
        }
        .glass-input::placeholder {
          color: #94a3b8 !important;
        }
        .login-btn {
          background: linear-gradient(135deg, #0056A3, #003870);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .login-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: skewX(-20deg);
          transition: all 0.5s ease;
        }
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 86, 163, 0.3);
        }
        .login-btn:hover::after {
          left: 150%;
        }
        .floating-shape-light {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          z-index: 0;
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
      
      {/* Decorative floating shapes */}
      <div className="floating-shape-light" style={{ width: '300px', height: '300px', background: 'rgba(76, 175, 80, 0.15)', top: '-50px', right: '10%' }} />
      <div className="floating-shape-light" style={{ width: '400px', height: '400px', background: 'rgba(0, 86, 163, 0.1)', bottom: '-100px', left: '10%', animationDelay: '-5s' }} />

      <div className="login-card" style={{ 
        width: isMobile ? '90%' : '1040px', 
        maxWidth: '1040px',
        minHeight: '640px',
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        borderRadius: isMobile ? '24px' : '32px', 
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Left Side Branding */}
        {!isMobile && (
          <div className="left-panel" style={{ 
            flex: 1.1, 
            padding: '60px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, pointerEvents: 'none', background: 'radial-gradient(circle, #fff 10%, transparent 10%)', backgroundSize: '20px 20px' }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ marginBottom: '40px' }}>
               <BrandLogo size="xxl" light={true} />
            </div>
              <h1 style={{ color: 'white', fontSize: '48px', fontWeight: 900, lineHeight: 1.1, marginBottom: '24px', fontFamily: "'Poppins', sans-serif" }}>
                Precision Care <br/>
                <span style={{ background: 'linear-gradient(135deg, #4CAF50, #0078FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Intelligence Platform.</span>
              </h1>
              <p style={{ color: '#e2e8f0', fontSize: '18px', lineHeight: 1.6, marginBottom: '48px', maxWidth: '400px' }}>
                Empowering healthcare providers with modern EMR solutions and unified orchestration.
              </p>
              <div style={{ display: 'flex', gap: '20px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '12px', fontWeight: 700 }}>
                    <div style={{ width: '6px', height: '6px', background: '#4CAF50', borderRadius: '50%', boxShadow: '0 0 10px #4CAF50' }}></div>
                    HIPAA COMPLIANT
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '12px', fontWeight: 700 }}>
                    <div style={{ width: '6px', height: '6px', background: '#0078FF', borderRadius: '50%', boxShadow: '0 0 10px #0078FF' }}></div>
                    SOC 2 CERTIFIED
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Side Login Form */}
        <div style={{ 
          flex: 1,
          padding: isMobile ? '40px 24px' : '60px 40px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          background: 'white'
        }}>
          {isMobile && (
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
              <BrandLogo size="xl" />
            </div>
          )}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Welcome Back</h2>
            <p style={{ color: '#64748b', fontSize: '15px' }}>Sign in to access your secure workspace</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Workspace Type</label>
              <select 
                value={type} 
                onChange={(e: any) => setType(e.target.value)}
                className="glass-input"
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', fontWeight: 600, appearance: 'none' }}
              >
                <option value="tenant">Hospital Facility</option>
                <option value="nexus">Nexus Administration</option>
              </select>
            </div>

            {type === "tenant" && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Select Hospital</label>
                {domainFacility && domainName ? (
                  <div style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '2px solid #4CAF50', background: '#f0fdf4', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#4CAF50', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>✓</div>
                    {domainName}
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b' }}>via domain</span>
                  </div>
                ) : (
                  <select 
                    required
                    value={facility} 
                    onChange={(e) => setFacility(e.target.value)}
                    className="glass-input"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', fontWeight: 600, appearance: 'none' }}
                  >
                    <option value="">Choose your facility...</option>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}{f.domain ? ` (${f.domain})` : ''}</option>)}
                  </select>
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                {type === "nexus" ? "Username" : "Email Address"}
              </label>
              <input 
                required
                type={type === "nexus" ? "text" : "email"} 
                placeholder={type === "nexus" ? "nexusadmin" : "name@hospital.com"} 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="glass-input"
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', fontWeight: 600 }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Password</label>
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', color: '#0056A3', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input 
                required
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="glass-input"
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', fontWeight: 600, letterSpacing: showPassword ? 'normal' : '2px' }}
              />
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '10px', marginTop: '10px' }}>{error}</div>}

            <button 
              type="submit" 
              disabled={loading}
              className="login-btn"
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '12px', 
                color: 'white', 
                border: 'none', 
                fontWeight: 800, 
                fontSize: '15px', 
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                marginTop: '10px'
              }}
            >
              {loading ? "AUTHENTICATING..." : "SIGN IN"}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
               <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>POWERED BY <span style={{ color: '#4CAF50', fontWeight: 900 }}>CYBELINX</span></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
