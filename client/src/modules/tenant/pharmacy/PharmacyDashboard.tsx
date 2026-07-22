import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Activity } from 'lucide-react';
import { formatCurrency } from "../../../utils/currency";


export default function PharmacyDashboard({ embedded = false }: { embedded?: boolean }) {
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, pendingPrescriptions: 0, todaysSales: 0, recentDispenses: [] });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const changeTab = (tab: string) => {
    if (embedded) {
      const event = new CustomEvent('changePharmacyTab', { detail: tab });
      window.dispatchEvent(event);
      return;
    }

    if (tab === 'inventory') {
      navigate('/tenant/pharmacy/inventory');
      return;
    }

    if (tab === 'suppliers') {
      navigate('/tenant/pharmacy');
      return;
    }
  };

  const fetchStats = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const [invRes, preRes, statRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/pharmacy/inventory`, { headers }),
        axios.get(`${API_BASE}/api/hospital/pharmacy/prescriptions`, { headers }),
        axios.get(`${API_BASE}/api/hospital/pharmacy/stats`, { headers })
      ]);
      const lowStockList = invRes.data.filter((i: any) => i.stock_quantity < 50).sort((a: any, b: any) => a.stock_quantity - b.stock_quantity);
      setLowStockItems(lowStockList);
      setStats({
        totalItems: invRes.data.length,
        lowStock: lowStockList.length,
        pendingPrescriptions: preRes.data.length,
        todaysSales: statRes.data.todaysSales,
        recentDispenses: statRes.data.recentDispenses
      });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <div className={embedded ? "" : "dashboard-layout"} style={{ display: 'flex', minHeight: embedded ? 'auto' : '100vh', background: 'var(--app-bg)' }}>
      {!embedded && <Sidebar />}
      <main style={{ flex: 1, padding: embedded ? '0' : '32px' }}>
        {!embedded && <Header title="Pharmacy Intelligence Dashboard" />}
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.1)' }}>
            <Activity size={24} />
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Real-time inventory metrics, low-stock surveillance, and medication dispensing throughput intelligence.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          {[
            { label: 'Total Stock items', value: stats.totalItems, color: '#3b82f6', icon: '📦' },
            { label: 'Low stock alerts', value: stats.lowStock, color: '#ef4444', icon: '⚠️' },
            { label: 'Pending Orders', value: stats.pendingPrescriptions, color: '#f59e0b', icon: '📋' },
            { label: 'Revenue (Today)', value: formatCurrency(stats.todaysSales), color: '#10b981', icon: '💰' }
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
               <div style={{ fontSize: '24px', marginBottom: '12px' }}>{s.icon}</div>
               <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
               <p style={{ margin: '8px 0 0', fontSize: '32px', fontWeight: 900, color: s.color }}>{loading ? '...' : s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Inventory Health</h3>
               <div style={{ height: '300px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                  {stats.lowStock > 0 ? (
                    <div style={{ padding: '24px', background: '#fff1f2', borderRadius: '24px', border: '1px solid #ffe4e6', textAlign: 'center' }}>
                      <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚨</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#be123c', marginBottom: '8px' }}>Critical Action Required</div>
                      <div style={{ color: '#e11d48', fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
                        {stats.lowStock} items are below safety levels and require immediate replenishment.
                      </div>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => setShowLowStockModal(true)}
                          style={{ padding: '10px 20px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
                        >
                          View Low Stock
                        </button>
                        <button 
                          onClick={() => changeTab('suppliers')}
                          style={{ padding: '10px 20px', background: 'white', color: '#be123c', border: '1px solid #ffe4e6', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
                        >
                          Contact Suppliers
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '32px', background: '#f0fdf4', borderRadius: '24px', textAlign: 'center', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
                      <div style={{ color: '#166534', fontWeight: 800, fontSize: '16px' }}>Inventory Healthy</div>
                      <div style={{ color: '#15803d', fontSize: '13px', marginTop: '8px' }}>All medication stocks are within safe operating parameters.</div>
                    </div>
                  )}
               </div>
            </div>
           <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Recent Dispenses</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {stats.recentDispenses.length > 0 ? stats.recentDispenses.map((disp: any, i: number) => (
                   <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                         <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>{disp.patient_name}</p>
                         <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Processed: {new Date(disp.created_at).toLocaleTimeString()}</p>
                      </div>
                       <span style={{ fontWeight: 800, color: '#10b981' }}>{formatCurrency(disp.total)}</span>
                   </div>
                 )) : (
                   <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No dispense history today.</p>
                 )}
              </div>
           </div>
        </div>

        {showLowStockModal && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ 
              background: 'white', 
              borderRadius: '24px', 
              padding: '32px', 
              maxWidth: '600px', 
              maxHeight: '80vh', 
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>Low Stock Items</h2>
                <button 
                  onClick={() => setShowLowStockModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}
                >
                  ✕
                </button>
              </div>
              {lowStockItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {lowStockItems.map((item: any, i: number) => (
                    <div key={i} style={{ 
                      padding: '16px', 
                      background: '#fff1f2', 
                      border: '1px solid #ffe4e6', 
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '14px', color: '#be123c' }}>{item.name || item.medicine_name}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Current Stock: <strong>{item.stock_quantity || 0}</strong> units</p>
                      </div>
                      <span style={{ 
                        padding: '6px 12px', 
                        background: '#ef4444', 
                        color: 'white', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>
                        {item.stock_quantity < 10 ? 'Critical' : 'Low'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No low stock items found.</p>
              )}
              <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => { setShowLowStockModal(false); changeTab('inventory'); }}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    background: '#e11d48', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontWeight: 800, 
                    cursor: 'pointer'
                  }}
                >
                  View Full Inventory
                </button>
                <button 
                  onClick={() => setShowLowStockModal(false)}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    background: '#f1f5f9', 
                    color: '#0f172a', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '12px', 
                    fontWeight: 800, 
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
