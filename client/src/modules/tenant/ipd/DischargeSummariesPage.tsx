import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { CheckCircle2, FileEdit, Printer, X, Sparkles, ShieldCheck } from 'lucide-react';

export default function DischargeSummariesPage() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [activeSummary, setActiveSummary] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const fetchSummaries = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/ipd/discharges`, { headers });
      setSummaries(res.data);
    } catch (err) { console.error(err); }
  };

  const printSummary = () => {
    window.print();
  };

  const handleUpdate = async (authenticate = false) => {
    if (!activeSummary) return;
    setIsSaving(true);
    try {
      await axios.put(`${API_BASE}/api/hospital/ipd/discharges/${activeSummary.id}`, {
        summary_text: editedText,
        is_authenticated: authenticate
      }, { headers });
      
      showToast(authenticate ? "Summary Authenticated & Published!" : "Changes saved successfully.", "success");
      setIsEditing(false);
      fetchSummaries();
      setActiveSummary({ ...activeSummary, summary_text: editedText, is_authenticated: authenticate, status: authenticate ? 'Authenticated' : activeSummary.status });
    } catch (err) {
      showToast("Failed to update summary.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const openSummary = (s: any) => {
    setActiveSummary(s);
    setEditedText(s.summary_text || "");
    setIsEditing(false);
  };

  return (
    <div className="dashboard-layout print-document">
      <Sidebar />
      <main className="main-content">
        <Header title="Discharge Summaries Hub" />
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#fef2f2', color: '#dc2626', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.1)' }}>
            <FileEdit size={24} />
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Documentation Center</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Review, authenticate, and finalize centralized patient clinical discharge records and summaries.</p>
        </div>

        <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9' }}>
              <tr>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>PATIENT / MRN</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>DISCHARGE DATE</th>
                 <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>DOCTOR</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>TYPE</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>STATUS</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {summaries.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No discharge records found for current period.</td></tr>
              ) : summaries.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>{s.patient_name}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>MRN: {s.mrn}</p>
                  </td>
                  <td style={{ padding: '20px 24px', fontWeight: 600 }}>{new Date(s.discharge_date).toLocaleDateString()}</td>
                  <td style={{ padding: '20px 24px', fontWeight: 600 }}>Dr. {s.doctor_name}</td>
                   <td style={{ padding: '20px 24px' }}>
                     <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 900 }}>{s.discharge_type || 'STANDARD'}</span>
                  </td>
                   <td style={{ padding: '20px 24px' }}>
                     <span style={{ 
                       fontSize: '10px', 
                       background: s.is_authenticated ? '#dcfce7' : '#fef2f2', 
                       color: s.is_authenticated ? '#166534' : '#991b1b',
                       padding: '4px 8px', borderRadius: '6px', fontWeight: 900 
                     }}>
                       {s.is_authenticated ? 'AUTHENTICATED' : 'DRAFT'}
                     </span>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <button onClick={() => openSummary(s)} style={{ padding: '10px 18px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <FileEdit size={16} /> Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeSummary && (
          <div className="print-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
             <div className="print-document" style={{ width: '840px', maxHeight: '92vh', overflowY: 'auto', background: 'white', borderRadius: '28px', padding: '48px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', position: 'relative' }}>
              
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setActiveSummary(null)} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
                  <h3 style={{ margin: 0, fontWeight: 900 }}>Discharge Record</h3>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {activeSummary.is_authenticated ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 800, fontSize: '14px', background: '#dcfce7', padding: '8px 16px', borderRadius: '10px' }}>
                      <CheckCircle2 size={18} /> Authenticated
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsEditing(!isEditing)} 
                        style={{ padding: '10px 20px', border: '1px solid #3b82f6', background: isEditing ? '#eff6ff' : 'white', color: '#3b82f6', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <FileEdit size={18} /> {isEditing ? 'Discard Edits' : 'Edit Summary'}
                      </button>
                      <button 
                        disabled={isSaving}
                        onClick={() => handleUpdate(true)} 
                        style={{ padding: '10px 24px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 15px rgba(16,185,129,0.2)' }}
                      >
                        <ShieldCheck size={18} /> {isSaving ? 'Authenticating...' : 'Authenticate & Publish'}
                      </button>
                    </>
                  )}
                  <button onClick={printSummary} style={{ padding: '10px 18px', border: 'none', background: '#0f172a', color: 'white', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Printer size={18} /> Print</button>
                </div>
              </div>

              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '24px', marginBottom: '32px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 950, color: '#0f172a', letterSpacing: '-0.5px' }}>Hospital Discharge Summary</h1>
                <p style={{ margin: '8px 0 0', color: '#64748b', fontWeight: 700, fontSize: '15px' }}>{localStorage.getItem("tenantName") || "Palmtree Wellness Hospital"}</p>
                {activeSummary.discharge_type === 'AI_GENERATED' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '11px', fontWeight: 900, color: '#8b5cf6', background: '#f5f3ff', padding: '4px 12px', borderRadius: '20px', border: '1px solid #ddd6fe' }}>
                    <Sparkles size={12} /> PROPOSED BY CLINICAL AI
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '40px', background: 'var(--app-bg)', padding: '24px', borderRadius: '20px' }}>
                <div style={{ fontSize: '14px' }}><span style={{ color: '#64748b', fontWeight: 700 }}>PATIENT:</span> <span style={{ fontWeight: 900, color: '#0f172a' }}>{activeSummary.patient_name}</span></div>
                <div style={{ fontSize: '14px' }}><span style={{ color: '#64748b', fontWeight: 700 }}>MRN:</span> <span style={{ fontWeight: 900, color: '#0f172a' }}>{activeSummary.mrn}</span></div>
                <div style={{ fontSize: '14px' }}><span style={{ color: '#64748b', fontWeight: 700 }}>DISCHARGE:</span> <span style={{ fontWeight: 900, color: '#0f172a' }}>{new Date(activeSummary.discharge_date).toLocaleString()}</span></div>
                <div style={{ fontSize: '14px' }}><span style={{ color: '#64748b', fontWeight: 700 }}>DOCTOR:</span> <span style={{ fontWeight: 900, color: '#0f172a' }}>Dr. {activeSummary.doctor_name || 'Not assigned'}</span></div>
              </div>

              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Clinical Course & Summary</h2>
                  {isEditing && <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700 }}>EDITING MODE</span>}
                </div>
                
                {isEditing ? (
                  <div>
                    <textarea 
                      style={{ width: '100%', height: '400px', padding: '20px', borderRadius: '16px', border: '2px solid #3b82f6', fontSize: '15px', lineHeight: 1.7, outline: 'none' }}
                      value={editedText}
                      onChange={e => setEditedText(e.target.value)}
                    />
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                      <button onClick={() => handleUpdate(false)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>Save Draft</button>
                      <button onClick={() => setIsEditing(false)} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#334155', fontSize: '15px' }}>
                    {activeSummary.summary_text || 'Discharge summary details are not available yet.'}
                  </p>
                )}
              </section>

              {activeSummary.is_authenticated && (
                <div style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0', textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', textAlign: 'center' }}>
                     <p style={{ margin: 0, fontWeight: 900, fontSize: '16px' }}>Dr. {activeSummary.doctor_name}</p>
                     <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Digitally Authenticated at {new Date(activeSummary.authenticated_at || activeSummary.discharge_date).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

              {activeSummary.pdf_path && (
                <p className="no-print" style={{ marginTop: '20px', color: '#64748b', fontSize: '12px' }}>Generated PDF path: {activeSummary.pdf_path}</p>
              )}
            </div>
          )}
      </main>
    </div>
  );
}
