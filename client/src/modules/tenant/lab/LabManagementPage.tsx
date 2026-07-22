import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  FlaskConical, 
  Beaker, 
  ClipboardCheck, 
  Send, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  Plus,
  Trash2,
  FileText,
  Printer
} from 'lucide-react';
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

const STATUS_FLOW = [
  { id: 'Pending', label: 'Order Received', color: '#64748b', bg: '#f1f5f9', icon: Clock },
  { id: 'Sample Collected', label: 'Sample Collected', color: '#3b82f6', bg: '#eff6ff', icon: Beaker },
  { id: 'In Progress', label: 'Analysis In-Progress', color: '#f59e0b', bg: '#fffbeb', icon: FlaskConical },
  { id: 'Completed', label: 'Result Authorized', color: '#10b981', bg: '#ecfdf5', icon: ClipboardCheck },
  { id: 'Published', label: 'Report Published', color: '#8b5cf6', bg: '#f5f3ff', icon: Send }
];

export default function LabManagementPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'queue' | 'active' | 'completed'>('queue');
  
  // Results form
  const [testResults, setTestResults] = useState<{ param: string, value: string, unit: string, normalRange: string }[]>([
    { param: '', value: '', unit: '', normalRange: '' }
  ]);
  const [technicianNote, setTechnicianNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrders = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/lab/orders`, { headers });
      setOrders(res.data);
      // Auto-update activeOrder details if open
      if (activeOrder) {
        const freshOrder = res.data.find((o: any) => o.id === activeOrder.id);
        if (freshOrder) {
          setActiveOrder(freshOrder);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleOrderSelect = (order: any) => {
    setActiveOrder(order);
    const status = (order.status || 'Pending').toLowerCase();
    
    // Determine step based on status
    if (status === 'pending') setWizardStep(1);
    else if (status === 'sample collected') setWizardStep(2);
    else if (status === 'in progress') setWizardStep(3);
    else if (status === 'completed' || status === 'authorized') setWizardStep(4);
    else if (status === 'published') setWizardStep(5);
    else setWizardStep(1);

    // Initialize results if they exist
    if (order.results) {
      try {
        const parsedResults = typeof order.results === 'string' ? JSON.parse(order.results) : order.results;
        if (Array.isArray(parsedResults)) setTestResults(parsedResults);
      } catch (e) {
        setTestResults([{ param: '', value: '', unit: '', normalRange: '' }]);
      }
    } else {
      setTestResults([{ param: '', value: '', unit: '', normalRange: '' }]);
    }
    setTechnicianNote(order.technician_notes || "");
  };

  const updateStatus = async (status: string) => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.put(`${API_BASE}/api/hospital/lab/orders/${activeOrder.id}/status`, { status }, { headers });
      fetchOrders();
      setActiveOrder({ ...activeOrder, status });
    } catch (err) { alert("Failed to update status"); }
  };

  const moveToNextStep = async () => {
    if (wizardStep === 1) {
      await updateStatus('Sample Collected');
      setWizardStep(2);
    } else if (wizardStep === 2) {
      await updateStatus('In Progress');
      setWizardStep(3);
    } else if (wizardStep === 3) {
      // Validate results before moving
      if (testResults.some(r => !r.param || !r.value)) {
        alert("Please fill all test parameters and values.");
        return;
      }
      setWizardStep(4);
    }
  };

  const submitFinalResults = async () => {
    setIsSubmitting(true);
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.post(`${API_BASE}/api/hospital/lab/orders/${activeOrder.id}/results`, { 
        results: testResults,
        technicianNote 
      }, { headers });
      
      await fetchOrders();
      setWizardStep(5);
    } catch (err) { 
      alert("Failed to submit results"); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishAndBill = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.post(`${API_BASE}/api/hospital/lab/orders/${activeOrder.id}/publish`, {}, { headers });
      alert("Report published successfully!");
      
      const role = (localStorage.getItem("role") || "").toLowerCase();
      const canBill = role !== "doctor";
      
      if (canBill && window.confirm("Would you like to proceed to billing for this patient?")) {
        navigate('/billing', { state: { 
          billType: 'LAB', 
          totalAmount: Number(activeOrder.price || 0),
          patientName: activeOrder.patient_name,
          patientId: activeOrder.patient_id,
          encounterId: activeOrder.encounter_id,
          labOrderId: activeOrder.id
        } });
      } else {
        setActiveOrder(null);
        fetchOrders();
      }
    } catch (err) { alert("Failed to publish report"); }
  };

  const filteredOrders = orders.filter(o => {
    const status = (o.status || 'Pending').toLowerCase();
    if (activeTab === 'queue') return status === 'pending';
    if (activeTab === 'active') return ['sample collected', 'in progress'].includes(status);
    if (activeTab === 'completed') return ['completed', 'authorized', 'published'].includes(status);
    return false;
  });

  const stats = {
    urgent: orders.filter(o => o.priority === 'Urgent' && (o.status || '').toLowerCase() !== 'published').length,
    pending: orders.filter(o => (o.status || 'Pending').toLowerCase() === 'pending').length,
    active: orders.filter(o => ['sample collected', 'in progress'].includes((o.status || '').toLowerCase())).length,
    completed: orders.filter(o => ['completed', 'authorized', 'published'].includes((o.status || '').toLowerCase())).length
  };

  if (activeOrder) {
    return (
      <div className="dashboard-layout print-document">
        <style>{`
          @media print {
            .no-print, .wizard-step-content, .flex-responsive, sidebar, header, nav, button, .wizard-back-btn, .dashboard-layout > div:first-child {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            body {
              background: white !important;
              color: black !important;
            }
            .dashboard-layout {
              display: block !important;
              background: white !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
            .printable-content {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
          .print-only {
            display: none;
          }
        `}</style>

        <div className="no-print">
          <Sidebar />
        </div>
        
        <main className="main-content" style={{ background: 'var(--app-bg)' }}>
          <div className="no-print" style={{ padding: '24px 16px' }}>
            {/* Wizard Header */}
            <div className="flex-responsive" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={() => setActiveOrder(null)}
                  style={{ background: 'white', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Diagnostic Processing Unit</p>
                  <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '14px', fontWeight: 500 }}>Fulfilling: <span style={{ fontWeight: 800, color: '#3b82f6' }}>{activeOrder.test_name}</span></p>
                </div>
              </div>
            </div>

            {/* Stepper - Scrollable on mobile */}
            <div style={{ overflowX: 'auto', paddingBottom: '20px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', width: '100%', minWidth: '600px' }}>
                <div style={{ position: 'absolute', top: '24px', left: '0', right: '0', height: '2px', background: '#e2e8f0', zIndex: 0 }}></div>
                <div style={{ position: 'absolute', top: '24px', left: '0', width: `${(wizardStep - 1) * 25}%`, height: '2px', background: '#3b82f6', zIndex: 0, transition: 'width 0.3s' }}></div>
                
                {[
                  { step: 1, label: 'Accessioning', icon: ClipboardCheck },
                  { step: 2, label: 'Collection', icon: Beaker },
                  { step: 3, label: 'Analysis', icon: FlaskConical },
                  { step: 4, label: 'Authorization', icon: CheckCircle2 },
                  { step: 5, label: 'Published', icon: Send }
                ].map(s => (
                  <div key={s.step} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', background: wizardStep >= s.step ? '#3b82f6' : 'white', 
                      border: wizardStep >= s.step ? 'none' : '2px solid #e2e8f0', color: wizardStep >= s.step ? 'white' : '#94a3b8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: wizardStep === s.step ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
                      transition: 'all 0.3s'
                    }}>
                      <s.icon size={16} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: wizardStep >= s.step ? '#0f172a' : '#94a3b8' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wizard Content */}
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            
            {/* Print Only Lab Report */}
            <div className="print-only" style={{ fontFamily: 'Inter, sans-serif', padding: '20px', color: '#000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #0f172a', paddingBottom: '15px', marginBottom: '25px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>PALMTREE DIAGNOSTICS</h1>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>Standard Clinical Laboratories & Research Center</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#3b82f6' }}>DIAGNOSTIC REPORT</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>Order ID: #{activeOrder?.id?.substring(0,8).toUpperCase()}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px', background: 'var(--app-bg)', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#64748b', fontWeight: 800 }}>PATIENT INFORMATION</p>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>{activeOrder?.patient_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#334155' }}>MRN: {activeOrder?.mrn || 'N/A'} | {activeOrder?.gender} | {activeOrder?.age} Years</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#64748b', fontWeight: 800 }}>ORDER DETAILS</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Prescribed By: Dr. {activeOrder?.doctor_name || 'System'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#334155' }}>Ordered Date: {activeOrder?.created_at ? new Date(activeOrder.created_at).toLocaleDateString() : 'N/A'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 800, color: activeOrder?.is_paid ? '#16a34a' : '#d97706' }}>
                    Payment Status: {activeOrder?.is_paid ? 'PAID' : 'PAYMENT PENDING'}
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  Investigation: {activeOrder?.test_name}
                </h3>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '11px', fontWeight: 800 }}>TEST PARAMETER</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '11px', fontWeight: 800 }}>OBSERVED VALUE</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '11px', fontWeight: 800 }}>NORMAL RANGE</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '11px', fontWeight: 800 }}>UNIT</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults?.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', fontSize: '12px', fontWeight: 700 }}>{r.param || 'N/A'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{r.value || 'N/A'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', color: '#475569' }}>{r.normalRange || 'N/A'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>{r.unit || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {technicianNote && (
                <div style={{ marginBottom: '30px', background: 'var(--app-bg)', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 800, color: '#64748b' }}>TECHNICIAN REMARKS</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontStyle: 'italic' }}>{technicianNote}</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', paddingTop: '15px', borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>Prepared By</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>Lab Technician</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>Authorized Signatory</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>Pathologist</p>
                </div>
              </div>
            </div>

            <div className="printable-content" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)' }}>
              
              {wizardStep === 1 && (
                <div className="wizard-step-content animate-in">
                  <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '64px', height: '64px', background: '#eff6ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#3b82f6' }}>
                      <ClipboardCheck size={32} />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 900 }}>Order Validation</h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Verify patient identification and billing status.</p>
                  </div>

                  <div className="grid-responsive" style={{ gridTemplateColumns: '1fr 1fr', background: 'var(--app-bg)', padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Patient & Encounter</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}><User size={16} color="#64748b" /></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px' }}>{activeOrder.patient_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>MRN: {activeOrder.mrn || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Investigation Details</h4>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>{activeOrder.test_name}</div>
                      <span style={{ fontSize: '10px', fontWeight: 900, background: activeOrder.priority === 'Urgent' ? '#fee2e2' : '#f1f5f9', color: activeOrder.priority === 'Urgent' ? '#ef4444' : '#64748b', padding: '2px 8px', borderRadius: '6px' }}>{activeOrder.priority?.toUpperCase()}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
                      {!activeOrder.is_paid ? (
                        <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '16px', border: '1px solid #fef3c7', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                           <AlertCircle size={20} color="#f59e0b" />
                           <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Awaiting Payment Collection.</div>
                           <button onClick={fetchOrders} style={{ padding: '8px 16px', background: 'white', border: '1px solid #d97706', borderRadius: '12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#d97706' }}>Check Status</button>
                           {((localStorage.getItem("role") || "").toLowerCase() !== "doctor") && (
                              <button onClick={() => navigate('/billing', { state: { labOrderId: activeOrder.id } })} className="button-primary" style={{ background: '#f59e0b', padding: '8px 16px' }}>Go to Billing</button>
                           )}
                        </div>
                     ) : (
                        <button onClick={moveToNextStep} className="wizard-next-btn">
                          Proceed <ChevronRight size={18} />
                        </button>
                     )}
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="wizard-step-content animate-in">
                  <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '80px', height: '80px', background: '#eff6ff', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#3b82f6' }}>
                      <Beaker size={40} />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Sample Collection</h3>
                    <p style={{ color: '#64748b' }}>Confirm that the required biological samples have been successfully collected.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                     <div style={{ background: '#f0f9ff', padding: '24px', borderRadius: '20px', border: '1px solid #bae6fd' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Sample Requirements</h4>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                           <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>
                              <CheckCircle2 size={16} /> Standard Container (EDTA/Vial)
                           </li>
                           <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>
                              <CheckCircle2 size={16} /> Barcode Labelling Required
                           </li>
                        </ul>
                     </div>
                     <div style={{ background: 'var(--app-bg)', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800 }}>Technician Checklist</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                           <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                              <input type="checkbox" defaultChecked /> Verify Patient Identity (Double)
                           </label>
                           <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                              <input type="checkbox" defaultChecked /> Confirm Sample Quality
                           </label>
                        </div>
                     </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button onClick={() => setWizardStep(1)} className="wizard-back-btn">Back</button>
                    <button onClick={moveToNextStep} className="wizard-next-btn">
                      Confirm Collection & Start Analysis <FlaskConical size={20} />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="wizard-step-content animate-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                      <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Analytical Findings</h3>
                      <p style={{ color: '#64748b', margin: '4px 0 0' }}>Record technical parameters and clinical observations.</p>
                    </div>
                    <button 
                      onClick={() => setTestResults([...testResults, { param: '', value: '', unit: '', normalRange: '' }])}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                    >
                      <Plus size={18} /> Add Parameter
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                    {testResults.map((res, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 48px', gap: '12px', alignItems: 'center', background: 'var(--app-bg)', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>PARAMETER</label>
                          <input 
                            placeholder="e.g. Hemoglobin" 
                            value={res.param} 
                            onChange={e => {
                              const n = [...testResults]; n[idx].param = e.target.value; setTestResults(n);
                            }} 
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>VALUE</label>
                          <input 
                            placeholder="0.0" 
                            value={res.value} 
                            onChange={e => {
                              const n = [...testResults]; n[idx].value = e.target.value; setTestResults(n);
                            }} 
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>UNIT</label>
                          <input 
                            placeholder="g/dL" 
                            value={res.unit} 
                            onChange={e => {
                              const n = [...testResults]; n[idx].unit = e.target.value; setTestResults(n);
                            }} 
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>NORMAL RANGE</label>
                          <input 
                            placeholder="12 - 16" 
                            value={res.normalRange} 
                            onChange={e => {
                              const n = [...testResults]; n[idx].normalRange = e.target.value; setTestResults(n);
                            }} 
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }} 
                          />
                        </div>
                        <button 
                          onClick={() => {
                            if (testResults.length > 1) {
                              const n = [...testResults]; n.splice(idx, 1); setTestResults(n);
                            }
                          }}
                          style={{ alignSelf: 'flex-end', height: '40px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: '32px' }}>
                     <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Clinical Technician Observations</label>
                     <textarea 
                        placeholder="Note any abnormalities, sample quality issues, or clinical findings..."
                        style={{ width: '100%', padding: '16px', borderRadius: '20px', border: '1px solid #e2e8f0', height: '120px', fontSize: '14px', outline: 'none' }}
                        value={technicianNote}
                        onChange={e => setTechnicianNote(e.target.value)}
                     />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button onClick={() => setWizardStep(2)} className="wizard-back-btn">Back</button>
                    <button onClick={moveToNextStep} className="wizard-next-btn">
                      Review & Authorize Report <ClipboardCheck size={20} />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="wizard-step-content animate-in">
                  <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '80px', height: '80px', background: '#ecfdf5', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#10b981' }}>
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Technical Validation</h3>
                    <p style={{ color: '#64748b' }}>Final review of test findings before report authorization.</p>
                  </div>

                  <div style={{ background: 'var(--app-bg)', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>PARAMETER</th>
                              <th style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>VALUE / UNIT</th>
                              <th style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>NORMAL RANGE</th>
                              <th style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>STATUS</th>
                           </tr>
                        </thead>
                        <tbody>
                           {testResults.map((r, i) => (
                             <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{r.param}</td>
                                <td style={{ padding: '12px', fontWeight: 800, color: '#3b82f6' }}>{r.value} <span style={{ fontSize: '11px', color: '#64748b' }}>{r.unit}</span></td>
                                <td style={{ padding: '12px', fontWeight: 600, color: '#64748b' }}>{r.normalRange}</td>
                                <td style={{ padding: '12px' }}><CheckCircle2 size={16} color="#10b981" /></td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                     {technicianNote && (
                       <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Technician Notes</div>
                          <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600, fontStyle: 'italic' }}>"{technicianNote}"</div>
                       </div>
                     )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button onClick={() => setWizardStep(3)} className="wizard-back-btn">Modify Findings</button>
                    <button 
                      onClick={() => window.print()}
                      className="no-print"
                      style={{ padding: '16px 32px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Printer size={18} /> Print Report
                    </button>
                    <button onClick={submitFinalResults} disabled={isSubmitting} className="wizard-next-btn" style={{ background: '#10b981' }}>
                      {isSubmitting ? 'AUTHORIZING...' : 'AUTHORIZE & PUBLISH'} <Send size={20} />
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="wizard-step-content animate-in">
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ width: '100px', height: '100px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', border: '1px solid #dcfce7' }}>
                      <div style={{ width: '70px', height: '70px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <CheckCircle2 size={40} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>Workflow Complete!</h3>
                    <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '12px auto 40px' }}>The diagnostic findings have been authorized and are ready for publishing to the patient portal.</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                      <button 
                        onClick={() => window.print()}
                        className="no-print"
                        style={{ padding: '16px 32px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Printer size={18} /> Print Report
                      </button>
                      <button onClick={publishAndBill} className="wizard-next-btn" style={{ background: '#0f172a', padding: '16px 48px' }}>
                         Finalize & Publish Report
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>

        <style>{`
          .wizard-step-content { animation: fadeIn 0.4s ease-out; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          
          .wizard-next-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 32px;
            background: #3b82f6;
            color: white;
            border: none;
            borderRadius: 16px;
            font-weight: 900;
            font-size: 15px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
          }
          .wizard-next-btn:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.4); }
          .wizard-next-btn:active { transform: translateY(0); }
          
          .wizard-back-btn {
            padding: 16px 32px;
            background: #f1f5f9;
            color: #64748b;
            border: none;
            borderRadius: 16px;
            font-weight: 800;
            font-size: 15px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .wizard-back-btn:hover { background: #e2e8f0; color: #0f172a; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-layout print-document">
      <Sidebar />
      <main className="main-content">
        <Header title="Diagnostics Command Center" />

        <div style={{ padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#eef2ff', color: '#6366f1', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.1)' }}>
              <Beaker size={24} />
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Live monitoring of clinical investigation orders, accessioning milestones, and result authorization.</p>
          </div>
          {/* Real-time Stats Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              <div className="stat-card" style={{ background: stats.urgent > 0 ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : 'white', padding: '24px', borderRadius: '24px', border: `1px solid ${stats.urgent > 0 ? '#ef4444' : '#e2e8f0'}`, position: 'relative', overflow: 'hidden' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, color: stats.urgent > 0 ? '#b91c1c' : '#64748b', textTransform: 'uppercase' }}>Critical / Urgent</p>
                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: stats.urgent > 0 ? '#ef4444' : '#0f172a' }}>{stats.urgent}</h3>
                {stats.urgent > 0 && <div className="pulse" style={{ position: 'absolute', top: '16px', right: '16px', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></div>}
              </div>
              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Awaiting Collection</p>
                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#3b82f6' }}>{stats.pending}</h3>
              </div>
              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Active In Lab</p>
                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#f59e0b' }}>{stats.active}</h3>
              </div>
              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Awaiting Auth</p>
                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#10b981' }}>{stats.completed}</h3>
              </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '16px' }}>
                {[
                  { id: 'queue', label: 'Order Queue', count: stats.pending },
                  { id: 'active', label: 'In-Progress', count: stats.active },
                  { id: 'completed', label: 'Completed', count: stats.completed }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{ 
                      padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                      background: activeTab === tab.id ? 'white' : 'transparent',
                      color: activeTab === tab.id ? '#0f172a' : '#64748b',
                      boxShadow: activeTab === tab.id ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    {tab.label}
                    <span style={{ fontSize: '11px', background: activeTab === tab.id ? '#eff6ff' : '#e2e8f0', color: activeTab === tab.id ? '#3b82f6' : '#64748b', padding: '2px 8px', borderRadius: '8px' }}>{tab.count}</span>
                  </button>
                ))}
             </div>
             
             <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => fetchOrders()} style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', color: '#64748b' }}>Refresh Queue</button>
                <button onClick={() => navigate('/tenant/lab/ai')} style={{ padding: '10px 20px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>AI Report Assistant <Beaker size={16} /></button>
             </div>
          </div>

          <div style={{ background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Clinical Order ID</th>
                    <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Patient Information</th>
                    <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Investigation Details</th>
                    <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Current Milestone</th>
                    <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Workflow</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o: any, i: number) => {
                    const statusCfg = STATUS_FLOW.find(s => s.id.toLowerCase() === (o.status || 'Pending').toLowerCase()) || STATUS_FLOW[0];
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="table-row-hover">
                        <td style={{ padding: '24px 32px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><FileText size={18} /></div>
                              <div>
                                 <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>#{o.id.substring(0,8).toUpperCase()}</div>
                                 <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>{new Date(o.created_at).toLocaleDateString()}</div>
                              </div>
                           </div>
                        </td>
                        <td style={{ padding: '24px 32px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{o.patient_name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>MRN: {o.mrn || 'WALK-IN'}</div>
                        </td>
                        <td style={{ padding: '24px 32px' }}>
                          <div style={{ fontWeight: 800, color: '#1e293b' }}>{o.test_name}</div>
                          <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700 }}>By Dr. {o.doctor_name || 'System'}</div>
                        </td>
                        <td style={{ padding: '24px 32px' }}>
                           <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                              {o.priority === 'Urgent' && <span style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>URGENT</span>}
                              {o.is_paid ? <span style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px' }}>PAID</span> : <span style={{ fontSize: '10px', fontWeight: 900, color: '#f59e0b', background: '#fffbeb', padding: '2px 8px', borderRadius: '6px' }}>AWAITING PAYMENT</span>}
                           </div>
                           <span style={{ 
                             fontSize: '11px', fontWeight: 900, color: statusCfg.color, background: statusCfg.bg, 
                             padding: '4px 12px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px'
                           }}>
                             <statusCfg.icon size={12} /> {o.status?.toUpperCase() || 'PENDING'}
                           </span>
                        </td>
                        <td style={{ padding: '24px 32px', textAlign: 'right' }}>
                           <button 
                             onClick={() => handleOrderSelect(o)}
                             style={{ 
                               padding: '12px 24px', background: o.is_paid ? '#0f172a' : '#f1f5f9', color: o.is_paid ? 'white' : '#94a3b8', 
                               border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '12px', cursor: o.is_paid ? 'pointer' : 'default',
                               display: 'inline-flex', alignItems: 'center', gap: '8px'
                             }}
                           >
                              OPEN WIZARD <ChevronRight size={16} />
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && !loading && (
                    <tr><td colSpan={5} style={{ padding: '100px', textAlign: 'center', color: '#94a3b8', fontSize: '15px', fontWeight: 600 }}>No active diagnostic orders found in this milestone.</td></tr>
                  )}
                </tbody>
             </table>
          </div>
        </div>
      </main>

      <style>{`
        .table-row-hover:hover { background: var(--app-bg) !important; }
        .stat-card { transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-5px); }
        .pulse { animation: pulse-red 2s infinite; }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      `}</style>
    </div>
  );
}
