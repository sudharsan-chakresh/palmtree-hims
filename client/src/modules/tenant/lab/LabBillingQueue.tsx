import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function LabBillingQueue() {
  const navigate = useNavigate();
  const [pendingBills, setPendingBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/lab/billing-queue`, { headers });
      setPendingBills(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleBill = (order: any) => {
    navigate('/billing', { state: { 
      billType: 'LAB', 
      totalAmount: Number(order.price || 0),
      patientName: order.patient_name,
      encounterId: order.patient_id,
      labOrderId: order.id
    } });
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Laboratory Billing Center" />

        <div className="manage-card" style={{ background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
           <div style={{ padding: '32px', background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Pending Lab Invoices</h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Completed investigations awaiting payment collection</p>
              </div>
              <div style={{ background: '#3b82f6', color: 'white', padding: '8px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '14px' }}>
                {pendingBills.length} Orders to Bill
              </div>
           </div>

           <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Patient / MRN</th>
                  <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Test Conducted</th>
                  <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Amount Payable</th>
                  <th style={{ padding: '16px 32px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingBills.map((o: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '20px 32px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{o.patient_name}</div>
                      <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>{o.mrn || 'WALK-IN'}</div>
                    </td>
                    <td style={{ padding: '20px 32px' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{o.test_name}</div>
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>RESULT AUTHORIZED</div>
                    </td>
                    <td style={{ padding: '20px 32px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>₹{o.price}</div>
                    </td>
                    <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                       <button 
                         onClick={() => handleBill(o)}
                         style={{ padding: '10px 24px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 900, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}
                       >
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                         COLLECT PAYMENT
                       </button>
                    </td>
                  </tr>
                ))}
                {pendingBills.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} style={{ padding: '100px 32px', textAlign: 'center' }}>
                       <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                       <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900 }}>All Clear!</h3>
                       <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>There are no pending lab invoices at the moment.</p>
                    </td>
                  </tr>
                )}
              </tbody>
           </table>
        </div>
      </main>
    </div>
  );
}
