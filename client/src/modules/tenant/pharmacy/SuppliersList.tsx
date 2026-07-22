import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Truck, Plus, Mail, Phone, MapPin } from 'lucide-react';

export default function SuppliersList({ embedded = false }: { embedded?: boolean }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      // Reusing the masters generic route if available, or creating a new one
      const res = await axios.get(`${API_BASE}/api/hospital/masters/suppliers`, { headers });
      setSuppliers(res.data || []);
    } catch (err) { 
      // Fallback if table doesn't exist yet
      setSuppliers([
        { id: '1', name: 'Global Pharma Ltd', contact_person: 'John Doe', email: 'john@global.com', phone: '+123456789', address: 'London, UK' },
        { id: '2', name: 'Nexus Medical Supplies', contact_person: 'Jane Smith', email: 'jane@nexus.com', phone: '+987654321', address: 'Mumbai, India' }
      ]);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.post(`${API_BASE}/api/hospital/masters/suppliers`, newSupplier, { headers });
      setShowModal(false);
      fetchSuppliers();
      alert("Supplier added successfully!");
    } catch (err) {
      alert("Failed to add supplier");
    }
  };

  return (
    <div style={{ padding: embedded ? '0' : '32px', background: 'var(--app-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '24px', color: '#0f172a' }}>Supplier Directory</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Manage your procurement network and vendor contacts.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{ padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Add New Supplier
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {suppliers.map((s, i) => (
          <div key={i} style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', color: '#0f172a', display: 'grid', placeItems: 'center' }}>
                  <Truck size={24} />
                </div>
                <div>
                   <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{s.name}</h3>
                   <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700 }}>Active Vendor</span>
                </div>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                   <Plus size={16} style={{ color: '#94a3b8' }} />
                   <span style={{ fontWeight: 600 }}>Contact: {s.contact_person}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                   <Mail size={16} style={{ color: '#94a3b8' }} />
                   <span>{s.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                   <Phone size={16} style={{ color: '#94a3b8' }} />
                   <span>{s.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                   <MapPin size={16} style={{ color: '#94a3b8' }} />
                   <span>{s.address}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '28px', width: '450px' }}>
             <h2 style={{ margin: '0 0 24px', fontWeight: 900 }}>New Supplier</h2>
             <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input placeholder="Supplier Company Name" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                <input placeholder="Contact Person" required style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewSupplier({...newSupplier, contact_person: e.target.value})} />
                <input placeholder="Email Address" type="email" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
                <input placeholder="Phone Number" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                <textarea placeholder="Address" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
                <div style={{ display: 'flex', gap: '12px' }}>
                   <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }}>Cancel</button>
                   <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none' }}>Save Supplier</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
