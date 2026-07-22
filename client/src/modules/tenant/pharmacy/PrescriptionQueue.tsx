import { useEffect, useState } from "react";
import axios from "axios";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Pill } from 'lucide-react';


export default function PrescriptionQueue({ embedded = false }: { embedded?: boolean }) {

  const { showToast } = useToast();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [activePrescription, setActivePrescription] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const role = localStorage.getItem("role");
      const userId = localStorage.getItem("userId");
      const url = `${API_BASE}/api/hospital/pharmacy/prescriptions${role === 'doctor' || role === 'DOCTOR' ? `?doctorId=${userId}` : ''}`;
      const [preRes, invRes] = await Promise.all([
        axios.get(url, { headers }),
        axios.get(`${API_BASE}/api/hospital/pharmacy/inventory`, { headers })
      ]);
      setPrescriptions(preRes.data);
      setInventory(invRes.data);
    } catch (err) { console.error(err); }
  };

  const startDispensing = async (pres: any) => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/pharmacy/prescriptions/${pres.id}/items`, { headers });
      setActivePrescription({ ...pres, items: res.data });
      setSelectedItems(res.data.map((item: any) => ({
        drugId: item.medicine_id || inventory.find(i => i.drug_name === (item.medicine_name || item.drug_name))?.id,
        drugName: item.medicine_name || item.drug_name,
        quantity: 10,
        unitPrice: item.unit_price || inventory.find(i => i.drug_name === (item.medicine_name || item.drug_name))?.unit_price || 0
      })));
    } catch (err) { showToast("Failed to fetch prescription details", "error"); }
  };

  const confirmDispense = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.post(`${API_BASE}/api/hospital/pharmacy/dispense`, {
        encounterId: activePrescription.encounter_id,
        prescriptionId: activePrescription.id,
        items: selectedItems.filter(i => i.drugId)
      }, { headers });
      
      showToast("Medication dispensed & billing queue updated!", "success");
      setActivePrescription(null);
      fetchData();
    } catch (err: any) { 
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Dispensing failed.";
      showToast(msg, "error"); 
    }
  };

  const printPrescription = async (pres: any) => {
    // Fetch detailed items if not already fetched
    let items = pres.items;
    if (!items) {
      const headers = { 
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-tenant-id": localStorage.getItem("tenant") || ""
      };
      try {
        const res = await axios.get(`${API_BASE}/api/hospital/pharmacy/prescriptions/${pres.id}/items`, { headers });
        items = res.data;
      } catch (err) {
        showToast("Failed to fetch prescription details for printing", "error");
        return;
      }
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the prescription.");
      return;
    }

    const medRows = items.map((m: any, idx: number) => `
      <tr>
        <td style="font-weight: 700; padding: 12px; border-bottom: 1px solid #e2e8f0;">${idx + 1}. ${m.medicine_name || m.drug_name || 'Medicine'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.dosage || 'As directed'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.frequency || 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.duration || 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.instructions || ''}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <html>
        <head>
          <title>Prescription_${pres.patient_name || 'Patient'}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .hospital-title { font-size: 24px; font-weight: 800; color: #1e3a8a; }
            .hospital-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
            .doctor-info { text-align: right; }
            .doc-name { font-size: 16px; font-weight: 700; color: #1e293b; }
            .doc-sub { font-size: 12px; color: #64748b; }
            
            .patient-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: var(--app-bg); padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
            .info-item { font-size: 13px; color: #475569; }
            .info-label { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 2px; }
            
            .rx-symbol { font-size: 32px; font-weight: 800; color: #3b82f6; margin-bottom: 16px; font-family: 'Georgia', serif; }
            .med-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .med-table th { text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
            .med-table td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; }
            
            .notes-section { margin-bottom: 40px; }
            .notes-title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
            .notes-content { font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line; }
            
            .footer { margin-top: 100px; display: flex; justify-content: space-between; align-items: flex-end; }
            .sig-line { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 8px; font-size: 12px; color: #64748b; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="hospital-title">${localStorage.getItem("tenantName") || "PALMTREE CLINICS"}</div>
              <div class="hospital-sub">Integrated Health Management System</div>
            </div>
            <div class="doctor-info">
              <div class="doc-name">Dr. ${pres.doctor_name || 'Consultant'}</div>
              <div class="doc-sub">Attending Practitioner</div>
            </div>
          </div>
          
          <div class="patient-card">
            <div>
              <div class="info-label">Patient Name</div>
              <div class="info-item" style="font-weight: 700;">${pres.patient_name || ''}</div>
            </div>
            <div>
              <div class="info-label">MRN / ID</div>
              <div class="info-item">${pres.mrn || ''}</div>
            </div>
            <div>
              <div class="info-label">Age / Gender</div>
              <div class="info-item">${pres.age || 'N/A'} Y / ${pres.gender || 'N/A'}</div>
            </div>
            <div>
              <div class="info-label">Date</div>
              <div class="info-item">${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</div>
            </div>
          </div>
          
          <div class="rx-symbol">R<sub>x</sub></div>
          
          <table class="med-table">
            <thead>
              <tr>
                <th style="width: 35%;">Medicine Name</th>
                <th style="width: 15%;">Dosage</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 15%;">Duration</th>
                <th style="width: 20%;">Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${medRows}
            </tbody>
          </table>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div class="notes-section">
              <div class="notes-title">Diagnosis</div>
              <div class="notes-content" style="font-weight: 700;">${pres.diagnosis || 'Refer to patient record'}</div>
            </div>
            <div class="notes-section">
              <div class="notes-title">Clinical Findings & Advice</div>
              <div class="notes-content">${pres.notes || 'Fulfill prescription medications.'}</div>
            </div>
          </div>
          
          <div class="footer">
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Printed via HIMS Portal</div>
            </div>
            <div class="sig-line">
              Authorized Signature / Stamp
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className={embedded ? "" : "dashboard-layout"} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: embedded ? 'auto' : '100vh', background: 'var(--app-bg)' }}>
      {!embedded && <Sidebar />}
      <main className="main-content" style={{ flex: 1, padding: embedded ? '0' : isMobile ? '16px' : '32px', width: '100%' }}>
        {!embedded && <Header title="Clinical Prescription Queue" />}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#fffbeb', color: '#f59e0b', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.1)' }}>
            <Pill size={24} />
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Medication Fulfillment Command</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Real-time surveillance of clinical prescriptions, dispensing logistics, and inventory synchronization.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: (activePrescription && !isMobile) ? '1fr 450px' : '1fr', gap: '32px', alignItems: 'start' }}>
           {isMobile ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {prescriptions.map((p, i) => (
                 <div key={i} style={{ 
                   background: 'white', 
                   borderRadius: '24px', 
                   padding: '24px', 
                   border: '1px solid #e2e8f0',
                   boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: '16px'
                 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                     <div>
                       <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>{p.patient_name || 'Unknown Patient'}</div>
                       <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>{p.mrn}</div>
                     </div>
                     <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: p.status === 'Completed' ? '#10b981' : '#f59e0b', background: p.status === 'Completed' ? '#f0fdf4' : '#fffbeb', padding: '4px 10px', borderRadius: '20px' }}>
                          {p.status === 'Completed' ? 'DISPENSED' : 'PENDING'}
                        </span>
                     </div>
                   </div>

                   <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ fontWeight: 700, fontSize: '13px', color: '#475569' }}>{p.doctor_name || 'Staff'}</div>
                       <div style={{ fontSize: '11px', color: '#94a3b8' }}>General Medicine</div>
                     </div>
                     {!p.is_paid && <span style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', background: '#fef2f2', padding: '4px 8px', borderRadius: '8px' }}>UNBILLED</span>}
                   </div>

                   <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <button 
                         onClick={() => printPrescription(p)}
                         style={{ 
                           flex: 1,
                           padding: '14px', 
                           background: 'white', 
                           color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '12px', fontWeight: 800,
                           cursor: 'pointer'
                         }}
                       >
                          Print
                       </button>
                      <button 
                      onClick={() => startDispensing(p)}
                      disabled={p.status === 'Completed'}
                      style={{ 
                        width: '100%',
                        padding: '14px', 
                        background: p.status !== 'Completed' ? '#3b82f6' : '#94a3b8', 
                        color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800,
                        cursor: p.status === 'Completed' ? 'not-allowed' : 'pointer'
                      }}
                    >
                       {p.status === 'Completed' ? 'Dispensed ✓' : 'Start Dispensing'}
                    </button>
                    </div>
                 </div>
               ))}
               {prescriptions.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No pending prescriptions.</div>}
             </div>
           ) : (
             <div style={{ background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                   <tr style={{ textAlign: 'left', background: 'var(--app-bg)' }}>
                     <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Patient / MRN</th>
                     <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Prescribed By</th>
                     <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Status</th>
                     <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {prescriptions.length === 0 && (
                     <tr><td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>No pending prescriptions.</td></tr>
                   )}
                   {prescriptions.map((p, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                       <td style={{ padding: '20px 24px' }}>
                         <div style={{ fontWeight: 800, color: '#0f172a' }}>{p.patient_name || 'Unknown Patient'}</div>
                         <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>{p.mrn}</div>
                       </td>
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{p.doctor_name || 'Staff'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>General Medicine</div>
                       </td>
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: p.status === 'Completed' ? '#10b981' : '#f59e0b', background: p.status === 'Completed' ? '#f0fdf4' : '#fffbeb', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${p.status === 'Completed' ? '#dcfce7' : '#fef3c7'}` }}>
                              {p.status === 'Completed' ? 'DISPENSED' : 'PENDING'}
                            </span>
                            {p.is_paid ? (
                              <span style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', background: '#f0fdf4', padding: '4px 10px', borderRadius: '20px', border: '1px solid #dcfce7' }}>✓ BILLED</span>
                            ) : (
                              <span style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: '20px', border: '1px solid #fee2e2' }}>UNBILLED</span>
                            )}
                          </div>
                       </td>
                       <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                         onClick={() => printPrescription(p)}
                         style={{ 
                           
                           padding: '10px 16px', 
                           background: 'white', 
                           color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '12px', fontWeight: 800,
                           cursor: 'pointer'
                         }}
                       >
                          Print
                       </button>
                      <button 
                            onClick={() => startDispensing(p)}
                            disabled={p.status === 'Completed'}
                            style={{ 
                              padding: '10px 24px', 
                              background: p.status !== 'Completed' ? '#3b82f6' : '#94a3b8', 
                              color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800,
                              cursor: p.status === 'Completed' ? 'not-allowed' : 'pointer',
                              opacity: p.status === 'Completed' ? 0.5 : 1
                            }}
                          >
                             {p.status === 'Completed' ? 'Dispensed ✓' : 'Dispense'}
                          </button>
                           </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}

            {activePrescription && (
              <aside style={{ 
                background: 'white', 
                padding: isMobile ? '24px' : '32px', 
                borderRadius: isMobile ? '24px 24px 0 0' : '32px', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 20px 50px -12px rgba(0,0,0,0.1)',
                position: isMobile ? 'fixed' : 'relative',
                bottom: isMobile ? 0 : 'auto',
                left: isMobile ? 0 : 'auto',
                right: isMobile ? 0 : 'auto',
                zIndex: isMobile ? 1001 : 1,
                maxHeight: isMobile ? '85vh' : 'auto',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                   <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Fulfill Order</h2>
                   <button onClick={() => setActivePrescription(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>
                
                <div style={{ padding: '20px', background: 'var(--app-bg)', borderRadius: '20px', marginBottom: '24px' }}>
                   <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 700 }}>ORDER FOR</p>
                   <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>{activePrescription.patient_name || 'Patient'}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                   {selectedItems.map((item, idx) => (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px' }}>
                        <div>
                           <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{item.drugName}</p>
                           <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Stock: {inventory.find(i => i.id === item.drugId)?.stock_quantity || 0} units</p>
                        </div>
                        <input 
                           type="number" 
                           style={{ width: '64px', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}
                           value={item.quantity}
                           onChange={e => {
                              const newItems = [...selectedItems];
                              newItems[idx].quantity = parseInt(e.target.value);
                              setSelectedItems(newItems);
                           }}
                        />
                     </div>
                   ))}
                   {selectedItems.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8' }}>No items to dispense.</p>}
                </div>

                <button 
                  onClick={confirmDispense}
                  disabled={selectedItems.length === 0}
                  style={{ width: '100%', padding: '20px', borderRadius: '20px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 900, fontSize: '16px', cursor: 'pointer' }}
                >
                   Validate & Dispense
                </button>
             </aside>
           )}
        </div>
      </main>
    </div>
  );
}
