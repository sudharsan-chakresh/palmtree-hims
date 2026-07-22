import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";

import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function MastersPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const [departments, setDepartments] = useState<any[]>([]);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [specialities, setSpecialities] = useState<any[]>([]);
  const [modes, setModes] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("departments");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState<any>({ 
    name: '', price: '', category: '', description: '',
    uom: '', instructions: '', details: '', icd_code: '',
    severity_level: 'Moderate', cpt_code: '', estimated_duration: '',
    hod: '', specialty: '', service_code: '', tax_percent: '',
    fee: '', surcharge: '', is_virtual: false,
    composition: '', dosage_adult: '', dosage_pediatric: ''
  });

  useEffect(() => {
    // Normalize role — backend seeds as uppercase (ADMIN), users table as lowercase (admin)
    if ((role || '').toLowerCase() !== 'admin') { navigate("/tenant/dashboard"); return; }
    fetchData();
  }, [role, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-tenant-id": localStorage.getItem("tenant") || ""
      };
      const requests = [
        axios.get(`${API_BASE}/api/hospital/masters/departments`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/diseases`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/treatments`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/services`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/medicines`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/diagnostics`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/specialities`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/modes`, { headers }),
        axios.get(`${API_BASE}/api/hospital/masters/wards`, { headers })
      ];

      const [depRes, disRes, treRes, serRes, medRes, diagRes, specRes, modeRes, wardsRes] = await Promise.allSettled(requests);

      if (depRes.status === 'fulfilled') setDepartments(depRes.value.data);
      if (disRes.status === 'fulfilled') setDiseases(disRes.value.data);
      if (treRes.status === 'fulfilled') setTreatments(treRes.value.data);
      if (serRes.status === 'fulfilled') setServices(serRes.value.data);
      if (medRes.status === 'fulfilled') setMedicines(medRes.value.data);
      if (diagRes.status === 'fulfilled') setDiagnostics(diagRes.value.data);
      if (specRes.status === 'fulfilled') setSpecialities(specRes.value.data);
      if (modeRes.status === 'fulfilled') setModes(modeRes.value.data);
      if (wardsRes.status === 'fulfilled') setWards(wardsRes.value.data);
    } catch (err) {
      console.error("Failed to fetch masters", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const headers = { 
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-tenant-id": localStorage.getItem("tenant") || ""
      };
      await axios.post(`${API_BASE}/api/hospital/masters/${activeTab}`, newItem, { headers });
      alert(`${activeConfig.label.slice(0, -1)} added successfully!`);
      setShowAddModal(false);
      setNewItem({ 
        name: '', price: '', category: '', description: '',
        uom: '', instructions: '', details: '', icd_code: '',
        severity_level: 'Moderate', cpt_code: '', estimated_duration: '',
        hod: '', specialty: '', service_code: '', tax_percent: '',
        fee: '', surcharge: '', is_virtual: false,
        composition: '', dosage_adult: '', dosage_pediatric: ''
      });
      fetchData();
    } catch (err) {
      console.error("Master add error:", err);
      alert("Failed to add master data. Please check if all fields are correct.");
    }
  };

  const handleProvision = async (wardId: string) => {
    try {
      const headers = { 
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-tenant-id": localStorage.getItem("tenant") || ""
      };
      await axios.post(`${API_BASE}/api/hospital/ipd/wards/${wardId}/provision-beds`, {}, { headers });
      alert("Beds provisioned successfully for this ward!");
    } catch (err) {
      alert("Failed to provision beds");
    }
  };

  const tabConfigs: Record<string, any> = {
    departments: {
      label: 'Departments',
      cols: [
        { header: 'Department', value: (item: any) => item.name },
        { header: 'Specialty', value: (item: any) => item.specialty },
        { header: 'HOD', value: (item: any) => item.hod },
        { header: 'Status', value: (item: any) => item.status }
      ]
    },
    specialities: {
      label: 'Specialities',
      singular: 'Speciality',
      cols: [
        { header: 'Speciality', value: (item: any) => item.name },
        { header: 'Consultation Fee', value: (item: any) => `₹${item.base_consultation_fee || item.fee || 0}` },
        { header: 'Notes', value: (item: any) => item.description || '-' }
      ]
    },
    modes: {
      label: 'Modes',
      cols: [
        { header: 'Mode', value: (item: any) => item.name },
        { header: 'Surcharge', value: (item: any) => `${item.surcharge_percent || item.surcharge || 0}%` },
        { header: 'Virtual', value: (item: any) => item.is_virtual ? 'Yes' : 'No' }
      ]
    },
    diseases: {
      label: 'Diseases',
      cols: [
        { header: 'Disease', value: (item: any) => item.name },
        { header: 'ICD Code', value: (item: any) => item.icd_code },
        { header: 'Category', value: (item: any) => item.category },
        { header: 'Severity', value: (item: any) => item.severity_level }
      ]
    },
    treatments: {
      label: 'Treatments',
      cols: [
        { header: 'Treatment', value: (item: any) => item.name },
        { header: 'CPT Code', value: (item: any) => item.cpt_code },
        { header: 'Duration', value: (item: any) => `${item.estimated_duration || 0} mins` },
        { header: 'Price', value: (item: any) => `₹${item.price || 0}` }
      ]
    },
    diagnostics: {
      label: 'Diagnostics',
      cols: [
        { header: 'Test Name', value: (item: any) => item.name },
        { header: 'Category', value: (item: any) => item.type_name || 'Standard' },
        { header: 'Price', value: (item: any) => `₹${item.price || 0}` }
      ]
    },
    services: {
      label: 'Services',
      cols: [
        { header: 'Service', value: (item: any) => item.name },
        { header: 'Category', value: (item: any) => item.category },
        { header: 'Code', value: (item: any) => item.service_code },
        { header: 'Price', value: (item: any) => `₹${item.price || 0}` }
      ]
    },
    medicines: {
      label: 'Medicines',
      cols: [
        { header: 'Medicine', value: (item: any) => item.name },
        { header: 'Category', value: (item: any) => item.category },
        { header: 'Adult Dose', value: (item: any) => item.dosage_adult || '-' },
        { header: 'Pediatric Dose', value: (item: any) => item.dosage_pediatric || '-' }
      ]
    },
    wards: {
      label: 'Wards & Beds',
      cols: [
        { header: 'Ward Name', value: (item: any) => item.name },
        { header: 'Category', value: (item: any) => item.type },
        { header: 'Floor', value: (item: any) => item.floor },
        { header: 'Capacity', value: (item: any) => `${item.capacity} Beds` },
        { header: 'Action', value: (item: any) => (
          <button 
            onClick={() => handleProvision(item.id)}
            style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontWeight: 800, cursor: 'pointer' }}
          >
            Provision Beds
          </button>
        )}
      ]
    }
  };

  const activeConfig = tabConfigs[activeTab];
  const activeData = activeTab === 'departments'
    ? departments
    : activeTab === 'diseases'
      ? diseases
      : activeTab === 'treatments'
        ? treatments
        : activeTab === 'services'
          ? services
          : activeTab === 'medicines'
            ? medicines
            : activeTab === 'diagnostics'
              ? diagnostics
              : activeTab === 'specialities'
                ? specialities
                : activeTab === 'modes'
                  ? modes
                  : activeTab === 'wards'
                    ? wards
                    : [];
  const totalMasters = departments.length + diseases.length + treatments.length + services.length + medicines.length + diagnostics.length + specialities.length + modes.length + wards.length;

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: '#f4f6fb' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px' }}>
        <Header title="Master Data Management" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px', marginBottom: '40px' }}>
          <div style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: '#e0e7ff', display: 'grid', placeItems: 'center', color: '#4338ca' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Catalog Context</p>
            </div>
            <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7, fontSize: '15px' }}>Review and manage the centralized clinical operational masters aligned with the active hospital workflow.</p>
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', width: '100%', maxWidth: '600px' }}>
            <div style={{ flex: 1, background: 'white', borderRadius: '20px', padding: '22px', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.05)', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Master rows</p>
              <p style={{ margin: '14px 0 0', fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>{totalMasters}</p>
            </div>
            <div style={{ flex: 1, background: 'white', borderRadius: '20px', padding: '22px', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.05)', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Active section</p>
              <p style={{ margin: '14px 0 0', fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>{activeConfig.label}</p>
              <p style={{ margin: '10px 0 0', color: '#4338ca', fontWeight: 800 }}>{activeData.length} records</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'white', padding: '10px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
            {Object.entries(tabConfigs).map(([tab, config]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '14px',
                  border: 'none',
                  background: activeTab === tab ? '#4338ca' : 'transparent',
                  color: activeTab === tab ? 'white' : '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {config.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '14px 24px',
              borderRadius: '16px',
              background: '#4338ca',
              color: 'white',
              border: 'none',
              fontWeight: 800,
              boxShadow: '0 16px 30px rgba(67, 56, 202, 0.18)',
              cursor: 'pointer'
            }}
          >
            + Add {activeConfig.singular || activeConfig.label.slice(0, -1)}
          </button>
        </div>

        {showAddModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ width: '560px', background: 'white', borderRadius: '28px', padding: '32px', boxShadow: '0 35px 90px rgba(15, 23, 42, 0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
               <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>Add new {activeConfig.singular || activeConfig.label.slice(0, -1)}</h3>
              <p style={{ margin: '12px 0 24px', color: '#64748b', lineHeight: 1.7 }}>Create a new master record for the selected hospital master category.</p>
              <div style={{ display: 'grid', gap: '16px' }}>
                <input placeholder="Name / Title" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                {activeTab === 'medicines' && (
                  <>
                    <input placeholder="Category" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} />
                    <textarea placeholder="Composition" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', minHeight: '100px' }} value={newItem.composition} onChange={e => setNewItem({ ...newItem, composition: e.target.value })} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <input placeholder="Adult dosage" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.dosage_adult} onChange={e => setNewItem({ ...newItem, dosage_adult: e.target.value })} />
                      <input placeholder="Pediatric dosage" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.dosage_pediatric} onChange={e => setNewItem({ ...newItem, dosage_pediatric: e.target.value })} />
                    </div>
                  </>
                )}
                {activeTab === 'departments' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <input placeholder="HOD Name" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.hod} onChange={e => setNewItem({ ...newItem, hod: e.target.value })} />
                    <input placeholder="Primary Specialty" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.specialty} onChange={e => setNewItem({ ...newItem, specialty: e.target.value })} />
                  </div>
                )}
                {activeTab === 'specialities' && (
                   <input placeholder="Consultation Fee (₹)" type="number" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.fee} onChange={e => setNewItem({ ...newItem, fee: e.target.value })} />
                )}
                {(activeTab === 'services' || activeTab === 'treatments' || activeTab === 'diagnostics') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <input placeholder={activeTab === 'services' ? 'Service Code' : activeTab === 'treatments' ? 'CPT Code' : 'Category'} style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={activeTab === 'services' ? newItem.service_code : activeTab === 'treatments' ? newItem.cpt_code : newItem.category} onChange={e => setNewItem({ ...newItem, [activeTab === 'services' ? 'service_code' : activeTab === 'treatments' ? 'cpt_code' : 'category']: e.target.value })} />
                    <input placeholder="Price" type="number" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                  </div>
                )}
                {activeTab === 'wards' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <select 
                        style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 }}
                        value={newItem.type} onChange={e => setNewItem({ ...newItem, type: e.target.value })}
                      >
                        <option value="">Select Care Type...</option>
                        <option value="Emergency">Emergency</option>
                        <option value="ICU">ICU</option>
                        <option value="Special Care">Special Care</option>
                        <option value="Regular Care">Regular Care</option>
                        <option value="Daycare">Daycare</option>
                      </select>
                      <input placeholder="Floor (e.g. 1st Floor)" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.floor} onChange={e => setNewItem({ ...newItem, floor: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <input placeholder="Capacity (No. of Beds)" type="number" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.capacity} onChange={e => setNewItem({ ...newItem, capacity: e.target.value })} />
                      <input placeholder="Base Daily Charge" type="number" style={{ padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc' }} value={newItem.base_charge} onChange={e => setNewItem({ ...newItem, base_charge: e.target.value })} />
                    </div>
                  </>
                )}
                <textarea placeholder="Details / Notes" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', minHeight: '80px' }} value={newItem.description || newItem.category} onChange={e => setNewItem({ ...newItem, description: e.target.value, category: e.target.value })} />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 700 }}>Cancel</button>
                  <button onClick={handleAdd} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: 'none', background: '#4338ca', color: 'white', fontWeight: 800 }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '28px', boxShadow: '0 25px 60px rgba(15, 23, 42, 0.08)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '44px', textAlign: 'center', color: '#64748b' }}>Loading master data...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#eef2ff', borderBottom: '1px solid #e2e8f0' }}>
                  {activeConfig.cols.map((col: any) => (
                    <th key={col.header} style={{ padding: '18px 24px', fontSize: '13px', fontWeight: 700, color: '#334155', letterSpacing: '0.02em' }}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeData.length === 0 ? (
                  <tr><td colSpan={activeConfig.cols.length} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No {activeConfig.label.toLowerCase()} defined in this shard yet. Add a new record to get started.</td></tr>
                ) : activeData.map((item: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {activeConfig.cols.map((col: any) => (
                      <td key={col.header} style={{ padding: '18px 24px', fontSize: '14px', color: '#1e293b' }}>{col.value(item)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
