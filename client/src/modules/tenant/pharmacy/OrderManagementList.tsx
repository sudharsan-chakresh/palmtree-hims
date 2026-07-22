import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { ShoppingCart, AlertTriangle, Package, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";

interface Medicine {
  id: string;
  name: string;
  composition: string;
  stock_quantity: number;
  unit_price: number;
  uom: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
}

interface PharmacyOrder {
  id: string;
  medicine_name: string;
  supplier_name: string;
  quantity: number;
  unit_price: number;
  status: 'Ordered' | 'Received' | 'Cancelled';
  notes: string;
  ordered_by: string;
  ordered_at: string;
  received_at: string | null;
  current_stock: number;
  composition: string;
}

const statusConfig: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  Ordered:   { bg: '#fef9c3', color: '#b45309', icon: <Clock size={12} /> },
  Received:  { bg: '#dcfce7', color: '#15803d', icon: <CheckCircle size={12} /> },
  Cancelled: { bg: '#fee2e2', color: '#dc2626', icon: <XCircle size={12} /> },
};

export default function OrderManagementList({ embedded: _embedded = false }: { embedded?: boolean }) {
  const [medicines, setMedicines]   = useState<Medicine[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [orders, setOrders]         = useState<PharmacyOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [placing, setPlacing]       = useState<string | null>(null); // medicine id being ordered
  const [activeView, setActiveView] = useState<'lowstock' | 'orders'>('lowstock');

  // Per-row order form state keyed by medicine id
  const [orderForms, setOrderForms] = useState<Record<string, { supplier_id: string; quantity: string; notes: string }>>({});

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const h = getHeaders();
      const [invRes, supRes, ordRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/masters/medicines`, { headers: h }),
        axios.get(`${API_BASE}/api/hospital/masters/suppliers`, { headers: h }),
        axios.get(`${API_BASE}/api/hospital/pharmacy/orders`, { headers: h }),
      ]);
      setMedicines((invRes.data || []).filter((m: Medicine) => m.stock_quantity < 50));
      setSuppliers(supRes.data || []);
      setOrders(ordRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getForm = (medId: string) =>
    orderForms[medId] || { supplier_id: '', quantity: '', notes: '' };

  const updateForm = (medId: string, field: string, value: string) =>
    setOrderForms(prev => ({ ...prev, [medId]: { ...getForm(medId), [field]: value } }));

  const handlePlaceOrder = async (med: Medicine) => {
    const form = getForm(med.id);
    if (!form.quantity || parseInt(form.quantity) < 1) {
      alert("Please enter a valid quantity.");
      return;
    }
    setPlacing(med.id);
    try {
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      await axios.post(`${API_BASE}/api/hospital/pharmacy/orders`, {
        medicine_id:   med.id,
        medicine_name: med.name,
        supplier_id:   form.supplier_id || null,
        supplier_name: supplier?.name || '',
        quantity:      parseInt(form.quantity),
        unit_price:    med.unit_price || 0,
        notes:         form.notes,
        ordered_by:    localStorage.getItem("userName") || 'Pharmacist',
      }, { headers: getHeaders() });
      // reset this row's form
      setOrderForms(prev => { const n = { ...prev }; delete n[med.id]; return n; });
      await fetchAll();
      setActiveView('orders'); // switch to orders view to see the new order
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to place order. Please try again.");
    } finally {
      setPlacing(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await axios.patch(`${API_BASE}/api/hospital/pharmacy/orders/${orderId}`, {
        status,
        received_at: status === 'Received' ? new Date().toISOString() : undefined,
      }, { headers: getHeaders() });
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update order status.");
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'Ordered').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingCart size={24} color="#3b82f6" /> Order Management
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Replenish low-stock medicines by placing procurement orders to suppliers.
          </p>
        </div>
        <button
          onClick={fetchAll}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#475569' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Summary chips ── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Low-Stock Items', value: medicines.length, color: '#ef4444', icon: <AlertTriangle size={18} /> },
          { label: 'Active Orders', value: pendingOrders, color: '#f59e0b', icon: <Clock size={18} /> },
          { label: 'Total Orders', value: orders.length, color: '#3b82f6', icon: <Package size={18} /> },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: '160px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: s.color }}>{loading ? '…' : s.value}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab toggle ── */}
      <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {[
          { key: 'lowstock', label: `⚠️ Low-Stock (${medicines.length})` },
          { key: 'orders',   label: `📦 Order History (${orders.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key as any)}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              background: activeView === tab.key ? 'white' : 'transparent',
              color: activeView === tab.key ? '#0f172a' : '#64748b',
              boxShadow: activeView === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          LOW-STOCK VIEW — Place new orders
      ══════════════════════════════════════════════════ */}
      {activeView === 'lowstock' && (
        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading inventory...</div>
          ) : medicines.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#166534', marginBottom: '8px' }}>All stocks are healthy!</div>
              <div style={{ color: '#64748b', fontSize: '14px' }}>No medicines below the safety threshold of 50 units.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fff1f2', borderBottom: '2px solid #ffe4e6' }}>
                    {['MEDICINE', 'CURRENT STOCK', 'SUPPLIER', 'ORDER QTY', 'NOTES', 'ACTION'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', fontSize: '11px', color: '#be123c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medicines.map(med => {
                    const form = getForm(med.id);
                    const isPlacing = placing === med.id;
                    const stockLevel = med.stock_quantity;
                    const stockColor = stockLevel < 10 ? '#dc2626' : stockLevel < 25 ? '#d97706' : '#ca8a04';
                    return (
                      <tr key={med.id} style={{ borderBottom: '1px solid #fef2f2', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Medicine name */}
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>{med.name}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{med.composition || '—'}</div>
                        </td>

                        {/* Current stock badge */}
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fee2e2', color: stockColor, padding: '4px 12px', borderRadius: '10px', fontWeight: 800, fontSize: '13px' }}>
                            <AlertTriangle size={12} />
                            {stockLevel} {med.uom || 'units'}
                          </span>
                        </td>

                        {/* Supplier select */}
                        <td style={{ padding: '12px 20px', minWidth: '180px' }}>
                          <select
                            value={form.supplier_id}
                            onChange={e => updateForm(med.id, 'supplier_id', e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: 'white' }}
                          >
                            <option value="">— Select Supplier —</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>

                        {/* Quantity input */}
                        <td style={{ padding: '12px 20px', minWidth: '120px' }}>
                          <input
                            type="number"
                            min={1}
                            placeholder="e.g. 100"
                            value={form.quantity}
                            onChange={e => updateForm(med.id, 'quantity', e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                          />
                        </td>

                        {/* Notes input */}
                        <td style={{ padding: '12px 20px', minWidth: '160px' }}>
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={form.notes}
                            onChange={e => updateForm(med.id, 'notes', e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                          />
                        </td>

                        {/* Place order button */}
                        <td style={{ padding: '12px 20px' }}>
                          <button
                            onClick={() => handlePlaceOrder(med)}
                            disabled={isPlacing || !form.quantity}
                            style={{
                              padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: isPlacing || !form.quantity ? 'not-allowed' : 'pointer',
                              background: isPlacing || !form.quantity ? '#e2e8f0' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                              color: isPlacing || !form.quantity ? '#94a3b8' : 'white',
                              fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap',
                              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                            }}
                          >
                            {isPlacing ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Placing…</> : <><ShoppingCart size={13} /> Place Order</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          ORDERS VIEW — History & status management
      ══════════════════════════════════════════════════ */}
      {activeView === 'orders' && (
        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading orders...</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a', marginBottom: '8px' }}>No orders yet</div>
              <div style={{ color: '#64748b', fontSize: '14px' }}>Place a replenishment order from the Low-Stock tab to get started.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)', borderBottom: '2px solid #f1f5f9' }}>
                    {['MEDICINE', 'SUPPLIER', 'QTY', 'STATUS', 'ORDERED ON', 'ORDERED BY', 'ACTIONS'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const sc = statusConfig[order.status] || statusConfig['Ordered'];
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* Medicine */}
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{order.medicine_name}</div>
                          {order.current_stock !== undefined && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Stock: {order.current_stock}</div>
                          )}
                        </td>

                        {/* Supplier */}
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                          {order.supplier_name || <span style={{ color: '#94a3b8' }}>Not specified</span>}
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '16px 20px', fontWeight: 800, color: '#0f172a' }}>
                          {order.quantity}
                        </td>

                        {/* Status badge */}
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '10px', background: sc.bg, color: sc.color, fontWeight: 700, fontSize: '12px' }}>
                            {sc.icon} {order.status}
                          </span>
                        </td>

                        {/* Ordered on */}
                        <td style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b' }}>
                          {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>

                        {/* Ordered by */}
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                          {order.ordered_by || '—'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '16px 20px' }}>
                          {order.status === 'Ordered' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleUpdateStatus(order.id, 'Received')}
                                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                              >
                                ✅ Mark Received
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                              >
                                ✕ Cancel
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                              {order.status === 'Received' && order.received_at
                                ? `Received on ${new Date(order.received_at).toLocaleDateString('en-GB')}`
                                : 'No actions available'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
