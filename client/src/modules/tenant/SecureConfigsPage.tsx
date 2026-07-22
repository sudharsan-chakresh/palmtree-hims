import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { API_BASE_URL as API_BASE } from "../../config/api";

export default function SecureConfigsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/hospital/configs`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        setSettings(res.data.settings || {});
      } catch (e) { console.error(e); setMessage('Failed to load settings'); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    try {
      await axios.put(`${API_BASE}/api/hospital/configs`, settings, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setMessage('Saved');
    } catch (e) { console.error(e); setMessage('Save failed'); }
  };

  const update = (key: string, val: any) => setSettings((s: any) => ({ ...s, [key]: val }));

  if (loading) return (
    <div className="dashboard-layout"><Sidebar /><main className="main-content"><Header title="Tenant Sensitive Configs" /><div style={{padding:24}}>Loading...</div></main></div>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Tenant Sensitive Configs" />

        <div style={{ padding: 24 }}>
          <p style={{ color: '#475569' }}>These settings are stored in the tenant shard and used preferentially. If blank, Nexus global settings will be used as fallback.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-card">
              <h4>ABHA / ABDM</h4>
              <label className="field-label">ABHA Client ID</label>
              <input className="input-field" value={settings.ABHA_CLIENT_ID || ''} onChange={(e) => update('ABHA_CLIENT_ID', e.target.value)} />
              <label className="field-label">ABHA Client Secret</label>
              <input className="input-field" value={settings.ABHA_CLIENT_SECRET || ''} onChange={(e) => update('ABHA_CLIENT_SECRET', e.target.value)} />
              <label className="field-label">ABHA Gateway URL</label>
              <input className="input-field" value={settings.ABHA_GATEWAY_URL || ''} onChange={(e) => update('ABHA_GATEWAY_URL', e.target.value)} />
            </div>

            <div className="form-card">
              <h4>AI Engine</h4>
              <label className="field-label">AI Engine API Key</label>
              <input className="input-field" value={settings.AI_API_KEY || ''} onChange={(e) => update('AI_API_KEY', e.target.value)} />
              <label className="field-label">AI Engine Secret</label>
              <input className="input-field" value={settings.AI_API_SECRET || ''} onChange={(e) => update('AI_API_SECRET', e.target.value)} />
              <label className="field-label">AI Provider (e.g., gemini, openai)</label>
              <input className="input-field" value={settings.AI_PROVIDER || ''} onChange={(e) => update('AI_PROVIDER', e.target.value)} />
            </div>

            <div className="form-card">
              <h4>Email / SMTP</h4>
              <label className="field-label">SMTP Host</label>
              <input className="input-field" value={settings.SMTP_HOST || ''} onChange={(e) => update('SMTP_HOST', e.target.value)} />
              <label className="field-label">SMTP Port</label>
              <input className="input-field" value={settings.SMTP_PORT || ''} onChange={(e) => update('SMTP_PORT', e.target.value)} />
              <label className="field-label">SMTP User</label>
              <input className="input-field" value={settings.SMTP_USER || ''} onChange={(e) => update('SMTP_USER', e.target.value)} />
              <label className="field-label">SMTP Password</label>
              <input type="password" className="input-field" value={settings.SMTP_PASS || ''} onChange={(e) => update('SMTP_PASS', e.target.value)} />
            </div>

            <div className="form-card">
              <h4>Resend / Supabase</h4>
              <label className="field-label">Resend API Key</label>
              <input className="input-field" value={settings.RESEND_API_KEY || ''} onChange={(e) => update('RESEND_API_KEY', e.target.value)} />
              <label className="field-label">Supabase URL</label>
              <input className="input-field" value={settings.SUPABASE_URL || ''} onChange={(e) => update('SUPABASE_URL', e.target.value)} />
              <label className="field-label">Supabase Key</label>
              <input className="input-field" value={settings.SUPABASE_KEY || ''} onChange={(e) => update('SUPABASE_KEY', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button className="button-primary" onClick={save}>Save Tenant Settings</button>
            <div style={{ alignSelf: 'center', color: message === 'Saved' ? '#10b981' : '#ef4444' }}>{message}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
