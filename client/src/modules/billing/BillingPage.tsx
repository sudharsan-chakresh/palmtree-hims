import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { 
  Wallet, 
  ShieldCheck, 
  Receipt, 
  Search, 
  Trash2, 
  Printer, 
  CreditCard, 
  Smartphone, 
  Banknote,
  Stethoscope,
  FlaskConical,
  Pill,
  Bed,
  TrendingUp,
  History
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { getNamespacedItem } from "../../config/theme";
import { API_BASE_URL as API_BASE } from "../../config/api";
import { formatCurrency, formatNumber } from "../../utils/currency";

type BillType = 'OPD' | 'LAB' | 'PHARMACY' | 'IPD' | 'DISCHARGE';

interface BillingTab {
  id: BillType;
  label: string;
  icon: any;
  color: string;
}

const BILLING_TABS: BillingTab[] = [
  { id: 'OPD', label: 'Consultation', icon: Stethoscope, color: '#4f46e5' },
  { id: 'PHARMACY', label: 'Pharmacy', icon: Pill, color: '#10b981' },
  { id: 'LAB', label: 'Laboratory / Diagnostics', icon: FlaskConical, color: '#f59e0b' },
  { id: 'DISCHARGE', label: 'Discharge / IPD', icon: Bed, color: '#ef4444' },
];

export default function BillingPage() {
  const location = useLocation();
  const state = location.state as any;
  const queryParams = new URLSearchParams(location.search);
  const initialType = (queryParams.get('type') as BillType) || state?.billType || 'OPD';

  const [activeTab, setActiveTab] = useState<BillType>(initialType);
  const [loading, setLoading] = useState(false);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Hospital Settings (live)
  const [hospitalSettings, setHospitalSettings] = useState<any>({
    name: getNamespacedItem('tenantName') || localStorage.getItem('tenantName') || 'Hospital',
    email: '',
    phone: '',
    address: '',
    logoUrl: getNamespacedItem('theme_logo_url') || localStorage.getItem('theme_logo_url') || '',
    tagline: 'Quality Healthcare Services',
  });
  
  // Patient Context
  const [patient, setPatient] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Master Data & Billing Items
  const [services, setServices] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ dailyCollection: 0, pendingInsurance: 0, invoiceCount: 0, outstandingDues: 0 });
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  
  // Payment State
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [selectedProvider, setSelectedProvider] = useState("");
  const [insuranceDetails, setInsuranceDetails] = useState({
    policyNumber: "",
    insurerId: "",
    claimType: "Cashless",
    claimNumber: ""
  });
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);

  const headers = { 
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  // 1. Initial Data Fetch & Patient Resolution
  useEffect(() => {
    fetchHospitalSettings();
    fetchMasters();
    fetchStats();
    resolvePatientContext();
  }, []);

  const resolvePatientContext = async () => {
    if (state?.patient) {
      setPatient(state.patient);
      return;
    }
    const pId = state?.patientId || queryParams.get('patientId');
    const mrn = state?.mrn || queryParams.get('mrn');
    
    if (pId || mrn) {
      try {
        const search = pId || mrn;
        const res = await axios.get(`${API_BASE}/api/patients?search=${search}`, { headers });
        if (res.data.length > 0) setPatient(res.data[0]);
      } catch (err) { console.error("Failed to resolve patient context", err); }
    }
  };

  useEffect(() => {
    if (patient?.id) fetchPatientQueue();
    else setItems([]);
    setGeneratedInvoiceId(null); 
  }, [patient, activeTab]);

  const fetchMasters = async () => {
    try {
      const [srvRes, diagRes, treatRes, medRes, provRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/masters/services`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/diagnostics`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/treatments`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/medicines`, { headers }),
        axios.get(`${API_BASE}/api/insurance/providers`, { headers })
      ]);
      
      setServices([
        ...srvRes.data.map((s: any) => ({ ...s, masterType: 'service', compositeId: `srv-${s.id}` })),
        ...diagRes.data.map((s: any) => ({ ...s, masterType: 'diagnostic', compositeId: `diag-${s.id}` })),
        ...treatRes.data.map((s: any) => ({ ...s, masterType: 'treatment', compositeId: `treat-${s.id}` })),
        ...medRes.data.map((s: any) => ({ ...s, masterType: 'medicine', compositeId: `med-${s.id}` }))
      ]);
      setInsuranceProviders(provRes.data);
    } catch (err) { console.error(err); }
  };

  const fetchHospitalSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/settings`, { headers });
      setHospitalSettings((prev: any) => ({ ...prev, ...res.data }));
    } catch (err) { console.error('Failed to fetch hospital settings', err); }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/metrics/stats`, { headers });
      setStats({
        dailyCollection: res.data.metrics?.dailyCollection || 0,
        pendingInsurance: res.data.metrics?.pendingInsurance || 0,
        invoiceCount: res.data.metrics?.todayInvoices || 0,
        outstandingDues: res.data.metrics?.outstandingDues || 0,
      });
    } catch (err) { console.error(err); }
  };

  const fetchPatientQueue = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/billing/queue/${patient.id}`, { headers });
      const filtered = res.data.filter((item: any) => {
        const mod = item.source_module?.toUpperCase();
        if (activeTab === 'OPD') return mod === 'OPD' || mod === 'CONSULTATION' || mod === 'REGISTRATION';
        if (activeTab === 'PHARMACY') return mod === 'PHARMACY';
        if (activeTab === 'LAB') return mod === 'LAB' || mod === 'DIAGNOSTIC';
        if (activeTab === 'DISCHARGE') return mod.startsWith('IPD');
        return true; 
      });

      setItems(filtered.map((item: any) => ({
        ...item,
        description: item.description || item.name,
        price: Number(item.unit_price || item.price || 0),
        quantity: Number(item.quantity || 1),
        tax: Number(item.tax_percent || 0),
        discount: 0
      })));
    } catch (err) { console.error(err); }
  };

  const handlePatientSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/patients?search=${val}`, { headers });
      setSearchResults(res.data);
    } catch (err) { console.error(err); }
  };

  const addItem = (srv: any) => {
    setItems([...items, { 
      description: srv.name, 
      price: Number(srv.price), 
      quantity: 1, 
      tax: Number(srv.tax_percent || 0),
      discount: 0,
      category: srv.category
    }]);
  };

  const addManualItem = () => {
    const desc = prompt("Enter Item Description:", "Miscellaneous Item");
    const price = prompt("Enter Unit Price:", "0");
    if (desc && price) {
      setItems([...items, { 
        description: desc, 
        price: Number(price), 
        quantity: 1, 
        tax: 0,
        discount: 0,
        category: 'Manual'
      }]);
    }
  };

  const setWalkInPatient = () => {
    setPatient({
      id: "00000000-0000-0000-0000-000000000000",
      name: "Walk-in Customer",
      mrn: "GENERAL",
      gender: "N/A",
      age: "--"
    });
  };

  const totals = {
    subtotal: items.reduce((acc, item) => acc + (item.price * item.quantity), 0),
    tax: items.reduce((acc, item) => acc + (item.price * item.quantity * (item.tax / 100)), 0),
    discount: items.reduce((acc, item) => acc + (item.discount || 0), 0),
    get net() { return this.subtotal + this.tax - this.discount }
  };

  const finalizeBilling = async () => {
    if (!patient) return alert("Select patient first");
    setLoading(true);
    try {
      const billRes = await axios.post(`${API_BASE}/api/billing`, {
        patientId: patient.id,
        billType: activeTab,
        items,
        totalAmount: totals.net,
        paymentMode,
        status: paymentMode === 'Insurance' ? 'PENDING_SETTLEMENT' : 'PAID'
      }, { headers });

      if (paymentMode === 'Insurance' && selectedProvider) {
        await axios.post(`${API_BASE}/api/insurance/claims`, {
          patientId: patient.id,
          invoiceId: billRes.data.id,
          providerId: selectedProvider,
          ...insuranceDetails,
          billedAmount: totals.net,
          status: 'PRE-AUTH PENDING'
        }, { headers });
      }

      setGeneratedInvoiceId(billRes.data.id);
      alert("Billing Processed Successfully! The invoice is now ready.");
      fetchStats(); 
    } catch (err) {
      console.error(err);
      alert("Error processing bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', minHeight: '100vh' }}>
      <style>{`
        /* Screen mode styles */
        @media screen {
          .print-document {
            display: none !important;
          }
        }
        /* Print mode styles (overriding standard elements) */
        @media print {
          .no-print-section {
            display: none !important;
          }
          .print-document {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-document * {
            visibility: visible !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Screen Interface: completely hidden when printing */}
      <div className="no-print-section" style={{ display: 'flex', width: '100%', minHeight: '100vh', flexDirection: isMobile ? 'column' : 'row' }}>
        <Sidebar />
        
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative', width: '100%' }}>
          <div style={{ padding: isMobile ? '16px 16px 0 16px' : '20px 40px 0 40px' }}>
            <Header title="Consolidated Billing & Revenue Center" compact={true} />
          </div>

          <div style={{ padding: isMobile ? '16px' : '24px 40px', maxWidth: '1600px', margin: '0 auto' }}>
            
            {!generatedInvoiceId ? (
              // 1. BILLING CREATION INTERFACE (SCREEN)
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '48px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#e0e7ff', display: 'grid', placeItems: 'center', color: '#4338ca', boxShadow: '0 10px 15px -3px rgba(67, 56, 202, 0.1)' }}>
                    <Wallet size={24} />
                  </div>
                  <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Revenue & Settlement Hub</p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '700px' }}>Unified financial operations for OPD, Laboratory, Pharmacy, and IPD services with real-time TPA & Insurance integration.</p>
                </div>
                
                {/* TOP STATS */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '16px' : '24px', marginBottom: '32px' }}>
                  {[
                    { label: 'Today\'s Collection', value: formatNumber(stats.dailyCollection), icon: TrendingUp, color: '#10b981', sub: `${stats.invoiceCount} Invoices` },
                    { label: 'Insurance Pending', value: formatNumber(stats.pendingInsurance), icon: ShieldCheck, color: '#3b82f6', sub: 'Awaiting Settlement' },
                    { label: 'Outstanding Dues', value: formatNumber(stats.outstandingDues), icon: History, color: '#f59e0b', sub: 'Past 30 Days' }
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'white', padding: isMobile ? '16px' : '24px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px' }}>
                      <div style={{ width: isMobile ? '40px' : '56px', height: isMobile ? '40px' : '56px', borderRadius: '16px', background: `${s.color}10`, color: s.color, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                        <s.icon size={isMobile ? 20 : 28} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</div>
                        <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 900, color: '#0f172a' }}>₹ {s.value}</div>
                        {!isMobile && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.sub}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CONTEXT TABS */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '32px', 
                  padding: '6px', 
                  background: 'white', 
                  borderRadius: '20px', 
                  border: '1px solid #e2e8f0', 
                  width: isMobile ? '100%' : 'fit-content', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  overflowX: 'auto',
                  scrollbarWidth: 'none'
                }}>
                  {BILLING_TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '10px 16px' : '14px 24px', borderRadius: '16px',
                          border: 'none', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: isActive ? tab.color : 'transparent',
                          color: isActive ? 'white' : '#64748b',
                          fontWeight: 800, fontSize: isMobile ? '12px' : '14px',
                          boxShadow: isActive ? `0 10px 15px -3px ${tab.color}40` : 'none',
                          transform: isActive ? 'translateY(-1px)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <tab.icon size={isMobile ? 16 : 20} style={{ opacity: isActive ? 1 : 0.6 }} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 400px', gap: '32px', alignItems: 'start' }}>
                  
                  {/* LEFT: PATIENT & ITEMS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {/* PATIENT SEARCH */}
                    <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                          <Search size={18} />
                        </div>
                        <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 800, margin: 0 }}>Patient Identity Lookup</h3>
                      </div>

                      {!patient ? (
                        <div style={{ position: 'relative', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input 
                              placeholder="Search by MRN, Name or Phone..."
                              value={searchQuery}
                              onChange={(e) => handlePatientSearch(e.target.value)}
                              style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 600, outline: 'none', background: 'var(--app-bg)' }}
                            />
                            {searchResults.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', marginTop: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                                {searchResults.map(p => (
                                  <div 
                                    key={p.id} 
                                    onClick={() => { setPatient(p); setSearchResults([]); }}
                                    style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                  >
                                    <div style={{ fontWeight: 800, fontSize: '14px' }}>{p.name}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>MRN: {p.mrn} • {p.phone}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={setWalkInPatient}
                            style={{ padding: '14px 24px', borderRadius: '16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 700, cursor: 'pointer' }}
                          >
                            WALK-IN
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 900 }}>
                            {patient.name.charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '18px', fontWeight: 900, color: '#166534' }}>{patient.name}</div>
                            <div style={{ fontSize: '13px', color: '#166534', opacity: 0.8 }}>MRN: {patient.mrn} • {patient.gender} • {patient.age}Y</div>
                          </div>
                          <button 
                            onClick={() => setPatient(null)}
                            style={{ padding: '8px 16px', borderRadius: '10px', background: 'white', border: '1px solid #bbf7d0', color: '#ef4444', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                          >
                            CHANGE
                          </button>
                        </div>
                      )}
                    </div>

                    {/* BILLING ITEMS */}
                    <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '32px', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                            <Receipt size={18} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 800, margin: 0 }}>Invoice Particulars</h3>
                            {patient?.mrn === 'GENERAL' && (
                              <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '4px', fontWeight: 700 }}>
                                ℹ️ Note: For Walk-in customers, please add consultation or services manually.
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: isMobile ? '100%' : 'auto', justifyContent: 'flex-end' }}>
                          <select 
                            style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, background: 'var(--app-bg)', width: isMobile ? '100%' : '250px' }}
                            onChange={(e) => {
                              const srv = services.find(s => s.compositeId === e.target.value);
                              if (srv) addItem(srv);
                              e.target.value = ""; 
                            }}
                          >
                            <option value="">+ Add Service / Medicine</option>
                            {services.filter(s => {
                              if (activeTab === 'OPD') return s.category === 'Consultation' || s.masterType === 'service';
                              if (activeTab === 'PHARMACY') return s.masterType === 'medicine';
                              if (activeTab === 'LAB') return s.masterType === 'diagnostic';
                              return true;
                            }).map(s => <option key={s.compositeId} value={s.compositeId}>{s.name} (₹{s.price})</option>)}
                          </select>
                          <button 
                            onClick={addManualItem}
                            style={{ padding: '10px 16px', borderRadius: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '12px', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}
                          >
                            + MANUAL ITEM
                          </button>
                        </div>
                      </div>

                      {isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {items.map((item, idx) => (
                            <div key={idx} style={{ padding: '16px', background: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{item.description}</div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>TAX: {item.tax}% • {item.source_module || 'MANUAL'}</div>
                                </div>
                                <button 
                                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>Qty:</span>
                                  <input 
                                    type="number" min="1" 
                                    style={{ width: '50px', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700 }}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const next = [...items];
                                      next[idx].quantity = Number(e.target.value);
                                      setItems(next);
                                    }}
                                  />
                                </div>
                                <div style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(item.price * item.quantity)}</div>
                              </div>
                            </div>
                          ))}
                          {items.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No items added.</div>}
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                              <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>DESCRIPTION</th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>UNIT PRICE</th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>QTY</th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>DISCOUNT</th>
                                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>TOTAL (₹)</th>
                              </tr>
                          </thead>
                          <tbody>
                            {items.length > 0 ? items.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '20px 16px' }}>
                                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{item.description}</div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>TAX: {item.tax}% • {item.source_module || 'MANUAL'}</div>
                                </td>
                                <td style={{ padding: '20px 16px', fontWeight: 600, color: '#475569' }}>{formatCurrency(item.price)}</td>
                                <td style={{ padding: '20px 16px' }}>
                                  <input 
                                    type="number" min="1" 
                                    style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700 }}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const next = [...items];
                                      next[idx].quantity = Number(e.target.value);
                                      setItems(next);
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '20px 16px' }}>
                                  <input 
                                    type="number" min="0" 
                                    disabled={item.category !== 'Consultation' && item.category !== 'Bed Charges'}
                                    style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, opacity: (item.category !== 'Consultation' && item.category !== 'Bed Charges') ? 0.5 : 1 }}
                                    value={item.discount}
                                    onChange={(e) => {
                                      const next = [...items];
                                      next[idx].discount = Number(e.target.value);
                                      setItems(next);
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
                                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatNumber((item.price * item.quantity) - (item.discount || 0))}</span>
                                    <button 
                                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                      style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                                  No items added to invoice.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: SUMMARY & PAYMENT */}
                  <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    <div style={{ 
                      background: 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)', 
                      padding: '32px', 
                      borderRadius: '28px', 
                      color: 'white', 
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Wallet size={20} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Settlement Summary</h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Total Service Value</span>
                          <span style={{ fontWeight: 700, fontSize: '16px' }}>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Statutory Taxes</span>
                          <span style={{ fontWeight: 700, fontSize: '16px' }}>{formatCurrency(totals.tax)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Net Payable Amount</div>
                            <div style={{ fontSize: '36px', fontWeight: 900, color: '#10b981', letterSpacing: '-0.03em' }}>{formatCurrency(totals.net)}</div>
                          </div>
                        </div>
                      </div>

                      {/* PAYMENT MODES */}
                      <div style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '16px' }}>Select Payment Method</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {[
                            { id: 'Cash', icon: Banknote },
                            { id: 'UPI', icon: Smartphone },
                            { id: 'Card', icon: CreditCard },
                            { id: 'Insurance', icon: ShieldCheck }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              onClick={() => setPaymentMode(mode.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', borderRadius: '16px',
                                border: paymentMode === mode.id ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                background: paymentMode === mode.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                color: paymentMode === mode.id ? '#10b981' : '#94a3b8',
                                fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              <mode.icon size={16} />
                              {mode.id}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button 
                          disabled={loading || items.length === 0}
                          onClick={finalizeBilling}
                          style={{ 
                            width: '100%', padding: '18px', borderRadius: '16px', background: '#10b981', color: 'white', 
                            border: 'none', fontWeight: 900, fontSize: '16px', cursor: 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.4)', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          {loading ? 'PROCESSING...' : 'GENERATE INVOICE'}
                        </button>
                        
                        <button 
                          onClick={() => window.print()}
                          style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Printer size={16} />
                          PRINT PROFORMA
                        </button>
                      </div>
                    </div>

                    {/* INSURANCE CARD */}
                    {paymentMode === 'Insurance' && (
                      <div style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 800 }}>TPA / Claim Context</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>INSURANCE PROVIDER</label>
                            <select 
                              value={selectedProvider}
                              onChange={(e) => setSelectedProvider(e.target.value)}
                              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }}
                            >
                              <option value="">-- Select Provider --</option>
                              {insuranceProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>POLICY NUMBER</label>
                            <input 
                              value={insuranceDetails.policyNumber}
                              onChange={(e) => setInsuranceDetails({...insuranceDetails, policyNumber: e.target.value})}
                              placeholder="e.g. POL-123456"
                              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              // 2. INVOICE SUCCESS AND PRESENTATION SHEET (SCREEN PREVIEW)
              <div style={{ maxWidth: '850px', margin: '0 auto' }}>
                
                {/* Success Banner */}
                <div style={{ 
                  background: '#f0fdf4', 
                  border: '1px solid #bbf7d0', 
                  borderRadius: '20px', 
                  padding: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '32px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#14532d' }}>Invoice Finalized Successfully</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#166534', opacity: 0.9 }}>
                        ID: <strong style={{ fontFamily: 'monospace', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>{generatedInvoiceId}</strong> has been secured to patient accounts.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => window.print()}
                      style={{ 
                        padding: '12px 24px', 
                        borderRadius: '14px', 
                        background: '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        fontWeight: 800, 
                        fontSize: '14px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        boxShadow: '0 4px 10px rgba(59, 130, 246, 0.25)'
                      }}
                    >
                      <Printer size={16} />
                      Print Bill
                    </button>
                    <button 
                      onClick={() => {
                        setGeneratedInvoiceId(null);
                        setPatient(null);
                        setItems([]);
                        setSearchQuery("");
                      }}
                      style={{ 
                        padding: '12px 24px', 
                        borderRadius: '14px', 
                        background: '#f1f5f9', 
                        color: '#475569', 
                        border: '1px solid #e2e8f0', 
                        fontWeight: 800, 
                        fontSize: '14px', 
                        cursor: 'pointer'
                      }}
                    >
                      New Invoice
                    </button>
                  </div>
                </div>

                {/* On-Screen Invoice Preview Sheet */}
                <div style={{ 
                  background: 'white', 
                  borderRadius: '28px', 
                  border: '1px solid #e2e8f0', 
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)',
                  padding: isMobile ? '24px' : '48px', 
                  color: 'black' 
                }}>
                  {/* Header: Logo & Hospital Details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '24px' }}>
                        {localStorage.getItem("tenantName") ? localStorage.getItem("tenantName")!.charAt(0) : "H"}
                      </div>
                      <div>
                        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
                          {hospitalSettings.name}
                        </h2>
                        <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                          {hospitalSettings.tagline}
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                          {hospitalSettings.email && `${hospitalSettings.email}`}{hospitalSettings.phone && ` | ${hospitalSettings.phone}`}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0284c7', letterSpacing: '0.5px' }}>PALMTREE HIMS</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>Clinical Billing System</div>
                    </div>
                  </div>

                  {/* Title & Meta info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
                    <div>
                      <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
                        CLINICAL TAX INVOICE
                      </h1>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 800, 
                        color: '#15803d', 
                        background: '#f0fdf4', 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        border: '1px solid #bbf7d0',
                        textTransform: 'uppercase' 
                      }}>
                        Payment Status: Settled & Paid ({paymentMode})
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '8px 16px', textAlign: 'right', fontSize: '13px' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Invoice No:</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{generatedInvoiceId}</span>
                      
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Date:</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Payment Mode:</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{paymentMode}</span>
                    </div>
                  </div>

                  {/* Patient Details */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', background: 'var(--app-bg)', marginBottom: '32px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Patient Information
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '16px', fontSize: '13px' }}>
                      <div>
                        <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>PATIENT NAME</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{patient?.name || "Walk-in Customer"}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>MRN / PATIENT ID</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{patient?.mrn || "GENERAL"}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>AGE / GENDER</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {patient?.age && patient?.age !== '--' ? `${patient.age} Yrs / ${patient.gender}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>CONTACT PHONE</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{patient?.phone || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Particulars Table */}
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Particulars & Itemized Charges
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '12px 8px', fontWeight: 800, width: '40px' }}>#</th>
                        <th style={{ padding: '12px 8px', fontWeight: 800 }}>Item Description</th>
                        <th style={{ padding: '12px 8px', fontWeight: 800 }}>Dept / Category</th>
                        <th style={{ padding: '12px 8px', fontWeight: 800, textAlign: 'right' }}>Unit Price (₹)</th>
                        <th style={{ padding: '12px 8px', fontWeight: 800, textAlign: 'center', width: '60px' }}>Qty</th>
                        <th style={{ padding: '12px 8px', fontWeight: 800, textAlign: 'right', width: '100px' }}>Discount (₹)</th>
                        <th style={{ padding: '12px 8px', fontWeight: 800, textAlign: 'right', width: '120px' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: '#0f172a' }}>{item.description}</td>
                          <td style={{ padding: '12px 8px', color: '#475569', fontWeight: 500 }}>{item.source_module || item.category || 'Manual'}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#0f172a' }}>{formatNumber(item.price)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0f172a', fontWeight: 600 }}>{item.quantity}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#b91c1c' }}>{item.discount > 0 ? formatCurrency(item.discount) : "—"}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {formatNumber((item.price * item.quantity) - (item.discount || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Financial Summary */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: '24px', marginBottom: '48px' }}>
                    <div style={{ maxWidth: '350px', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Terms & Conditions</div>
                      <div>1. This receipt is computer-generated and issued securely via PALMTREE HIMS. No signature is required.</div>
                      <div>2. Any queries regarding this bill must be directed to clinical accounting within 24 hours.</div>
                    </div>
                    
                    <div style={{ width: isMobile ? '100%' : '300px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', textAlign: 'right' }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Subtotal:</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(totals.subtotal)}</span>
                        
                        <span style={{ color: '#64748b', fontWeight: 600 }}>GST / Taxes:</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(totals.tax)}</span>
                        
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Total Discount:</span>
                        <span style={{ fontWeight: 700, color: '#b91c1c' }}>{formatCurrency(totals.discount)}</span>
                        
                        <div style={{ gridColumn: 'span 2', borderTop: '2px double #cbd5e1', margin: '8px 0' }}></div>
                        
                        <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>Amount Paid:</span>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#15803d' }}>
                          {formatCurrency(totals.net)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginTop: '64px', borderTop: '1px dashed #cbd5e1', paddingTop: '32px' }}>
                    <div style={{ width: '200px', textAlign: 'center' }}>
                      <div style={{ borderBottom: '1px solid #94a3b8', height: '24px', marginBottom: '8px' }}></div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Patient Signature</div>
                    </div>
                    
                    <div style={{ width: '200px', textAlign: 'center' }}>
                      <div style={{ borderBottom: '1px solid #94a3b8', height: '24px', marginBottom: '8px' }}></div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Authorized Signatory</div>
                    </div>
                  </div>

                  {/* Footer Brand */}
                  <div style={{ textAlign: 'center', marginTop: '64px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8', fontSize: '11px', fontWeight: 800 }}>
                      <span>POWERED BY CYBELINX® CLINICAL NETWORK</span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }}></span>
                      <span>SECURE ELECTRONIC RECORD</span>
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        </main>
      </div>

      {/* 3. DEDICATED PRINT DOCUMENT (Always hidden on screen, becomes visible during browser print trigger) */}
      <div className="print-document" style={{ width: '100%', background: 'white', color: 'black', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Header: Logo & Hospital Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000000', paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '24px' }}>
              {localStorage.getItem("tenantName") ? localStorage.getItem("tenantName")!.charAt(0) : "H"}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#000000', margin: '0 0 4px 0' }}>
                {hospitalSettings.name}
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#000000', fontWeight: 600 }}>
                {hospitalSettings.tagline}
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#000000' }}>
                {hospitalSettings.email}{hospitalSettings.phone && ` | ${hospitalSettings.phone}`}
              </p>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#000000', letterSpacing: '0.5px', marginBottom: '4px' }}>PALMTREE HIMS</div>
            <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>Official Invoice</div>
          </div>
        </div>

        {/* Invoice Title & Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em', color: '#000000' }}>
              CLINICAL TAX INVOICE
            </h1>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              color: '#000000', 
              border: '1px solid #000000',
              padding: '2px 6px',
              borderRadius: '4px',
              textTransform: 'uppercase' 
            }}>
              Payment Status: Settled & Paid ({paymentMode})
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 16px', textAlign: 'right', fontSize: '12px', color: '#000000' }}>
            <span style={{ fontWeight: 600 }}>Invoice No:</span>
            <span style={{ fontWeight: 700 }}>{generatedInvoiceId || "PROFORMA-DRAFT"}</span>
            
            <span style={{ fontWeight: 600 }}>Date:</span>
            <span style={{ fontWeight: 700 }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            
            <span style={{ fontWeight: 600 }}>Payment Mode:</span>
            <span style={{ fontWeight: 700 }}>{paymentMode}</span>
          </div>
        </div>

        {/* Patient Details */}
        <div style={{ border: '1px solid #000000', borderRadius: '8px', padding: '16px', background: '#ffffff', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Patient Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px', color: '#000000' }}>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '10px', color: '#000000' }}>PATIENT NAME</span>
              <span style={{ fontWeight: 700 }}>{patient?.name || "Walk-in Customer"}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '10px', color: '#000000' }}>MRN / PATIENT ID</span>
              <span style={{ fontWeight: 700 }}>{patient?.mrn || "GENERAL"}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '10px', color: '#000000' }}>AGE / GENDER</span>
              <span style={{ fontWeight: 700 }}>
                {patient?.age && patient?.age !== '--' ? `${patient.age} Yrs / ${patient.gender}` : "—"}
              </span>
            </div>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '10px', color: '#000000' }}>CONTACT PHONE</span>
              <span style={{ fontWeight: 700 }}>{patient?.phone || "—"}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '12px', color: '#000000' }}>
          <thead>
            <tr style={{ borderTop: '2px solid #000000', borderBottom: '2px solid #000000', textAlign: 'left' }}>
              <th style={{ padding: '8px 4px', fontWeight: 800, width: '30px' }}>#</th>
              <th style={{ padding: '8px 4px', fontWeight: 800 }}>Item Description</th>
              <th style={{ padding: '8px 4px', fontWeight: 800 }}>Category</th>
              <th style={{ padding: '8px 4px', fontWeight: 800, textAlign: 'right' }}>Unit Price (₹)</th>
              <th style={{ padding: '8px 4px', fontWeight: 800, textAlign: 'center', width: '50px' }}>Qty</th>
              <th style={{ padding: '8px 4px', fontWeight: 800, textAlign: 'right', width: '90px' }}>Discount (₹)</th>
              <th style={{ padding: '8px 4px', fontWeight: 800, textAlign: 'right', width: '100px' }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 4px' }}>{idx + 1}</td>
                <td style={{ padding: '8px 4px', fontWeight: 700 }}>{item.description}</td>
                <td style={{ padding: '8px 4px' }}>{item.source_module || item.category || 'Manual'}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatNumber(item.price)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.discount > 0 ? formatNumber(item.discount) : "0"}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>
                  {formatNumber((item.price * item.quantity) - (item.discount || 0))}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', fontStyle: 'italic' }}>
                  No items added.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Financial Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '40px' }}>
          <div style={{ maxWidth: '350px', fontSize: '11px', color: '#000000', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, marginBottom: '6px' }}>Terms & Conditions</div>
            <div>1. This receipt is computer-generated and issued securely via PALMTREE HIMS. No signature is required.</div>
            <div>2. Any queries regarding this bill must be directed to clinical accounting within 24 hours.</div>
          </div>
          
          <div style={{ width: '280px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '12px', textAlign: 'right', color: '#000000' }}>
              <span style={{ fontWeight: 600 }}>Subtotal:</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(totals.subtotal)}</span>
              
              <span style={{ fontWeight: 600 }}>GST / Taxes:</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(totals.tax)}</span>
              
              <span style={{ fontWeight: 600 }}>Total Discount:</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(totals.discount)}</span>
              
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #000000', margin: '4px 0' }}></div>
              
              <span style={{ fontSize: '14px', fontWeight: 900 }}>Amount Paid:</span>
              <span style={{ fontSize: '16px', fontWeight: 900 }}>
                {formatCurrency(totals.net)}
              </span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '48px', borderTop: '1px dashed #000000', paddingTop: '20px' }}>
          <div style={{ width: '180px', textAlign: 'center', color: '#000000' }}>
            <div style={{ borderBottom: '1px solid #000000', height: '20px', marginBottom: '6px' }}></div>
            <div style={{ fontSize: '11px', fontWeight: 700 }}>Patient Signature</div>
          </div>
          
          <div style={{ width: '180px', textAlign: 'center', color: '#000000' }}>
            <div style={{ borderBottom: '1px solid #000000', height: '20px', marginBottom: '6px' }}></div>
            <div style={{ fontSize: '11px', fontWeight: 700 }}>Authorized Signatory</div>
          </div>
        </div>

        {/* Footer Brand */}
        <div style={{ textAlign: 'center', marginTop: '48px', borderTop: '1px solid #000000', paddingTop: '12px', color: '#000000', fontSize: '10px', fontWeight: 800 }}>
          {hospitalSettings.name} • SECURE ELECTRONIC RECORD
        </div>
      </div>

    </div>
  );
}
