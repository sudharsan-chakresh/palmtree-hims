import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Truck, Plus, CheckCircle2, Ban } from 'lucide-react';
import { useToast } from "../../../components/ToastProvider";

export default function InwardRegister({ embedded = false }: { embedded?: boolean }) {
  const [inwards, setInwards] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const [newEntry, setNewEntry] = useState({
    supplier_id: '',
    medicine_id: '',
    batch_number: '',
    invoice_number: '',
    quantity: '',
    uom: 'Tablet',
    purchase_price: '',
    mrp: '',
    mfd_date: '',
    expiry_date: '',
    remarks: '',
    inward_no: ''
  });

  const getHeaders = () => ({ 
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  useEffect(() => {
    fetchInwards();
    fetchMasters();
  }, []);

  const fetchInwards = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/pharmacy/inwards`, { headers: getHeaders() });
      setInwards(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchMasters = async () => {
    try {
      const h = getHeaders();
      const [supRes, medRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/masters/suppliers`, { headers: h }),
        axios.get(`${API_BASE}/api/hospital/pharmacy/inventory`, { headers: h })
      ]);
      setSuppliers(supRes.data || []);
      setMedicines(medRes.data || []);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/hospital/pharmacy/inwards`, newEntry, { headers: getHeaders() });
      showToast("Stock inward registered successfully!", "success");
      setShowModal(false);
      fetchInwards();
    } catch (err) {
      showToast("Failed to register inward entry.", "error");
    } finally { setLoading(false); }
  };

  const toggleBlock = async (id: string, current: boolean) => {
    try {
      await axios.patch(`${API_BASE}/api/hospital/pharmacy/inwards/${id}/block`, { is_blocked: !current }, { headers: getHeaders() });
      showToast(current ? "Batch unblocked" : "Batch blocked for distribution", "info");
      fetchInwards();
    } catch (err) { showToast("Failed to update status", "error"); }
  };

  const inputStyle = { padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', width: '100%' };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px', display: 'block' };

  return (
    <div style={{ padding: embedded ? '0' : '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
           <h2 style={{ margin: 0, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Truck className="text-blue-500" /> Inward Stock Register (GRN)
           </h2>
           <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Track medicine supply chain compliance, batches, and supplier invoices.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{ padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)' }}
        >
          <Plus size={18} /> Record New Delivery
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--app-bg)', textAlign: 'left' }}>
              <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Inward # / Item</th>
              <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Supplier & Invoice</th>
              <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Batch Details</th>
              <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Qty / Pricing</th>
              <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {inwards.length > 0 ? inwards.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', opacity: item.is_blocked ? 0.6 : 1 }}>
                <td style={{ padding: '20px 24px' }}>
                  <div style={{ background: '#3b82f6', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, display: 'inline-block', marginBottom: '4px' }}>
                    {item.inward_no}
                  </div>
                  <div style={{ fontWeight: 800 }}>{item.medicine_name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Received: {new Date(item.received_at).toLocaleDateString()}</div>
                </td>
                <td style={{ padding: '20px 24px' }}>
                   <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.supplier_name || 'Direct Procurement'}</div>
                   <div style={{ fontSize: '12px', color: '#64748b' }}>Inv: {item.invoice_number}</div>
                </td>
                <td style={{ padding: '20px 24px' }}>
                   <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, display: 'inline-block' }}>
                     Batch: {item.batch_number}
                   </div>
                   <div style={{ fontSize: '11px', marginTop: '4px', color: item.expiry_date && new Date(item.expiry_date) < new Date() ? '#ef4444' : '#64748b' }}>
                     Exp: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                   </div>
                </td>
                <td style={{ padding: '20px 24px' }}>
                   <div style={{ fontWeight: 800 }}>{item.quantity} {item.uom}</div>
                   <div style={{ fontSize: '12px', color: '#10b981' }}>MRP: ₹{item.mrp}</div>
                </td>
                <td style={{ padding: '20px 24px' }}>
                   {item.is_blocked ? (
                     <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '12px', fontWeight: 800 }}>
                       <Ban size={14} /> BLOCKED
                     </span>
                   ) : (
                     <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', fontWeight: 800 }}>
                       <CheckCircle2 size={14} /> ACTIVE
                     </span>
                   )}
                </td>
                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                   <button 
                     onClick={() => toggleBlock(item.id, item.is_blocked)}
                     style={{ padding: '8px 12px', background: item.is_blocked ? '#f0fdf4' : '#fff1f2', color: item.is_blocked ? '#166534' : '#be123c', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
                   >
                     {item.is_blocked ? 'Unblock' : 'Block Batch'}
                   </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No inward records found. Record a new delivery to start tracking.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '600px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ margin: '0 0 24px', fontWeight: 900, color: '#0f172a' }}>Record Stock Inward (GRN)</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                   <label style={labelStyle}>Supplier</label>
                   <select required style={inputStyle} value={newEntry.supplier_id} onChange={e => setNewEntry({...newEntry, supplier_id: e.target.value})}>
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                </div>
                <div>
                   <label style={labelStyle}>Inward # (Optional)</label>
                   <input placeholder="Auto-generated if blank" style={inputStyle} value={newEntry.inward_no} onChange={e => setNewEntry({...newEntry, inward_no: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                   <label style={labelStyle}>Invoice Number</label>
                   <input required placeholder="INV-2024-001" style={inputStyle} value={newEntry.invoice_number} onChange={e => setNewEntry({...newEntry, invoice_number: e.target.value})} />
                </div>
                <div>
                   <label style={labelStyle}>Medicine / Drug</label>
                   <select required style={inputStyle} value={newEntry.medicine_id} onChange={e => setNewEntry({...newEntry, medicine_id: e.target.value})}>
                      <option value="">Select Medicine</option>
                      {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                   <label style={labelStyle}>Batch Number</label>
                   <input required placeholder="BCH7788" style={inputStyle} value={newEntry.batch_number} onChange={e => setNewEntry({...newEntry, batch_number: e.target.value})} />
                </div>
                <div>
                   <label style={labelStyle}>Quantity</label>
                   <input required type="number" placeholder="0" style={inputStyle} value={newEntry.quantity} onChange={e => setNewEntry({...newEntry, quantity: e.target.value})} />
                </div>
                <div>
                   <label style={labelStyle}>UOM</label>
                   <select style={inputStyle} value={newEntry.uom} onChange={e => setNewEntry({...newEntry, uom: e.target.value})}>
                      <option value="Tablet">Tablet</option>
                      <option value="Strip">Strip</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Vial">Vial</option>
                   </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                   <label style={labelStyle}>Purchase Price (₹)</label>
                   <input required type="number" step="0.01" style={inputStyle} value={newEntry.purchase_price} onChange={e => setNewEntry({...newEntry, purchase_price: e.target.value})} />
                </div>
                <div>
                   <label style={labelStyle}>Sales Price / MRP (₹)</label>
                   <input required type="number" step="0.01" style={inputStyle} value={newEntry.mrp} onChange={e => setNewEntry({...newEntry, mrp: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                   <label style={labelStyle}>Mfg Date</label>
                   <input type="date" style={inputStyle} value={newEntry.mfd_date} onChange={e => setNewEntry({...newEntry, mfd_date: e.target.value})} />
                </div>
                <div>
                   <label style={labelStyle}>Expiry Date</label>
                   <input required type="date" style={inputStyle} value={newEntry.expiry_date} onChange={e => setNewEntry({...newEntry, expiry_date: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                  {loading ? 'Registering...' : 'Complete Inward Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
