import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { formatCurrencyFixed } from "../../../utils/currency";


export default function InventoryList({ embedded = false }: { embedded?: boolean }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Antibiotic', quantity: '', price: '', expiryDate: '', uom: 'Tablet', batchNumber: '' });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/pharmacy/inventory`, { headers });
      setInventory(res.data);
    } catch (err) { console.error(err); }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const data = {
        name: newItem.name,
        category: newItem.category,
        stock_quantity: parseInt(newItem.quantity),
        unit_price: parseFloat(newItem.price),
        expiry_date: newItem.expiryDate,
        uom: newItem.uom,
        batch_number: newItem.batchNumber
      };
      await axios.post(`${API_BASE}/api/hospital/masters/medicines`, data, { headers });
      setShowModal(false);
      fetchInventory();
      alert("Medicine added to inventory successfully!");
    } catch (err) {
      alert("Failed to add stock item");
    }
  };

  const handleEditStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const data = {
        name: editingItem.name,
        category: editingItem.category,
        stock_quantity: parseInt(editingItem.stock_quantity),
        unit_price: parseFloat(editingItem.unit_price),
        expiry_date: editingItem.expiry_date ? editingItem.expiry_date.split('T')[0] : null,
        uom: editingItem.uom,
        batch_number: editingItem.batch_number
      };
      await axios.put(`${API_BASE}/api/hospital/masters/medicines/${editingItem.id}`, data, { headers });
      setShowEditModal(false);
      setEditingItem(null);
      fetchInventory();
      alert("Medicine updated successfully!");
    } catch (err) {
      alert("Failed to update stock item");
    }
  };

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const name = (item.name || item.drug_name || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch = name.includes(query);

    if (selectedCategory === "All Categories") return matchesSearch;

    const uom = (item.uom || "").toLowerCase();
    const category = (item.category || "").toLowerCase();

    if (selectedCategory === "Tablets") {
      const tabletTerms = ['tablet', 'strip', 'capsule'];
      const matchesCategory = tabletTerms.some(term => uom.includes(term) || category.includes(term));
      return matchesSearch && matchesCategory;
    }
    if (selectedCategory === "Syrups") {
      const syrupTerms = ['syrup', 'bottle'];
      const matchesCategory = syrupTerms.some(term => uom.includes(term) || category.includes(term));
      return matchesSearch && matchesCategory;
    }
    if (selectedCategory === "Injectables") {
      const injectionTerms = ['vial', 'injection', 'injectable'];
      const matchesCategory = injectionTerms.some(term => uom.includes(term) || category.includes(term));
      return matchesSearch && matchesCategory;
    }
    return matchesSearch;
  });

  return (
    <div className={embedded ? "" : "dashboard-layout"} style={{ display: 'flex', minHeight: embedded ? 'auto' : '100vh', background: 'var(--app-bg)' }}>
      {!embedded && <Sidebar />}
      <main style={{ flex: 1, padding: embedded ? '0' : '32px' }}>
        {!embedded && <Header title="Pharmacy Inventory Management" />}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '40px', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '500px' }}>Comprehensive drug catalog with automated batch surveillance and real-time expiry tracking.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              onClick={() => {
                const csvContent = "name,category,uom,batch,stock,price,expiry\nParacetamol 500mg,Tablet,Strip,BCH123,500,10.00,2025-12-31\nAmoxicillin 250mg,Antibiotic,Bottle,BCH999,200,45.50,2025-06-30";
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('href', url);
                a.setAttribute('download', 'pharmacy_stock_template.csv');
                a.click();
              }}
              style={{ padding: '12px 24px', background: 'white', border: '1px solid #e2e8f0', color: '#0f172a', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Template
            </button>
            <button 
              onClick={() => setShowModal(true)}
              style={{ padding: '12px 32px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)' }}
            >
               + Add New Stock
            </button>
            <label style={{ padding: '12px 24px', background: 'white', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="file" 
                accept=".csv" 
                style={{ display: 'none' }} 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const lines = text.split('\n').filter(l => l.trim());
                  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                  const items = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const stockVal = parseInt(values[headers.indexOf('stock')] || values[headers.indexOf('quantity')] || '0');
                    const priceVal = parseFloat(values[headers.indexOf('price')] || '0');
                    const expVal = values[headers.indexOf('expiry')] || values[headers.indexOf('expiry_date')];

                    return {
                      name: values[headers.indexOf('name')],
                      category: values[headers.indexOf('category')] || 'Other',
                      uom: values[headers.indexOf('uom')] || 'Tablet',
                      batch_number: values[headers.indexOf('batch')] || values[headers.indexOf('batch_number')] || 'N/A',
                      stock_quantity: isNaN(stockVal) ? 0 : stockVal,
                      unit_price: isNaN(priceVal) ? 0 : priceVal,
                      expiry_date: expVal && expVal.trim() ? expVal : null
                    };
                  }).filter(i => i.name);

                  const authHeaders = { 
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    "x-tenant-id": localStorage.getItem("tenant") || ""
                  };
                  try {
                    await axios.post(`${API_BASE}/api/hospital/masters/medicines/bulk`, items, { headers: authHeaders });
                    alert(`Successfully imported ${items.length} items!`);
                    fetchInventory();
                  } catch (err) {
                    console.error("Bulk Import Error:", err);
                    alert("Import failed. Please ensure your CSV follows the template format (Required: name, category, uom, stock, price, expiry)");
                  }
                }}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import CSV
            </label>
          </div>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 24px', fontWeight: 900, color: '#0f172a' }}>Add New Medicine</h2>
              <form onSubmit={handleAddStock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Medicine Name</label>
                  <input required placeholder="e.g. Amoxicillin 500mg" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Category</label>
                    <select style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                      <option value="Antibiotic">Antibiotic</option>
                      <option value="Analgesic">Analgesic</option>
                      <option value="Antidiabetic">Antidiabetic</option>
                      <option value="Antihypertensive">Antihypertensive</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Stock Quantity</label>
                    <input required type="number" placeholder="100" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, quantity: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>UOM</label>
                    <select style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, uom: e.target.value})}>
                      <option value="Tablet">Tablet</option>
                      <option value="Capsule">Capsule</option>
                      <option value="Strip">Strip</option>
                      <option value="Vial">Vial</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Syrup">Syrup</option>
                      <option value="Ointment">Ointment</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Batch Number</label>
                    <input required placeholder="BCH-001" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, batchNumber: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Price / Unit (₹)</label>
                    <input required type="number" step="0.01" placeholder="0.00" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Expiry Date</label>
                    <input required type="date" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewItem({...newItem, expiryDate: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Save Item</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditModal && editingItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 24px', fontWeight: 900, color: '#0f172a' }}>Edit Medicine Details</h2>
              <form onSubmit={handleEditStock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Medicine Name</label>
                  <input required value={editingItem.name || editingItem.drug_name || ""} placeholder="e.g. Amoxicillin 500mg" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Category</label>
                    <select value={editingItem.category || "Antibiotic"} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, category: e.target.value})}>
                      <option value="Antibiotic">Antibiotic</option>
                      <option value="Analgesic">Analgesic</option>
                      <option value="Antidiabetic">Antidiabetic</option>
                      <option value="Antihypertensive">Antihypertensive</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Stock Quantity</label>
                    <input required type="number" value={editingItem.stock_quantity || 0} placeholder="100" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, stock_quantity: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>UOM</label>
                    <select value={editingItem.uom || "Tablet"} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, uom: e.target.value})}>
                      <option value="Tablet">Tablet</option>
                      <option value="Capsule">Capsule</option>
                      <option value="Strip">Strip</option>
                      <option value="Vial">Vial</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Syrup">Syrup</option>
                      <option value="Ointment">Ointment</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Batch Number</label>
                    <input required value={editingItem.batch_number || ""} placeholder="BCH-001" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, batch_number: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Price / Unit (₹)</label>
                    <input required type="number" step="0.01" value={editingItem.unit_price || 0} placeholder="0.00" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, unit_price: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Expiry Date</label>
                    <input required type="date" value={editingItem.expiry_date ? editingItem.expiry_date.split('T')[0] : ""} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setEditingItem({...editingItem, expiry_date: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={() => { setShowEditModal(false); setEditingItem(null); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '16px' }}>
             <input placeholder="Search medicine..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
             <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
                <option value="All Categories">All Categories</option>
                <option value="Tablets">Tablets</option>
                <option value="Syrups">Syrups</option>
                <option value="Injectables">Injectables</option>
             </select>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--app-bg)' }}>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Medicine Name</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Category</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Batch</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>UOM</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Available Stock</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Price / Unit</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Expiry Date</th>
                <th style={{ padding: '20px 24px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.name || item.drug_name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {item.id.substring(0,8)}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                     <span style={{ fontSize: '12px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '6px', fontWeight: 700, color: '#475569' }}>{item.category}</span>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                     <span style={{ fontSize: '11px', padding: '4px 8px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '6px', fontWeight: 800, color: '#2563eb' }}>{item.batch_number || 'N/A'}</span>
                  </td>
                  <td style={{ padding: '20px 24px', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                     {item.uom || 'Tablet'}
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ width: '100px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(Number(item.stock_quantity) / 2, 100)}%`, height: '100%', background: Number(item.stock_quantity) < 20 ? '#ef4444' : Number(item.stock_quantity) < 50 ? '#f59e0b' : '#10b981' }}></div>
                       </div>
                       <span style={{ fontWeight: 800, color: Number(item.stock_quantity) < 20 ? '#ef4444' : Number(item.stock_quantity) < 50 ? '#f59e0b' : '#10b981' }}>{item.stock_quantity}</span>
                       {Number(item.stock_quantity) < 20 && <span style={{ fontSize: '10px', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>CRITICAL</span>}
                       {Number(item.stock_quantity) >= 20 && Number(item.stock_quantity) < 50 && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>LOW</span>}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', fontWeight: 800 }}>{formatCurrencyFixed(item.unit_price)}</td>
                  <td style={{ padding: '20px 24px', color: '#64748b', fontSize: '13px' }}>{new Date(item.expiry_date).toLocaleDateString()}</td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                     <button 
                       onClick={() => {
                         setEditingItem(item);
                         setShowEditModal(true);
                       }}
                       style={{ padding: '8px 16px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}
                     >
                       Edit
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
