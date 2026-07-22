import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';
import {
  Shield, ArrowLeftRight, BookOpen, Lock, Monitor, Bed, Pill, CreditCard,
  Mic, Sparkles, Activity, CheckCircle, Watch, Fingerprint, Brain,
  ArrowRight, QrCode, Mail, Phone, Smartphone, Download, Star,
  Zap, Globe, Clock, HeartPulse, FileText, MessageSquare
} from 'lucide-react';

// ─── Global CSS injected once ─────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.4; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-10px); }
  }
  @keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }

  .hero-gradient-text {
    background: linear-gradient(135deg, #1e40af 0%, #0891b2 40%, #0d9488 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 4s linear infinite;
  }

  .btn-primary {
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(37, 99, 235, 0.35) !important; }
  .btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.12);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .btn-primary:hover::after { opacity: 1; }

  .btn-ghost {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .btn-ghost:hover { transform: translateY(-2px); background: #f1f5f9 !important; }

  .nav-link {
    position: relative;
    transition: color 0.2s;
  }
  .nav-link::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 2px;
    background: #0078FF;
    border-radius: 999px;
    transition: width 0.25s;
  }
  .nav-link:hover::after { width: 100%; }

  .feature-card {
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: default;
  }
  .feature-card:hover { transform: translateY(-6px); box-shadow: 0 32px 64px rgba(0,0,0,0.1) !important; }

  .bento-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .bento-card:hover { transform: translateY(-4px); }

  .price-card {
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .price-card:hover { transform: translateY(-8px); }

  .stat-counter {
    animation: countUp 0.6s ease both;
  }

  .tab-btn {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .contact-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .contact-card:hover { transform: translateY(-4px); }

  .hero-mockup {
    animation: float 6s ease-in-out infinite;
  }

  .section-fade {
    animation: fadeInUp 0.7s ease both;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  .price-link {
    transition: all 0.25s ease-in-out;
  }
  .price-link:hover {
    color: #4f46e5 !important;
    text-decoration: underline !important;
  }
`;

// ─── Unused icon maps & count up hook removed to fix compiler warnings ───────

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'opd'|'ipd'|'pharmacy'|'billing'>('opd');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll); };
  }, []);

  const tabData = {
    opd: {
      label: 'OPD Console',
      icon: Monitor,
      title: 'AI-Powered Doctor EMR Console',
      desc: 'Consultation logs in under 45 seconds. Specialty templates, SNOMED CT, ICD-11 — all at your fingertips.',
      features: ['Specialty-specific templates (Pediatrics, Cardio, Gynac)', 'Integrated SNOMED CT & ICD-11 terminology search', 'Instant e-prescriptions with WhatsApp/SMS sharing', 'Bedside order entry for diagnostics & pharmacy'],
      color: '#0078FF',
      mockup: (
        <div style={{ background: '#0a0f1e', borderRadius: '16px', padding: '20px', color: 'white', fontSize: '11px', border: '1px solid #1e3a5f', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #0078FF, #0891b2, #0078FF)', backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: '9px', color: '#4b6a8b', marginLeft: '8px', fontFamily: 'monospace' }}>EMR v3.1 · OPD_ACTIVE</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ background: 'rgba(0,120,255,0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, border: '1px solid rgba(0,120,255,0.3)' }}>Vitals ✓</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                <Sparkles style={{ width: '8px', height: '8px', color: '#a78bfa' }} />
                <span style={{ fontSize: '8px', color: '#a78bfa', fontWeight: 700 }}>AI Scribe ON</span>
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', border: '1px solid #1e293b', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '12px' }}>Mrs. Deepika Sharma</div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>28F · ABHA: 1234-5678-9012 · OPD #48201</div>
            </div>
            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>Active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '6px', marginBottom: '12px' }}>
            {[['Temp', '98.6°F', '#34d399'], ['BP', '120/80', '#60a5fa'], ['SpO₂', '98%', '#34d399'], ['Pulse', '72 bpm', '#f59e0b']].map(([label, val, col]) => (
              <div key={label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: col as string }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#020617', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '8px' }}>
            <div style={{ fontSize: '8px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.8px' }}>Chief Complaints</div>
            <p style={{ color: '#94a3b8', fontSize: '9px', margin: 0, lineHeight: 1.5 }}>Mild temporal headache × 3 days. Non-throbbing, no aura.</p>
          </div>
          <div style={{ background: '#020617', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '8px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Prescription (Rx)</span><span style={{ color: '#475569', fontSize: '7px' }}>ICD-11: 8A80.0</span>
            </div>
            {[['Tab Paracetamol 650mg', '1-0-1 After Meals'], ['Tab Pantoprazole 40mg', '1-0-0 Empty Stomach']].map(([drug, sig]) => (
              <div key={drug} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #0f172a', fontSize: '9px' }}>
                <span style={{ color: '#cbd5e1' }}>{drug}</span>
                <span style={{ color: '#64748b' }}>{sig}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    ipd: {
      label: 'IPD / Beds',
      icon: Bed,
      title: 'Real-Time Bed Occupancy & Ward Desk',
      desc: 'Bird\'s-eye clarity on every ward. Track ICU, general, and private beds with discharge predictions.',
      features: ['Visual map of all general, private & ICU beds', 'AI discharge predictor with recovery timelines', 'Direct link to billing on transfer or discharge', 'Nurse station callboards synced with orders'],
      color: '#00C897',
      mockup: (
        <div style={{ background: '#0a0f1e', borderRadius: '16px', padding: '20px', color: 'white', fontSize: '11px', border: '1px solid #2d1f5e', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #00C897, #a78bfa, #00C897)', backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e1b4b', paddingBottom: '12px', marginBottom: '16px' }}>
            <h4 style={{ fontWeight: 800, color: '#e2e8f0', margin: 0, fontSize: '12px' }}>ICU & PRIVATE WARD A</h4>
            <span style={{ background: 'rgba(0, 200, 151,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, border: '1px solid rgba(0, 200, 151,0.3)' }}>82% Occupied</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '8px', marginBottom: '14px' }}>
            {[['Bed 1', 'Deepika', '#34d399', 'rgba(16,185,129,0.1)', 'rgba(16,185,129,0.25)'],
              ['Bed 2', 'Karan', '#f87171', 'rgba(239,68,68,0.1)', 'rgba(239,68,68,0.25)'],
              ['Bed 3', 'Vacant', '#64748b', '#0f172a', '#1e293b'],
              ['Bed 4', 'Raut', '#34d399', 'rgba(16,185,129,0.1)', 'rgba(16,185,129,0.25)']
            ].map(([bed, name, col, bg, border]) => (
              <div key={bed} style={{ background: bg as string, border: `1px solid ${border}`, padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: col as string, fontSize: '10px' }}>{bed}</div>
                <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>{name}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#020617', padding: '12px', borderRadius: '8px', border: '1px solid #1e1b4b' }}>
            <div style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '8px' }}>AI Discharge Predictions</div>
            {[['Bed 1 · Deepika', 'Discharge in 4h', '#fbbf24'], ['Bed 4 · Raut', 'Stable, 2 days', '#60a5fa']].map(([name, pred, col]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '4px 0', borderBottom: '1px solid #0f172a' }}>
                <span style={{ color: '#cbd5e1' }}>{name}</span>
                <span style={{ color: col as string, fontWeight: 600 }}>{pred}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    pharmacy: {
      label: 'Pharmacy & Lab',
      icon: Pill,
      title: 'Integrated Pharmacy & Specimen Lab',
      desc: 'Prescription orders flow to pharmacy instantly. Diagnostics tracked with barcodes to the lab bench.',
      features: ['Real-time inventory counts and batch tracking', 'Barcoded specimen tracking with ABHA identity', 'Digitally signed diagnostic reports with QR codes', 'Low inventory alerts & auto purchase orders'],
      color: '#059669',
      mockup: (
        <div style={{ background: '#0a0f1e', borderRadius: '16px', padding: '20px', color: 'white', fontSize: '11px', border: '1px solid #064e3b', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #059669, #34d399, #059669)', backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #064e3b', paddingBottom: '12px', marginBottom: '14px' }}>
            <h4 style={{ fontWeight: 800, color: '#e2e8f0', margin: 0, fontSize: '12px' }}>DISPENSARY QUEUE</h4>
            <span style={{ background: 'rgba(5,150,105,0.2)', color: '#34d399', padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, border: '1px solid rgba(5,150,105,0.3)' }}>4 Orders Pending</span>
          </div>
          {[['Rx-8902 · Deepika', 'Paracetamol 650mg × 10', 'In Stock', '#34d399', 'rgba(16,185,129,0.1)'],
            ['Rx-8901 · Karan', 'Amoxicillin 500mg × 15', 'Low Stock (5)', '#f87171', 'rgba(239,68,68,0.08)'],
            ['Rx-8900 · Priya', 'Metformin 500mg × 30', 'In Stock', '#34d399', 'rgba(16,185,129,0.1)']
          ].map(([rx, drug, status, col, bg]) => (
            <div key={rx} style={{ background: bg as string, border: `1px solid ${col}30`, padding: '10px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '10px' }}>{rx}</div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>{drug}</div>
              </div>
              <span style={{ color: col as string, fontSize: '9px', fontWeight: 700 }}>{status}</span>
            </div>
          ))}
        </div>
      )
    },
    billing: {
      label: 'Billing & Claims',
      icon: CreditCard,
      title: 'Unified Billing & Insurance Claims Hub',
      desc: 'One source of truth for OPD, IPD, pharmacy, and lab invoices. UPI-ready with TPA claim tracking.',
      features: ['Consolidated OPD & IPD invoice processing', 'Instant UPI QR generation & cashier verification', 'Third-Party Administrator (TPA) insurance logs', 'GST accounting tables & expense trackers'],
      color: '#d97706',
      mockup: (
        <div style={{ background: '#0a0f1e', borderRadius: '16px', padding: '20px', color: 'white', fontSize: '11px', border: '1px solid #451a03', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #d97706, #fbbf24, #d97706)', backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '14px' }}>
            <h4 style={{ fontWeight: 800, color: '#e2e8f0', margin: 0, fontSize: '12px' }}>STATEMENT #8023</h4>
            <span style={{ background: 'rgba(217,119,6,0.2)', color: '#fbbf24', padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, border: '1px solid rgba(217,119,6,0.3)' }}>Unpaid</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#cbd5e1', marginBottom: '12px' }}>
            <thead><tr style={{ borderBottom: '1px solid #1e293b', color: '#475569', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ paddingBottom: '6px', fontWeight: 600, textAlign: 'left' }}>Particular</th>
              <th style={{ paddingBottom: '6px', fontWeight: 600, textAlign: 'right' }}>Qty</th>
              <th style={{ paddingBottom: '6px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
            </tr></thead>
            <tbody>
              {[['OPD Consultation', '1', '₹500'], ['CBC Lab Panel', '1', '₹450'], ['Pharmacy Rx-8902', '1', '₹120']].map(([item, qty, amt]) => (
                <tr key={item}><td style={{ padding: '5px 0' }}>{item}</td><td style={{ textAlign: 'right', padding: '5px 0' }}>{qty}</td><td style={{ textAlign: 'right', color: '#34d399', padding: '5px 0' }}>{amt}</td></tr>
              ))}
              <tr style={{ borderTop: '1px solid #1e293b' }}>
                <td style={{ paddingTop: '8px', fontWeight: 700, color: '#e2e8f0' }}>Total Outstanding</td>
                <td /><td style={{ paddingTop: '8px', textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>₹1,070</td>
              </tr>
            </tbody>
          </table>
          <div style={{ background: '#020617', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: '9px', color: '#94a3b8' }}>UPI QR generated</div><div style={{ fontSize: '8px', color: '#475569' }}>Scan to collect payment</div></div>
            <QrCode style={{ color: '#fbbf24', width: '28px', height: '28px' }} />
          </div>
        </div>
      )
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: '#0f172a', overflowX: 'hidden' }}>

      {/* ── 1. NAVBAR ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        backgroundColor: '#ffffff',
        borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '0 24px'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '84px' }}>
          <BrandLogo size="lg" />

          {!isMobile && (
            <nav style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
              {[['#features', 'Features'], ['#ai-services', 'AI Engine'], ['#future', 'Roadmap'], ['#contact', 'Contact']].map(([href, label]) => (
                <a key={href} href={href} className="nav-link" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>{label}</a>
              ))}
              <a href="/Palmtree Wellness.apk" download="Palmtree Wellness.apk" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0078FF', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>
                <Smartphone style={{ width: '14px', height: '14px' }} /> Mobile App
              </a>
            </nav>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isMobile && (
              <button onClick={() => navigate('/login')} className="btn-ghost" style={{ padding: '9px 20px', borderRadius: '10px', background: 'transparent', color: '#475569', fontWeight: 600, fontSize: '14px', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}>
                Sign In
              </button>
            )}
            <button onClick={() => navigate('/login')} className="btn-primary" style={{ padding: '10px 22px', borderRadius: '10px', background: 'linear-gradient(135deg, #0056A8, #0078FF)', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,120,255,0.3)' }}>
              Access Portal
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. HERO ────────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: isMobile ? '80px 20px 60px' : '120px 24px 100px',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,120,255,0.1) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(8,145,178,0.07) 0%, transparent 50%), #ffffff'
      }}>
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#e2e8f015 1px, transparent 1px), linear-gradient(90deg, #e2e8f015 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '64px', position: 'relative' }}>
          {/* Left */}
          <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fadeInUp 0.8s ease both' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '8px', background: 'rgba(0,120,255,0.08)', border: '1px solid rgba(0,120,255,0.2)', padding: '6px 16px 6px 8px', borderRadius: '999px' }}>
              <span style={{ background: '#0078FF', color: 'white', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.5px' }}>NEW</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0056A8' }}>ABDM Certified · AI Scribe v2.0</span>
            </div>

            <h1 style={{ fontSize: isMobile ? '36px' : '60px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-2px', color: '#0f172a', margin: 0 }}>
              The Intelligent Engine<br />
              Powering Modern<br />
              <span style={{ background: 'linear-gradient(to right, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>Healthcare Excellence.</span>
            </h1>

            <p style={{ fontSize: isMobile ? '16px' : '18px', color: '#64748b', lineHeight: 1.7, maxWidth: '520px', margin: 0 }}>
              Bring OPD, IPD, Pharmacy, Labs, and Billing together in a seamless AI-driven ecosystem — engineered to handle the scale and speed of modern medical facilities.
            </p>

            {/* Trust badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {[['✓ ABDM Registered', '#dcfce7', '#16a34a'], ['✓ HIPAA Compliant', '#e0f2fe', '#0056A8'], ['✓ HL7 FHIR Ready', '#ccfbf1', '#00C897']].map(([label, bg, col]) => (
                <span key={label} style={{ background: bg, color: col, fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px' }}>{label}</span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => navigate('/login')} className="btn-primary" style={{ padding: '16px 28px', borderRadius: '14px', background: 'linear-gradient(135deg, #0056A8, #0078FF)', color: 'white', fontWeight: 800, fontSize: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,120,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                Access Portal <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* ── Mobile Download Buttons ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Download Mobile App</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {/* Android */}
                <a href="/Palmtree Wellness-Lite.apk" download="Palmtree Wellness-Lite.apk" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 700, fontSize: '13px', textDecoration: 'none', border: '1.5px solid #334155', transition: 'all 0.25s', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1e293b'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#0f172a'; }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#34d399"><path d="M17.523 15.341 14.8 12.618l2.723-2.723a.5.5 0 0 0-.707-.707L14.093 11.91 6.184 4H17a2 2 0 0 1 2 2v11.341a.5.5 0 0 0-.477.001zM4 5.657 12.436 14.1l-1.78 1.78a.5.5 0 0 0 .707.707l1.78-1.78 2.298 2.297A2 2 0 0 1 14 18H7a2 2 0 0 1-2-2V5.657zM3 6a2 2 0 0 1 .184-.84L5.66 7.636 3 10.293V6zm0 5.707 3.366-3.366 1.293 1.293L4.293 13H3v-1.293zm1.707 2l2.366-2.367 5.9 5.9H7a2 2 0 0 1-1.293-.477L4.707 13.707z"/></svg>
                  <div>
                    <div style={{ fontSize: '9px', color: '#64748b', lineHeight: 1 }}>GET IT ON</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.2 }}>Android APK (Lite)</div>
                  </div>
                  <Download style={{ width: '14px', height: '14px', color: '#475569', marginLeft: '4px' }} />
                </a>

                {/* iOS – Coming Soon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderRadius: '12px', background: 'var(--app-bg)', color: '#94a3b8', fontWeight: 700, fontSize: '13px', border: '1.5px dashed #e2e8f0', position: 'relative', cursor: 'not-allowed', opacity: 0.85 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#94a3b8"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <div>
                    <div style={{ fontSize: '9px', color: '#cbd5e1', lineHeight: 1 }}>COMING SOON</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.2, color: '#64748b' }}>App Store (iOS)</div>
                  </div>
                  <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#f59e0b', color: 'white', fontSize: '8px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', letterSpacing: '0.5px' }}>SOON</span>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex' }}>
                {['#4f46e5','#0891b2','#059669','#d97706'].map((col, i) => (
                  <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', background: col, border: '2px solid white', marginLeft: i ? '-8px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'white', fontWeight: 700 }}>{['Dr', 'Rx', 'Br', 'N'][i]}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(i => <Star key={i} style={{ width: '12px', height: '12px', color: '#f59e0b', fill: '#f59e0b' }} />)}</div>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Trusted by 500+ healthcare providers</span>
              </div>
            </div>
          </div>

          {/* Right – floating mockup */}
          <div style={{ flex: 1, position: 'relative', maxWidth: '520px', width: '100%', animation: 'fadeIn 1s ease 0.3s both' }}>
            <div className="hero-mockup">
              <div style={{ background: 'linear-gradient(145deg, #0f172a, #1e293b)', borderRadius: '24px', padding: '24px', border: '1px solid #334155', boxShadow: '0 40px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
                  {['#ef4444','#f59e0b','#22c55e'].map(c => <span key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, display: 'inline-block' }} />)}
                  <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', marginLeft: '8px' }}>Palmtree Wellness · Dashboard</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(0,120,255,0.15)', border: '1px solid rgba(0,120,255,0.3)', padding: '3px 10px', borderRadius: '999px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                    <span style={{ fontSize: '9px', color: '#34d399', fontWeight: 700 }}>Live</span>
                  </div>
                </div>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
                  {[['Today\'s OPD', '48', '#60a5fa', '+12%'], ['Beds Occupied', '82%', '#a78bfa', 'ICU: 90%'], ['Revenue', '₹2.4L', '#34d399', '+8% MoM']].map(([label, val, col, sub]) => (
                    <div key={label} style={{ background: '#0f172a', borderRadius: '12px', padding: '12px', border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: col }}>{val}</div>
                      <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{sub}</div>
                    </div>
                  ))}
                </div>
                {/* Appointment list */}
                <div style={{ background: '#0f172a', borderRadius: '12px', padding: '14px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '10px' }}>Upcoming OPD Queue</div>
                  {[['09:00', 'Mrs. Deepika S.', 'Cardiology', '#60a5fa'],
                    ['09:30', 'Mr. Kiran R.', 'Orthopedics', '#a78bfa'],
                    ['10:00', 'Ms. Priya M.', 'Gynecology', '#34d399'],
                  ].map(([time, name, dept, col]) => (
                    <div key={time} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #1e293b' }}>
                      <span style={{ fontSize: '9px', color: '#475569', fontFamily: 'monospace', flexShrink: 0 }}>{time}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#cbd5e1' }}>{name}</div>
                        <div style={{ fontSize: '8px', color: '#475569' }}>{dept}</div>
                      </div>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: col as string, flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div style={{ position: 'absolute', top: '-12px', right: '-12px', background: 'white', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 16px 32px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles style={{ width: '18px', height: '18px', color: '#00C897' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>AI Scribe Active</div>
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>98.2% accuracy</div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: '0px', left: '-16px', background: 'white', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 16px 32px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle style={{ width: '18px', height: '18px', color: '#059669' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>ABDM Verified</div>
                <div style={{ fontSize: '9px', color: '#94a3b8' }}>ABHA linked & synced</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. SOCIAL PROOF / STATS BAR ────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #e0e7ff 100%)', padding: '48px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <p style={{ fontSize: '13px', color: '#00C897', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Powering modern healthcare across India</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '2px' }}>
            {[
              { label: 'Consultations Logged', value: 2400000, suffix: '+', display: '2.4M+', icon: FileText, color: '#0078FF' },
              { label: 'Prescriptions Issued', value: 800000, suffix: '+', display: '800K+', icon: Pill, color: '#00C897' },
              { label: 'Hospitals Onboarded', value: 500, suffix: '+', display: '500+', icon: HeartPulse, color: '#059669' },
              { label: 'Avg Time Saved / Day', value: 3, suffix: 'h', display: '3h+', icon: Clock, color: '#d97706' }
            ].map(({ label, display, icon: Icon, color }, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '32px 20px', borderRight: i < 3 && !isMobile ? '1px solid #e2e8f0' : 'none' }}>
                <Icon style={{ width: '28px', height: '28px', color, margin: '0 auto 12px' }} />
                <div style={{ fontSize: isMobile ? '32px' : '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-1px', lineHeight: 1 }}>{display}</div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. STANDARDS / TRUST ───────────────────────────────────────────────── */}
      <section id="standards" style={{ padding: '100px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '56px' }}>
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#0078FF' }}>Built on Global Standards</span>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 900, color: '#0f172a', margin: '12px 0 16px', letterSpacing: '-1px' }}>Compliance isn't optional. It's foundational.</h2>
            <p style={{ color: '#64748b', fontSize: '16px', lineHeight: 1.7 }}>Every Palmtree Wellness module is architected against NHA, ABDM, HL7 FHIR, and international clinical governance frameworks.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: '20px' }}>
            {[
              { icon: Shield, label: 'NHA ABDM Certified', desc: 'Registered with Ayushman Bharat Digital Mission & ABHA ID creation', color: '#0078FF', bg: '#f0f9ff' },
              { icon: ArrowLeftRight, label: 'HL7 FHIR R4 APIs', desc: 'Interoperability with national health registries and partner labs', color: '#00C897', bg: '#f0fdfa' },
              { icon: BookOpen, label: 'SNOMED CT & ICD-11', desc: 'Clinical terminology standards for structured diagnosis coding', color: '#059669', bg: '#ecfdf5' },
              { icon: Lock, label: 'End-to-End Encryption', desc: 'AES-256 data-at-rest with TLS 1.3 in transit on all PHI records', color: '#dc2626', bg: '#fef2f2' }
            ].map(({ icon: Icon, label, desc, color, bg }) => (
              <div key={label} className="feature-card" style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ color, width: '22px', height: '22px' }} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px', margin: '0 0 6px' }}>{label}</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. INTERACTIVE FEATURE TABS ────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 24px', background: 'var(--app-bg)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00C897' }}>Platform Features</span>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 900, color: '#0f172a', margin: '12px 0 0', letterSpacing: '-1px' }}>Every module. One platform.</h2>
          </div>

          {/* Tab pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(Object.keys(tabData) as Array<keyof typeof tabData>).map(key => {
              const { label, icon: Icon, color } = tabData[key];
              const isActive = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)} className="tab-btn" style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', borderRadius: '12px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', border: 'none',
                  background: isActive ? color : 'white',
                  color: isActive ? 'white' : '#64748b',
                  boxShadow: isActive ? `0 8px 20px ${color}40` : '0 2px 8px rgba(0,0,0,0.06)',
                  transform: isActive ? 'scale(1.04)' : 'scale(1)'
                }}>
                  <Icon style={{ width: '15px', height: '15px' }} /> {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '48px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeInUp 0.4s ease both' }}>
              <div>
                <h3 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-0.5px' }}>{tabData[activeTab].title}</h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{tabData[activeTab].desc}</p>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tabData[activeTab].features.map((feat, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `${tabData[activeTab].color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <CheckCircle style={{ color: tabData[activeTab].color, width: '12px', height: '12px' }} />
                    </div>
                    <span style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>{feat}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/login')} className="btn-primary" style={{ alignSelf: 'flex-start', padding: '13px 24px', borderRadius: '12px', background: tabData[activeTab].color, color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: `0 8px 20px ${tabData[activeTab].color}40` }}>
                Explore {tabData[activeTab].label} <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}>{tabData[activeTab].mockup}</div>
          </div>
        </div>
      </section>

      {/* ── 6. BENTO GRID — AI FEATURES ────────────────────────────────────────── */}
      <section id="ai-services" style={{ padding: '100px 24px', background: 'linear-gradient(135deg, #f0f9ff 0%, #f0fdfa 50%, #faf5ff 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 200, 151, 0.08), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08), transparent)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '56px', position: 'relative' }}>
          <div style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00C897' }}>Powered by GenAI</span>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 900, color: '#0f172a', margin: '12px 0 16px', letterSpacing: '-1px' }}>Clinical AI that actually works.</h2>
            <p style={{ color: '#475569', fontSize: '16px', lineHeight: 1.7 }}>Not a chatbot. A purpose-built clinical intelligence layer trained on Indian medical workflows.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gridTemplateRows: 'auto', gap: '16px' }}>
            {/* Large card */}
            <div className="bento-card" style={{ gridColumn: isMobile ? '1' : '1 / 2', gridRow: '1 / 3', background: 'linear-gradient(145deg, #ffffff, #faf5ff)', border: '1px solid #edd9ff', borderRadius: '24px', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '280px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(0, 200, 151, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 200, 151, 0.2)' }}>
                <Mic style={{ color: '#00C897', width: '24px', height: '24px' }} />
              </div>
              <div>
                <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '20px', margin: '0 0 10px' }}>AI Speech Scribe</h3>
                <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>Doctor speaks, Palmtree Wellness listens. Real-time voice-to-structured-EMR in Indian English and Hindi. Reduces charting time by 40%.</p>
              </div>
              <div style={{ marginTop: 'auto', background: '#faf5ff', borderRadius: '12px', padding: '14px', border: '1px solid #edd9ff' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  {[40, 65, 45, 80, 55, 90, 60, 75, 50, 85, 70, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h * 0.4}px`, background: 'rgba(0, 200, 151, 0.7)', borderRadius: '2px' }} />
                  ))}
                </div>
                <div style={{ fontSize: '10px', color: '#00C897', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🎙 Listening...</span><span style={{ color: '#4f46e5', fontWeight: 600 }}>98.2% accuracy</span>
                </div>
              </div>
            </div>

            {/* Medium cards */}
            {[
              { icon: Sparkles, title: 'Smart Diagnosis Assist', desc: 'AI suggests differential diagnoses based on symptom clusters, vitals, and patient history.', color: '#d97706', bg: 'linear-gradient(145deg, #ffffff, #fff7ed)', border: '#ffedd5', textCol: '#9a3412' },
              { icon: Activity, title: 'Predictive Analytics', desc: 'Forecast bed demand, identify high-risk patients early, and optimize clinic throughput.', color: '#059669', bg: 'linear-gradient(145deg, #ffffff, #f0fdf4)', border: '#dcfce7', textCol: '#065f46' },
            ].map(({ icon: Icon, title, desc, color, bg, border, textCol }) => (
              <div key={title} className="bento-card" style={{ background: bg, border: `1px solid ${border}`, borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}25` }}>
                  <Icon style={{ color, width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, color: textCol, fontSize: '16px', margin: '0 0 8px' }}>{title}</h3>
                  <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}

            {/* Bottom wide card */}
            <div className="bento-card" style={{ gridColumn: isMobile ? '1' : '2 / 4', background: 'linear-gradient(145deg, #ffffff, #f0f9ff)', border: '1px solid #bfdbfe', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37, 99, 235, 0.2)', flexShrink: 0 }}>
                <Globe style={{ color: '#0078FF', width: '24px', height: '24px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 800, color: '#1e40af', fontSize: '18px', margin: '0 0 8px' }}>FHIR Interoperability Gateway</h3>
                <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Plug into the national health ecosystem. Share patient summaries, lab reports, and prescriptions with any ABDM-compliant system in milliseconds.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {['ABHA', 'PMJAY', 'CoWIN', 'HFR'].map(tag => (
                  <span key={tag} style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#0078FF', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. ROADMAP ─────────────────────────────────────────────────────────── */}
      <section id="future" style={{ padding: '100px 24px', background: 'var(--app-bg)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '56px' }}>
          <div style={{ textAlign: 'center', maxWidth: '580px', margin: '0 auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#059669' }}>Product Roadmap</span>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 900, color: '#0f172a', margin: '12px 0 16px', letterSpacing: '-1px' }}>What's coming next.</h2>
            <p style={{ color: '#64748b', fontSize: '16px', lineHeight: 1.7 }}>Our innovation pipeline is aligned with India's national digital health transformation agenda.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '24px' }}>
            {[
              { icon: Watch, quarter: 'Q3 2026', title: 'Wearable Vitals Integration', desc: 'Continuous vitals streaming from Apple Watch, Fitbit, and IoT bedside monitors directly into patient EMR timelines.', color: '#0891b2', bg: '#ecfeff' },
              { icon: Fingerprint, quarter: 'Q4 2026', title: 'ABHA Biometric Auth', desc: 'Facial recognition and fingerprint login for patients at reception kiosks — zero paper, zero friction at triage.', color: '#00C897', bg: '#f0fdfa' },
              { icon: Brain, quarter: 'Q1 2027', title: 'Imaging AI Diagnostic', desc: 'On-platform X-Ray, CT, and MRI reading assistance powered by radiology-trained vision models.', color: '#dc2626', bg: '#fef2f2' },
            ].map(({ icon: Icon, quarter, title, desc, color, bg }) => (
              <div key={title} className="feature-card" style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon style={{ color, width: '22px', height: '22px' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color, background: bg, padding: '3px 10px', borderRadius: '999px' }}>{quarter}</span>
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '17px', margin: '0 0 8px' }}>{title}</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. CTA BAND ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg, #1e40af 0%, #0056A8 50%, #0284c7 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative', display: 'flex', flexDirection: 'column', gap: '28px', alignItems: 'center' }}>
          <h2 style={{ fontSize: isMobile ? '28px' : '44px', fontWeight: 900, color: 'white', lineHeight: 1.2, letterSpacing: '-1px', margin: 0 }}>
            Ready to transform your clinic?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '17px', lineHeight: 1.7, maxWidth: '520px', margin: 0 }}>
            Join 500+ healthcare providers who've already modernized with Palmtree Wellness. Setup in under 15 minutes.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '16px 32px', borderRadius: '14px', background: 'white', color: '#0056A8', fontWeight: 800, fontSize: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', transition: 'all 0.3s' }}>
              Access Portal
            </button>
             <a href="mailto:sales@cybelinx.com" style={{ padding: '16px 32px', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, fontSize: '15px', border: '1.5px solid rgba(255,255,255,0.3)', cursor: 'pointer', textDecoration: 'none', backdropFilter: 'blur(8px)', transition: 'all 0.3s' }}>
              Talk to Sales
            </a>
          </div>
        </div>
      </section>

      {/* ── 10. CONTACT US ──────────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: '100px 24px', background: 'linear-gradient(135deg, #f0f9ff 0%, #f0fdfa 100%)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '56px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#00C897' }}>Get In Touch</span>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 900, color: '#0f172a', margin: '12px 0 16px', letterSpacing: '-1px' }}>We'd love to hear from you.</h2>
            <p style={{ color: '#475569', fontSize: '16px', lineHeight: 1.7 }}>Questions about our plans, a personalised demo, or enterprise onboarding? Our team replies fast.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { href: 'mailto:sales@cybelinx.com', icon: Mail, label: 'Email Us', value: 'sales@cybelinx.com', sub: 'We reply within 24 business hours', iconBg: 'linear-gradient(135deg, #00C897, #c084fc)', hoverBorder: '#a855f7', hoverShadow: 'rgba(168, 85, 247, 0.15)' },
              { href: 'tel:+918825492600', icon: Phone, label: 'Sales Enquiry', value: '+91 88254 92600', sub: 'Mon – Sat, 9 AM – 7 PM IST', iconBg: 'linear-gradient(135deg, #059669, #10b981)', hoverBorder: '#059669', hoverShadow: 'rgba(5, 150, 105, 0.15)' },
              { href: 'https://wa.me/918825492600', icon: MessageSquare, label: 'WhatsApp Us', value: '+91 88254 92600', sub: 'Chat with our sales team instantly', iconBg: 'linear-gradient(135deg, #059669, #10b981)', hoverBorder: '#10b981', hoverShadow: 'rgba(16, 185, 129, 0.15)' }
            ].map(({ href, icon: Icon, label, value, sub, iconBg, hoverBorder, hoverShadow }) => (
              <a key={href} href={href} className="contact-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px 16px', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = hoverBorder; (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 16px 40px ${hoverShadow}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'; }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ color: 'white', width: '20px', height: '20px' }} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#00C897', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>{label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '2px', whiteSpace: 'nowrap' }}>{value}</span>
                  <span style={{ fontSize: '11px', color: '#475569', display: 'block', lineHeight: 1.3 }}>{sub}</span>
                </div>
              </a>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#475569', margin: 0 }}>
            Powered by <strong style={{ color: '#00C897' }}>Cybelinx Technologies Pvt. Ltd.</strong> · Bangalore, India
          </p>
        </div>
      </section>

      {/* ── 11. FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '48px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'center' : 'flex-start', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: isMobile ? 'center' : 'flex-start' }}>
              <BrandLogo size="lg" />
              <p style={{ fontSize: '13px', color: '#475569', maxWidth: '280px', lineHeight: 1.6, textAlign: isMobile ? 'center' : 'left' }}>India's most comprehensive clinical operating system for modern healthcare.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px 40px' }}>
              {[['Features', '#features'], ['AI Engine', '#ai-services'], ['Roadmap', '#future'], ['Contact Us', '#contact'], ['Mobile App', '/Palmtree Wellness.apk']].map(([label, href]) => (
                <a key={href} href={href} download={href.endsWith('.apk') ? 'Palmtree Wellness.apk' : undefined} style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#0f172a'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#475569'}>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Copyright © 2026 Cybelinx Solutions LLP. All Rights Reserved.</p>
            <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
              {['Privacy Policy', 'Terms of Service', 'ABDM Sandbox'].map(link => (
                <a key={link} href="#" style={{ color: '#64748b', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#0f172a'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'}>
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
