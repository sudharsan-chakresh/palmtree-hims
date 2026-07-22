import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Shield, Plus, Search, FileText, CheckCircle, Clock, AlertCircle, Building2, UserPlus } from "lucide-react";
import { formatCurrency } from "../../../utils/currency";

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState('claims');
  const [claims, setClaims] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [patientMappings, setPatientMappings] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  const [showProvModal, setShowProvModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);


  const [newProv, setNewProv] = useState({ name: '', tpa_name: '', contact_person: '', email: '' });
  const [newPlan, setNewPlan] = useState({ provider_id: '', plan_name: '', description: '', base_coverage: '', copay_percent: '' });
  const [newMap, setNewMap] = useState({ patient_id: '', provider_id: '', plan_id: '', policy_number: '', total_limit: '', copay_percent: '', valid_till: '' });

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [claimsRes, provRes, planRes, mapRes, patRes] = await Promise.all([
        axios.get(`${API_BASE}/api/insurance/claims`, { headers }),
        axios.get(`${API_BASE}/api/insurance/providers`, { headers }),
        axios.get(`${API_BASE}/api/insurance/plans`, { headers }),
        axios.get(`${API_BASE}/api/insurance/patient-mapping`, { headers }),
        axios.get(`${API_BASE}/api/patients`, { headers })
      ]);
      setClaims(claimsRes.data);
      setProviders(provRes.data);
      setPlans(planRes.data);
      setPatientMappings(mapRes.data);
      setPatients(patRes.data);
    } catch (err) { console.error(err); }
  };

  const handleAddProvider = async (e: any) => {
    e.preventDefault();
    if (!newProv.name.trim()) {
      alert('Provider name is required');
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/insurance/providers`, newProv, { headers });
      setNewProv({ name: '', tpa_name: '', contact_person: '', email: '' });
      setShowProvModal(false);
      fetchData();
    } catch (err: any) { alert(err.response?.data?.error || "Failed to add provider"); }
  };

  const handleAddPlan = async (e: any) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/insurance/plans`, newPlan, { headers });
      setShowPlanModal(false);
      fetchData();
    } catch (err) { alert("Failed to add plan"); }
  };

  const handleAddMapping = async (e: any) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/insurance/patient-mapping`, newMap, { headers });
      setShowMapModal(false);
      fetchData();
    } catch (err) { alert("Failed to map patient policy"); }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('approved') || s.includes('settled') || s.includes('active')) return '#10b981';
    if (s.includes('pending') || s.includes('pre-auth')) return '#f59e0b';
    if (s.includes('rejected')) return '#ef4444';
    return '#64748b';
  };

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar />
      <main className="main-content">
        <Header title="Insurance & TPA Management" />
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#e0f2fe', color: '#0ea5e9', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(14, 165, 233, 0.1)' }}>
            <Shield size={24} />
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Claims & Settlements Control</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Unified command center for multi-TPA pre-authorizations, insurance claim tracking, and financial settlements.</p>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '6px', borderRadius: '16px', border: '1px solid #e2e8f0', width: 'fit-content', margin: '0 auto 32px' }}>
          {[
            { id: 'claims', label: 'Claims Tracking', icon: FileText },
            { id: 'providers', label: 'Providers & Plans', icon: Building2 },
            { id: 'mapping', label: 'Patient Policies', icon: UserPlus }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ 
                padding: '10px 20px', borderRadius: '12px', border: 'none', 
                background: activeTab === tab.id ? '#0ea5e9' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#64748b',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'claims' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              {[
                { label: 'Active Claims', val: claims.length, icon: FileText, color: '#3b82f6' },
                { label: 'Pre-Auth Pending', val: claims.filter(c => c.status?.includes('PENDING')).length, icon: Clock, color: '#f59e0b' },
                { label: 'Settled Today', val: '₹ 0', icon: CheckCircle, color: '#10b981' },
                { label: 'Rejected/Query', val: claims.filter(c => c.status?.includes('REJECTED')).length, icon: AlertCircle, color: '#ef4444' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ padding: '8px', borderRadius: '12px', background: `${s.color}10` }}>
                        <s.icon size={20} color={s.color} />
                      </div>
                   </div>
                   <p style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', margin: 0 }}>{s.label}</p>
                   <p style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0' }}>{s.val}</p>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }} />
                  <input placeholder="Search claims..." style={{ width: '100%', padding: '12px 12px 12px 48px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--app-bg)' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Patient</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Provider</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Claim Info</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '20px 24px' }}>
                        <p style={{ margin: 0, fontWeight: 800 }}>{c.patient_name}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{c.mrn}</p>
                      </td>
                      <td style={{ padding: '20px 24px' }}>{c.provider_name}</td>
                      <td style={{ padding: '20px 24px' }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>{formatCurrency(c.billed_amount)}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Claim #: {c.claim_number}</p>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{ fontSize: '10px', background: `${getStatusColor(c.status)}15`, color: getStatusColor(c.status), padding: '4px 10px', borderRadius: '10px', fontWeight: 800 }}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'providers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
             <div style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0', height: 'fit-content' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, fontWeight: 900 }}>Providers</h3>
                  <button onClick={() => setShowProvModal(true)} style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {providers.map((p, i) => (
                    <div key={i} style={{ padding: '16px', borderRadius: '16px', background: 'var(--app-bg)', border: '1px solid #f1f5f9' }}>
                      <p style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>{p.name}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>TPA: {p.tpa_name}</p>
                    </div>
                  ))}
                </div>
             </div>

             <div style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, fontWeight: 900 }}>Insurance Plans</h3>
                  <button onClick={() => setShowPlanModal(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Create Plan
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {plans.map((p, i) => (
                    <div key={i} style={{ padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                       <p style={{ margin: 0, fontSize: '11px', color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase' }}>{p.provider_name}</p>
                       <p style={{ margin: '4px 0 0', fontWeight: 900, color: '#0f172a' }}>{p.plan_name}</p>
                       <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 700 }}>COVERAGE</p>
                            <p style={{ margin: 0, fontWeight: 800 }}>{formatCurrency(p.base_coverage)}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 700 }}>COPAY</p>
                            <p style={{ margin: 0, fontWeight: 800 }}>{p.copay_percent}%</p>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'mapping' && (
          <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
             <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 900 }}>Patient Policy Mapping</h3>
                <button onClick={() => setShowMapModal(true)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={18} /> Map New Policy
                </button>
             </div>
             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--app-bg)' }}>
                   <tr>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Patient</th>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Plan Details</th>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Utilization</th>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Eligibility</th>
                   </tr>
                </thead>
                <tbody>
                   {patientMappings.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                         <td style={{ padding: '20px 24px' }}>
                            <p style={{ margin: 0, fontWeight: 800 }}>{m.patient_name}</p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Policy: {m.policy_number}</p>
                         </td>
                         <td style={{ padding: '20px 24px' }}>
                            <p style={{ margin: 0, fontWeight: 700 }}>{m.plan_name}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#3b82f6' }}>{m.provider_name}</p>
                         </td>
                         <td style={{ padding: '20px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${(m.remaining_limit / m.total_limit) * 100}%`, height: '100%', background: '#10b981' }}></div>
                               </div>
                               <span style={{ fontSize: '12px', fontWeight: 800 }}>{formatCurrency(m.remaining_limit)} / {formatCurrency(m.total_limit)}</span>
                            </div>
                         </td>
                         <td style={{ padding: '20px 24px' }}>
                            <span style={{ fontSize: '10px', background: `${getStatusColor(m.status)}15`, color: getStatusColor(m.status), padding: '4px 10px', borderRadius: '10px', fontWeight: 800 }}>{m.status.toUpperCase()}</span>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

        {/* Modals */}
        {showProvModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '450px' }}>
              <h2 style={{ margin: '0 0 24px', fontWeight: 900 }}>Add Insurance Provider</h2>
              <form onSubmit={handleAddProvider} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input value={newProv.name} placeholder="Provider Name" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewProv({...newProv, name: e.target.value})} />
                <input value={newProv.tpa_name} placeholder="TPA Name (Optional)" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewProv({...newProv, tpa_name: e.target.value})} />
                <input value={newProv.contact_person} placeholder="Contact Person" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewProv({...newProv, contact_person: e.target.value})} />
                <input value={newProv.email} placeholder="Email" type="email" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewProv({...newProv, email: e.target.value})} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowProvModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#0ea5e9', color: 'white', border: 'none', fontWeight: 700 }}>Save Provider</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPlanModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '450px' }}>
              <h2 style={{ margin: '0 0 24px', fontWeight: 900 }}>Create Insurance Plan</h2>
              <form onSubmit={handleAddPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewPlan({...newPlan, provider_id: e.target.value})}>
                   <option value="">Select Provider</option>
                   {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input placeholder="Plan Name" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewPlan({...newPlan, plan_name: e.target.value})} />
                <input placeholder="Base Coverage Amount" type="number" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewPlan({...newPlan, base_coverage: e.target.value})} />
                <input placeholder="Copay Percentage %" type="number" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewPlan({...newPlan, copay_percent: e.target.value})} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowPlanModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700 }}>Save Plan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showMapModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '500px' }}>
              <h2 style={{ margin: '0 0 24px', fontWeight: 900 }}>Map Patient Policy</h2>
              <form onSubmit={handleAddMapping} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, patient_id: e.target.value})}>
                   <option value="">Select Patient</option>
                   {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <select required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, provider_id: e.target.value})}>
                    <option value="">Select Provider</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, plan_id: e.target.value})}>
                    <option value="">Select Plan</option>
                    {plans.filter(p => p.provider_id === newMap.provider_id).map(p => <option key={p.id} value={p.id}>{p.plan_name}</option>)}
                  </select>
                </div>
                <input placeholder="Policy Number" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, policy_number: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <input placeholder="Total Limit (₹)" type="number" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, total_limit: e.target.value})} />
                  <input placeholder="Copay %" type="number" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, copay_percent: e.target.value})} />
                </div>
                <input placeholder="Valid Till" type="date" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewMap({...newMap, valid_till: e.target.value})} />
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowMapModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: 700 }}>Assign Policy</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
