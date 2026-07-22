import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'doctor', password: '' });

  const fetchStaff = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/staff`, { headers });
      setStaff(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.post(`${API_BASE}/api/hospital/staff`, newStaff, { headers });
      alert("Staff member added successfully!");
      setShowModal(false);
      fetchStaff();
    } catch (err) { alert("Failed to add staff member"); }
  };

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px' }}>
        <Header title="Hospital Staff Management" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
           <div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Employee Master</h2>
              <p style={{ color: '#64748b', margin: '4px 0 0' }}>Manage doctors, nurses, and administrative staff</p>
           </div>
           <button 
              onClick={() => setShowModal(true)}
              style={{ padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
           >
              + Add Staff Member
           </button>
        </div>

        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                 <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b' }}>NAME</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b' }}>ROLE</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b' }}>EMAIL</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b' }}>STATUS</th>
                 </tr>
              </thead>
              <tbody>
                 {staff.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                       <td style={{ padding: '16px 24px', fontWeight: 700 }}>{s.name}</td>
                       <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                             padding: '4px 10px', 
                             borderRadius: '6px', 
                             fontSize: '11px', 
                             fontWeight: 800, 
                             textTransform: 'uppercase',
                             background: s.role === 'doctor' ? '#f0fdfa' : '#f1f5f9',
                             color: s.role === 'doctor' ? '#0d9488' : '#475569'
                          }}>
                             {s.role}
                          </span>
                       </td>
                       <td style={{ padding: '16px 24px', color: '#64748b' }}>{s.email}</td>
                       <td style={{ padding: '16px 24px' }}><span style={{ color: '#10b981', fontWeight: 700 }}>● Active</span></td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {showModal && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '600px' }}>
                 <h3 style={{ margin: '0 0 20px', fontWeight: 900 }}>Add New Employee</h3>
                 <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input required placeholder="Full Name" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                    <input required type="email" placeholder="Email Address" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
                    <select style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }} onChange={e => setNewStaff({...newStaff, role: e.target.value})}>
                       <option value="doctor">Doctor</option>
                       <option value="nurse">Nurse</option>
                       <option value="pharmacist">Pharmacist</option>
                       <option value="receptionist">Receptionist</option>
                       <option value="admin">Admin</option>
                    </select>
                    <input required type="password" placeholder="Password" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }} onChange={e => setNewStaff({...newStaff, password: e.target.value})} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                       <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white' }}>Cancel</button>
                       <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700 }}>Save Employee</button>
                    </div>
                 </form>
              </div>
           </div>
        )}
      </main>
    </div>
  );
}
