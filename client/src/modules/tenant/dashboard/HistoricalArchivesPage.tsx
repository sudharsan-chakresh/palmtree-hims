import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { FileText, Receipt, Search, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "../../../utils/currency";

export default function HistoricalArchivesPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"bills" | "prescriptions">("bills");

  const headers = { 
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billRes, presRes] = await Promise.all([
        axios.get(`${API_BASE}/api/billing/history`, { headers }),
        axios.get(`${API_BASE}/api/hospital/encounters?status=Completed`, { headers })
      ]);
      setBills(billRes.data || []);
      const presList = Array.isArray(presRes.data) ? presRes.data : (Array.isArray(presRes.data?.data) ? presRes.data.data : []);
      setPrescriptions(presList);
    } catch (err) {
      console.error("Failed to fetch archives", err);
    } finally {
      setLoading(false);
    }
  };

  const printInvoice = async (bill: any) => {
    let items = [];
    try {
      const res = await axios.get(`${API_BASE}/api/billing/invoices/${bill.id}/items`, { headers });
      items = res.data || [];
    } catch (err: any) {
      console.error("Failed to fetch invoice items", err);
      const backendMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      alert(`Failed to load invoice items for printing${backendMessage ? `: ${backendMessage}` : ''}`);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the invoice.");
      return;
    }

    const itemRows = items.map((item: any, idx: number) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${idx + 1}. ${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${Number(item.quantity)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.discount_amount)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${formatCurrency(item.amount)}</td>
      </tr>
    `).join("");

    const hospitalName = localStorage.getItem("tenantName") || "PALMTREE CLINICS";
    const invoiceNum = bill.invoice_number || `INV-${bill.id.substring(0, 6)}`;
    const billDate = new Date(bill.created_at).toLocaleDateString('en-US', { dateStyle: 'long' });

    const htmlContent = `
      <html>
        <head>
          <title>Invoice_${invoiceNum}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
            .hospital-title { font-size: 24px; font-weight: 800; color: #065f46; }
            .hospital-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
            .invoice-info { text-align: right; }
            .inv-title { font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
            .inv-num { font-size: 14px; font-weight: 700; color: #3b82f6; margin-top: 4px; }
            
            .patient-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: var(--app-bg); padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
            .info-item { font-size: 13px; color: #475569; }
            .info-label { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 2px; }
            
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
            .items-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; }
            
            .totals-container { display: flex; justify-content: flex-end; margin-bottom: 40px; }
            .totals-box { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #475569; }
            .grand-total { border-top: 2px solid #10b981; padding-top: 12px; margin-top: 8px; font-size: 18px; font-weight: 900; color: #0f172a; }
            
            .footer { margin-top: 100px; display: flex; justify-content: space-between; align-items: flex-end; }
            .sig-line { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 8px; font-size: 12px; color: #64748b; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="hospital-title">${hospitalName}</div>
              <div class="hospital-sub">Integrated Health Management System</div>
            </div>
            <div class="invoice-info">
              <div class="inv-title">Tax Invoice</div>
              <div class="inv-num">${invoiceNum}</div>
            </div>
          </div>
          
          <div class="patient-card">
            <div>
              <div class="info-label">Patient Name</div>
              <div class="info-item" style="font-weight: 700;">${bill.patient_name}</div>
            </div>
            <div>
              <div class="info-label">MRN / ID</div>
              <div class="info-item">${bill.patient_mrn || 'N/A'}</div>
            </div>
            <div>
              <div class="info-label">Date</div>
              <div class="info-item">${billDate}</div>
            </div>
            <div>
              <div class="info-label">Payment Mode</div>
              <div class="info-item" style="text-transform: uppercase; font-weight: 700; color: #10b981;">${bill.payment_mode}</div>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40%;">Description</th>
                <th style="width: 10%; text-align: center;">Qty</th>
                <th style="width: 15%; text-align: right;">Unit Price</th>
                <th style="width: 15%; text-align: right;">Discount</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
          
          <div class="totals-container">
            <div class="totals-box">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(bill.subtotal)}</span>
              </div>
              <div class="total-row">
                <span>Tax Total:</span>
                <span>${formatCurrency(bill.tax_total)}</span>
              </div>
              ${bill.insurance_claim_amount > 0 ? `
                <div class="total-row">
                  <span>Insurance Share:</span>
                  <span style="color: #10b981; font-weight: 600;">${formatCurrency(bill.insurance_claim_amount)}</span>
                </div>
                <div class="total-row">
                  <span>Patient Copay (${Math.round((bill.patient_copay_amount / bill.total) * 100)}%):</span>
                  <span>${formatCurrency(bill.patient_copay_amount)}</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>Total Paid:</span>
                <span>${formatCurrency(bill.insurance_claim_amount > 0 ? bill.patient_copay_amount : bill.total)}</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Generated via HIMS Billing Module</div>
            </div>
            <div class="sig-line">
              Billing Desk Signature
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

  const printPrescription = async (pres: any) => {
    let items = [];
    try {
      const presHeaderRes = await axios.get(`${API_BASE}/api/hospital/pharmacy/prescriptions`, { headers });
      const match = presHeaderRes.data.find((p: any) => p.encounter_id === pres.id);
      if (match) {
        const itemsRes = await axios.get(`${API_BASE}/api/hospital/pharmacy/prescriptions/${match.id}/items`, { headers });
        items = itemsRes.data || [];
      }
    } catch (err) {
      console.error("Failed to fetch prescription items", err);
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the prescription.");
      return;
    }

    let parsedVitals = null;
    try {
      parsedVitals = typeof pres.vitals === 'string' ? JSON.parse(pres.vitals) : pres.vitals;
    } catch (e) {
      parsedVitals = pres.vitals;
    }

    const medRows = items.length > 0 ? items.map((m: any, idx: number) => `
      <tr>
        <td style="font-weight: 700; padding: 12px; border-bottom: 1px solid #e2e8f0;">${idx + 1}. ${m.medicine_name || m.drug_name || 'Medicine'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.dosage || 'As directed'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.frequency || 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.duration || 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.instructions || ''}</td>
      </tr>
    `).join("") : `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">No medications prescribed. Refer to clinical advice.</td></tr>`;

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
              <div class="info-item">${new Date(pres.created_at).toLocaleDateString('en-US', { dateStyle: 'long' })}</div>
            </div>
          </div>

          ${parsedVitals ? `
          <div style="display: flex; gap: 40px; margin-bottom: 30px; background: #fff; padding: 12px; border-radius: 8px; border: 1px dashed #e2e8f0;">
            <div><span style="font-weight:700; color:#64748b; font-size:11px; text-transform:uppercase;">BP:</span> <span style="font-weight:800;">${parsedVitals.bp || '--'}</span></div>
            <div><span style="font-weight:700; color:#64748b; font-size:11px; text-transform:uppercase;">Temp:</span> <span style="font-weight:800;">${parsedVitals.temp || '--'}°F</span></div>
            <div><span style="font-weight:700; color:#64748b; font-size:11px; text-transform:uppercase;">Weight:</span> <span style="font-weight:800;">${parsedVitals.weight || '--'}kg</span></div>
          </div>
          ` : ''}
          
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
              <div class="notes-content" style="font-weight: 700;">${pres.diagnosis || 'General OPD Consultation'}</div>
            </div>
            <div class="notes-section">
              <div class="notes-title">Clinical Findings & Advice</div>
              <div class="notes-content">${pres.notes || 'No notes provided.'}</div>
            </div>
          </div>
          
          <div class="footer">
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Printed via Patient Archives</div>
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

  const filteredBills = bills.filter(b => 
    b.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPrescriptions = prescriptions.filter(p => 
    p.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-layout" style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
      <Sidebar />
      <main className="main-content" style={{ padding: '32px' }}>
        <Header title="Clinical & Financial Archives" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
               <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>Patient Archives</h2>
               <p style={{ color: '#64748b', margin: 0 }}>Access historical billing records and clinical prescriptions across all departments.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    placeholder="Search by Patient or ID..." 
                    style={{ padding: '14px 16px 14px 44px', borderRadius: '14px', border: '1px solid #e2e8f0', width: '320px', outline: 'none' }}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
               </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '6px', borderRadius: '16px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
             <button 
              onClick={() => setActiveTab('bills')}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: activeTab === 'bills' ? '#0f172a' : 'transparent', color: activeTab === 'bills' ? 'white' : '#64748b', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
             >
               <Receipt size={18} /> Billing History
             </button>
             <button 
              onClick={() => setActiveTab('prescriptions')}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: activeTab === 'prescriptions' ? '#0f172a' : 'transparent', color: activeTab === 'prescriptions' ? 'white' : '#64748b', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
             >
               <FileText size={18} /> Prescription History
             </button>
          </div>

          {loading ? (
            <div style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>Loading historical data...</div>
          ) : (
            <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                    <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>{activeTab === 'bills' ? 'INVOICE' : 'CONSULTATION'}</th>
                    <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>PATIENT</th>
                    <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>DATE</th>
                    <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>DETAILS</th>
                    <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'bills' ? (
                    filteredBills.map((bill, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '20px 24px' }}>
                           <div style={{ fontWeight: 800, color: '#0f172a' }}>{bill.invoice_number || `#INV-${bill.id.substring(0,6)}`}</div>
                           <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>{bill.bill_type}</div>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                           <div style={{ fontWeight: 700 }}>{bill.patient_name}</div>
                           <div style={{ fontSize: '11px', color: '#94a3b8' }}>MRN: {bill.patient_mrn || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '20px 24px', color: '#64748b', fontSize: '14px' }}>
                           {new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                           <div style={{ fontWeight: 800, color: '#10b981' }}>{formatCurrency(bill.total_amount || bill.total)}</div>
                           <div style={{ fontSize: '11px', color: '#64748b' }}>Mode: {bill.payment_mode}</div>
                        </td>
                        <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                           <button onClick={() => printInvoice(bill)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer' }}>
                              <Printer size={16} />
                           </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredPrescriptions.map((pres, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '20px 24px' }}>
                           <div style={{ fontWeight: 800, color: '#0f172a' }}>OPD VISIT</div>
                           <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700 }}>{pres.doctor_name}</div>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                           <div style={{ fontWeight: 700 }}>{pres.patient_name}</div>
                           <div style={{ fontSize: '11px', color: '#94a3b8' }}>MRN: {pres.mrn}</div>
                        </td>
                        <td style={{ padding: '20px 24px', color: '#64748b', fontSize: '14px' }}>
                           {new Date(pres.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                           <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{pres.diagnosis}</div>
                           <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>{pres.notes?.substring(0, 40)}...</div>
                        </td>
                        <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                           <button onClick={() => printPrescription(pres)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer' }}>
                              <Printer size={16} />
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                  {(activeTab === 'bills' ? filteredBills : filteredPrescriptions).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                        No historical records matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
