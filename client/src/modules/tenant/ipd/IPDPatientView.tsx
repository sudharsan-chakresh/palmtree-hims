import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";


import { Pill, FlaskConical, Zap, Sparkles, X } from 'lucide-react';
import { formatCurrencyFixed } from "../../../utils/currency";

export default function IPDPatientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<{ admission: any; notes: any[]; dischargeSummary?: any; } | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("Progress");
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Quick Order Modals
  const [showLabModal, setShowLabModal] = useState(false);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ description: "", amount: "", quantity: "1" });
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/ipd/admissions/${id}`, { headers });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMasters = async () => {
    try {
      const [diagRes, medRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/masters/diagnostics`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/medicines`, { headers })
      ]);
      setDiagnostics(diagRes.data);
      setMedicines(medRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { 
    fetchData(); 
    fetchMasters();
  }, [id]);

  const addNote = async () => {
    if (!noteText.trim()) {
      showToast("Enter a clinical note before saving.", "error");
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/hospital/ipd/admissions/${id}/notes`, {
        noteText, noteType
      }, { headers });
      setNoteText("");
      showToast("Clinical note saved.", "success");
      fetchData();
    } catch (err) { showToast("Failed to save note.", "error"); }
  };

  const submitServiceCharge = async () => {
    try {
      await axios.post(`${API_BASE}/api/hospital/ipd/admissions/${id}/service-charges`, serviceForm, { headers });
      showToast("Service charge posted to bill.", "success");
      setShowServiceModal(false);
      setServiceForm({ description: "", amount: "", quantity: "1" });
    } catch (err) { showToast("Failed to post charge.", "error"); }
  };

  const handleDischarge = async () => {
    try {
      await axios.post(`${API_BASE}/api/hospital/ipd/admissions/${id}/discharge`, {
        summary: data?.admission.ai_summary || "Routine recovery and discharge.",
        dischargeType: "STANDARD"
      }, { headers });
      
      setShowDischargeConfirm(false);
      showToast("Patient discharged successfully.", "success");
      
      const role = (localStorage.getItem("role") || "").toLowerCase();
      const canBill = role !== "doctor";
      
      if (canBill && confirm(`Patient discharged! Bed is now vacant.\n\nProceed to the Billing Center to finalize the discharge invoice?`)) {
        navigate(`/billing?type=DISCHARGE&patientId=${data?.admission.patient_id}`);
      } else {
        navigate('/tenant/ipd/admissions');
      }
    } catch (err) { showToast("Discharge failed.", "error"); }
  };

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await axios.post(`${API_BASE}/api/hospital/ipd/admissions/${id}/generate-summary`, {}, { headers });
      if (res.data.summaryText?.includes("AI_LIMIT_REACHED")) {
        showToast("AI Quota Reached. Please wait 60 seconds.", "info");
      } else {
        showToast(`AI discharge summary generated.`, "success");
        fetchData(); 
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to generate AI discharge summary.", "error");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const submitLabOrder = async () => {
    if (selectedTests.length === 0) return;
    setIsOrdering(true);
    try {
      await axios.post(`${API_BASE}/api/hospital/encounters/${data?.admission.encounter_id}/lab-orders`, { 
        diagnosticIds: selectedTests 
      }, { headers });
      showToast("Lab orders placed successfully.", "success");
      setShowLabModal(false);
      setSelectedTests([]);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || "Failed to place lab order.";
      showToast(message, "error");
    } finally { setIsOrdering(false); }
  };

  const submitPharmacyOrder = async () => {
    if (prescriptions.length === 0) return;
    setIsOrdering(true);
    try {
      await axios.post(`${API_BASE}/api/hospital/encounters/${data?.admission.encounter_id}/prescriptions`, { 
        items: prescriptions 
      }, { headers });
      showToast("Pharmacy order placed successfully.", "success");
      setShowPharmacyModal(false);
      setPrescriptions([]);
    } catch (err) { showToast("Failed to place pharmacy order.", "error"); }
    finally { setIsOrdering(false); }
  };

  if (loading) return (
    <div className="dashboard-layout" style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading patient record...</main>
    </div>
  );

  const adm = data?.admission;
  const notes = data?.notes || [];
  const los = adm ? Math.ceil((Date.now() - new Date(adm.admitted_at).getTime()) / (1000 * 60 * 60 * 24)) || 1 : 0;

  const NOTE_COLORS: Record<string, string> = {
    Progress: '#3b82f6',
    Nursing: '#10b981',
    'Discharge Summary': '#8b5cf6'
  };

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <Header title="IPD Patient Record" />

        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => navigate('/tenant/ipd/admissions')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
            ← Back to Census
          </button>
          <button
            onClick={() => setShowDischargeConfirm(true)}
            style={{ padding: '12px 28px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', fontSize: '14px', boxShadow: '0 8px 20px rgba(239,68,68,0.3)' }}
          >
            🚪 Discharge Patient
          </button>
        </div>

        {adm && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px' }}>
            {/* Left: Patient Info + Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Patient Header */}
              <div style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
                    🏥
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{adm.patient_name}</h2>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 800 }}>{adm.mrn}</span> · {adm.age} yrs · {adm.gender} · {adm.phone}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 900, fontSize: '12px', padding: '6px 14px', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
                      ACTIVE ADMISSION
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '28px' }}>
                  {[
                    { label: 'Ward', value: adm.ward_name },
                    { label: 'Bed', value: adm.bed_number },
                    { label: 'Length of Stay', value: `${los} day${los !== 1 ? 's' : ''}` },
                    { label: 'Treating Doctor', value: adm.doctor_name || 'Not assigned' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '16px', background: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>{item.label}</p>
                      <p style={{ margin: '6px 0 0', fontWeight: 900, color: '#0f172a', fontSize: '15px' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '20px', padding: '16px 20px', background: '#fffbeb', borderRadius: '14px', border: '1px solid #fcd34d' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#92400e' }}>ADMISSION REASON</p>
                  <p style={{ margin: '6px 0 0', color: '#78350f', lineHeight: 1.6 }}>{adm.admission_reason}</p>
                </div>
              </div>

              {/* Clinical Notes */}
              <div style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginBottom: '24px' }}>Clinical Notes & Progress</h3>

                {/* Add Note */}
                <div style={{ padding: '24px', background: 'var(--app-bg)', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    {['Progress', 'Nursing', 'Discharge Summary'].map(t => (
                      <button key={t} onClick={() => setNoteType(t)} style={{
                        padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                        background: noteType === t ? NOTE_COLORS[t] : '#e2e8f0',
                        color: noteType === t ? 'white' : '#64748b'
                      }}>{t}</button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Document clinical observations, vital trends, doctor's orders, nursing notes..."
                    rows={4}
                    style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', resize: 'none', fontSize: '14px', lineHeight: 1.6 }}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                  />
                  <button onClick={addNote} style={{ marginTop: '12px', padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
                    + Add Note
                  </button>
                </div>

                {/* Notes Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {notes.map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: NOTE_COLORS[n.note_type] || '#94a3b8', flexShrink: 0 }}></div>
                        {i < notes.length - 1 && <div style={{ width: '2px', flex: 1, background: '#f1f5f9', marginTop: '4px' }}></div>}
                      </div>
                      <div style={{ flex: 1, paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: NOTE_COLORS[n.note_type] || '#64748b', background: `${NOTE_COLORS[n.note_type]}20`, padding: '2px 10px', borderRadius: '6px' }}>
                            {n.note_type}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(n.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {n.doctor_name || 'Staff'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.note_text}</p>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No notes yet. Add the first progress note above.</p>
                  )}
                </div>
              </div>

              {/* AI DISCHARGE SUMMARY PREVIEW */}
              {data?.dischargeSummary && (
                <div style={{ padding: '32px', borderRadius: '28px', border: '1px solid #ddd6fe', background: 'linear-gradient(to bottom, #ffffff, #f5f3ff)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sparkles size={22} /> AI Discharge Summary (Draft)
                    </h3>
                    <span style={{ fontSize: '11px', background: '#ddd6fe', color: '#5b21b6', padding: '4px 10px', borderRadius: '12px', fontWeight: 900 }}>PROPOSED</span>
                  </div>
                  <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid #e2e8f0', color: '#334155', lineHeight: 1.8, fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                    {data.dischargeSummary.summary_text}
                  </div>
                  <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <button onClick={() => navigate('/tenant/ipd/discharge')} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>
                      Go to Discharge Hub to Finalize →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Billing Summary */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '32px' }}>
              <div style={{ background: '#0f172a', padding: '28px', borderRadius: '28px', color: 'white' }}>
                <h3 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 800 }}>💰 Billing Estimate</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Daily Charge</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrencyFixed(adm.daily_charge, 0)}/day</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Length of Stay</span>
                    <span style={{ fontWeight: 700 }}>{los} day{los !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>Bed Charges</span>
                    <span style={{ fontWeight: 900, fontSize: '22px', color: '#10b981' }}>{formatCurrencyFixed(los * Number(adm.daily_charge), 0)}</span>
                  </div>
                </div>
                <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 16px' }}>+ Lab, Pharmacy & clinical charges to be added at discharge</p>
                {((localStorage.getItem("role") || "").toLowerCase() !== "doctor") && (
                  <button
                    onClick={() => navigate('/billing', { state: { billType: 'IPD', totalAmount: los * Number(adm.daily_charge), patientName: adm.patient_name, encounterId: adm.encounter_id } })}
                    style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    View Detailed Bill
                  </button>
                )}
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 800 }}>Quick Actions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => setShowLabModal(true)} style={{ padding: '12px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FlaskConical size={18} /> Order Lab Test
                  </button>
                  <button onClick={() => setShowPharmacyModal(true)} style={{ padding: '12px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Pill size={18} /> Pharmacy Order
                  </button>
                  <button onClick={() => setShowServiceModal(true)} style={{ padding: '12px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={18} /> Post Service Charge
                  </button>
                  <button onClick={generateAISummary} disabled={isGeneratingSummary} style={{ padding: '12px', background: '#fdf4ff', color: '#86198f', border: '1px solid #fae8ff', borderRadius: '12px', fontWeight: 700, cursor: isGeneratingSummary ? 'not-allowed' : 'pointer', opacity: isGeneratingSummary ? 0.7 : 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={18} /> {isGeneratingSummary ? 'Generating...' : 'Generate AI Summary'}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Service Posting Modal */}
        {showServiceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', width: '100%', maxWidth: '440px', borderRadius: '28px', padding: '32px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap style={{ color: '#f59e0b' }} /> Service Posting
                </h2>
                <button onClick={() => setShowServiceModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>SERVICE DESCRIPTION</label>
                  <input 
                    placeholder="e.g. Special Nursing Fee, Oxygen..."
                    className="input-field" 
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    value={serviceForm.description}
                    onChange={e => setServiceForm({...serviceForm, description: e.target.value})}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
                   <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>UNIT PRICE (₹)</label>
                    <input 
                      type="number"
                      className="input-field" 
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={serviceForm.amount}
                      onChange={e => setServiceForm({...serviceForm, amount: e.target.value})}
                    />
                   </div>
                   <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>QTY</label>
                    <input 
                      type="number"
                      className="input-field" 
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      value={serviceForm.quantity}
                      onChange={e => setServiceForm({...serviceForm, quantity: e.target.value})}
                    />
                   </div>
                </div>
                
                <button 
                  onClick={submitServiceCharge} 
                  disabled={!serviceForm.description || !serviceForm.amount}
                  style={{ width: '100%', marginTop: '12px', padding: '16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}
                >
                  POST TO BILL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discharge Confirm Modal */}
        {showDischargeConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '28px', maxWidth: '440px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚪</div>
              <h2 style={{ fontWeight: 900, marginBottom: '12px' }}>Confirm Discharge</h2>
              <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: '28px' }}>
                This will discharge <strong>{adm?.patient_name}</strong>, free the bed, and calculate the final bill. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowDischargeConfirm(false)} style={{ flex: 1, padding: '14px', border: '1px solid #e2e8f0', borderRadius: '14px', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDischarge} style={{ flex: 1, padding: '14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>Discharge</button>
              </div>
            </div>
          </div>
        )}
        {/* Lab Order Modal */}
        {showLabModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', width: '100%', maxWidth: '600px', borderRadius: '28px', padding: '32px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FlaskConical style={{ color: '#10b981' }} /> Direct Lab Requisition
                </h2>
                <button onClick={() => setShowLabModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X /></button>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {diagnostics.map(d => (
                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: selectedTests.includes(d.id) ? '#f0fdf4' : '#f8fafc', borderRadius: '12px', border: `1px solid ${selectedTests.includes(d.id) ? '#10b981' : '#f1f5f9'}`, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedTests.includes(d.id)} 
                      onChange={() => selectedTests.includes(d.id) ? setSelectedTests(selectedTests.filter(id => id !== d.id)) : setSelectedTests([...selectedTests, d.id])} 
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{d.name}</span>
                  </label>
                ))}
              </div>
              <button 
                onClick={submitLabOrder} 
                disabled={isOrdering || selectedTests.length === 0}
                style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}
              >
                {isOrdering ? 'PLACING ORDER...' : `SEND ${selectedTests.length} TEST REQUISITIONS`}
              </button>
            </div>
          </div>
        )}

        {/* Pharmacy Order Modal */}
        {showPharmacyModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', width: '100%', maxWidth: '700px', borderRadius: '28px', padding: '32px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Pill style={{ color: '#3b82f6' }} /> IPD Medication Order
                </h2>
                <button onClick={() => setShowPharmacyModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X /></button>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <select 
                  className="input-field" 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px' }}
                  onChange={(e) => {
                    const m = medicines.find(med => med.id === e.target.value);
                    if (m) setPrescriptions([...prescriptions, { medicine_id: m.id, name: m.name, dosage: '1 Tab', frequency: '1-0-1', duration: '5 Days' }]);
                  }}
                >
                  <option value="">Search & Add Medicine...</option>
                  {medicines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.composition})</option>)}
                </select>
              </div>

              <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '24px' }}>
                {prescriptions.map((p, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 40px', gap: '10px', alignItems: 'center', padding: '12px', background: 'var(--app-bg)', borderRadius: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{p.name}</span>
                    <input className="input-field" placeholder="Dosage" value={p.dosage} onChange={e => { const np = [...prescriptions]; np[i].dosage = e.target.value; setPrescriptions(np); }} />
                    <input className="input-field" placeholder="Freq" value={p.frequency} onChange={e => { const np = [...prescriptions]; np[i].frequency = e.target.value; setPrescriptions(np); }} />
                    <input className="input-field" placeholder="Dur" value={p.duration} onChange={e => { const np = [...prescriptions]; np[i].duration = e.target.value; setPrescriptions(np); }} />
                    <button onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                ))}
                {prescriptions.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No medications added yet.</p>}
              </div>

              <button 
                onClick={submitPharmacyOrder} 
                disabled={isOrdering || prescriptions.length === 0}
                style={{ width: '100%', padding: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}
              >
                {isOrdering ? 'PLACING ORDER...' : `SEND ${prescriptions.length} MEDICINE ORDERS`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
