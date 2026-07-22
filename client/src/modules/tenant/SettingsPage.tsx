import { useState } from "react";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { API_BASE_URL as API_BASE } from "../../config/api";
import { applyTheme as applyThemeUtil, getNamespacedItem, setNamespacedItem } from "../../config/theme";

export default function SettingsPage() {
  const [hospitalName, setHospitalName] = useState(getNamespacedItem('tenantName') || localStorage.getItem('tenantName') || 'Palmtree Wellness Hospital');
  const [primaryDark, setPrimaryDark] = useState(getNamespacedItem('theme_primary_dark') || '#0f172a');
  const [primaryAccent, setPrimaryAccent] = useState(getNamespacedItem('theme_primary_accent') || '#6366f1');
  const [appBg, setAppBg] = useState(getNamespacedItem('theme_app_bg') || '#f4f6fa');
  const [textMain, setTextMain] = useState(getNamespacedItem('theme_text_main') || '#0f172a');
  const [sidebarText, setSidebarText] = useState(getNamespacedItem('theme_sidebar_text') || '#94a3b8');
  const [fontSize, setFontSize] = useState(getNamespacedItem('theme_font_size') || '14');
  const [logoUrl, setLogoUrl] = useState(getNamespacedItem('theme_logo_url') || '');
  
  // Hero Settings
  const [heroBg, setHeroBg] = useState(getNamespacedItem('theme_hero_bg') || localStorage.getItem('theme_hero_bg') || 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)');
  const [heroText, setHeroText] = useState(getNamespacedItem('theme_hero_text') || localStorage.getItem('theme_hero_text') || '#ffffff');

  const applyTheme = async () => {
    const tenantId = localStorage.getItem('tenant');
    if (tenantId) {
       try {
         await axios.put(`${API_BASE}/api/nexus/tenants/${tenantId}/branding`, {
           hospitalName, primaryDark, primaryAccent, appBg, textMain, fontSize, logoUrl, heroBg, heroText, sidebarText
         }, {
           headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
         });
       } catch (err) {
         console.error("Failed to sync branding to server:", err);
       }
    }
    setNamespacedItem('tenantName', hospitalName);
    setNamespacedItem('theme_primary_dark', primaryDark);
    setNamespacedItem('theme_primary_accent', primaryAccent);
    setNamespacedItem('theme_app_bg', appBg);
    setNamespacedItem('theme_text_main', textMain);
    setNamespacedItem('theme_sidebar_text', sidebarText);
    setNamespacedItem('theme_font_size', fontSize);
    setNamespacedItem('theme_logo_url', logoUrl);
    setNamespacedItem('theme_hero_bg', heroBg);
    setNamespacedItem('theme_hero_text', heroText);
    
    // Apply theme globally using utility
    applyThemeUtil();
    
    alert("Branding settings saved! Please refresh the page to see the full effect.");
    window.location.reload(); // Refresh to update name everywhere
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Hospital Branding & UI" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '32px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--app-bg)', color: '#0f172a', display: 'grid', placeItems: 'center', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Interface Preferences</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Customize the hospital branding, color palettes, and typography to align with your institution's identity.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
          <div className="form-card">
            <h3 style={{ marginBottom: '20px', fontWeight: 800 }}>General Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="field-label">Hospital Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={hospitalName} 
                  onChange={(e) => setHospitalName(e.target.value)} 
                />
              </div>
              <div>
                <label className="field-label">Custom Logo URL</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/logo.png"
                  className="input-field" 
                  value={logoUrl} 
                  onChange={(e) => setLogoUrl(e.target.value)} 
                />
              </div>
              <div>
                <label className="field-label">Base Font Size (px)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={fontSize} 
                  onChange={(e) => setFontSize(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="form-card">
            <h3 style={{ marginBottom: '20px', fontWeight: 800 }}>Theme Colors</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ColorPicker label="Sidebar / Primary Dark" value={primaryDark} onChange={setPrimaryDark} />
              <ColorPicker label="Sidebar Text Color" value={sidebarText} onChange={setSidebarText} />
              <ColorPicker label="Accent / Primary Highlight" value={primaryAccent} onChange={setPrimaryAccent} />
              <ColorPicker label="Application Background" value={appBg} onChange={setAppBg} />
              <ColorPicker label="Main Text Color" value={textMain} onChange={setTextMain} />
            </div>
          </div>

          <div className="form-card" style={{ gridColumn: 'span 2' }}>
            <h3 style={{ marginBottom: '20px', fontWeight: 800 }}>Hero & Dashboard Cards Appearance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <ColorPicker label="Hero Background" value={heroBg} onChange={setHeroBg} />
              <ColorPicker label="Hero Text Color" value={heroText} onChange={setHeroText} />
            </div>
          </div>
        </div>

        <div style={{ padding: '0 24px 40px', display: 'flex', gap: '16px' }}>
          <button className="button-primary" onClick={applyTheme} style={{ padding: '12px 40px' }}>Save & Apply Changes</button>
        </div>
      </main>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <label className="field-label" style={{ marginBottom: 0 }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input 
          type="color" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          style={{ width: '40px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} 
        />
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          style={{ width: '80px', fontSize: '12px', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px' }} 
        />
      </div>
    </div>
  );
}
