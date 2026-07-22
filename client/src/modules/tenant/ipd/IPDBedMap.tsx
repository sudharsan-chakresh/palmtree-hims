import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";


const WARD_COLORS: Record<string, { bg: string; badge: string; text: string }> = {
  "Regular Care": { bg: "#eff6ff", badge: "#3b82f6", text: "#1e40af" },
  "ICU":          { bg: "#fff1f2", badge: "#f43f5e", text: "#9f1239" },
  "Emergency":    { bg: "#fff7ed", badge: "#f97316", text: "#c2410c" },
  "Daycare":      { bg: "#f0fdf4", badge: "#22c55e", text: "#15803d" },
  "Special Care": { bg: "#fdf4ff", badge: "#a855f7", text: "#7e22ce" },
};

export default function IPDBedMap() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [wards, setWards] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWard, setActiveWard] = useState<any>(null);
  const [wardBeds, setWardBeds] = useState<any[]>([]);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [admitForm, setAdmitForm] = useState({
    patientId: "", wardId: "", bedId: "", admittingDoctorId: "",
    admissionReason: "", dailyCharge: "0"
  });

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [wardRes, patRes, staffRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/ipd/bedmap`, { headers }),
        axios.get(`${API_BASE}/api/patients?limit=100`, { headers }),
        axios.get(`${API_BASE}/api/hospital/staff`, { headers }),
      ]);
      setWards(wardRes.data);
      setPatients(patRes.data);
      setStaff(staffRes.data.filter((s: any) => s.role?.toLowerCase() === 'doctor' || s.role?.toLowerCase() === 'admin'));
      if (wardRes.data.length > 0) selectWard(wardRes.data[0]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectWard = async (ward: any) => {
    setActiveWard(ward);
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/ipd/wards/${ward.id}/beds`, { headers });
      setWardBeds(res.data);
      // If no beds provisioned yet, provision them
      if (res.data.length === 0) {
        await axios.post(`${API_BASE}/api/hospital/ipd/wards/${ward.id}/provision-beds`, {}, { headers });
        const res2 = await axios.get(`${API_BASE}/api/hospital/ipd/wards/${ward.id}/beds`, { headers });
        setWardBeds(res2.data);
      }
    } catch (err) { console.error(err); }
  };

  const openAdmitModal = (bed: any) => {
    setSelectedBed(bed);
    setAdmitForm(f => ({ 
      ...f, 
      bedId: bed.id, 
      wardId: activeWard.id,
      dailyCharge: String(activeWard.base_charge || "0")
    }));
    setShowAdmitModal(true);
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/hospital/ipd/admissions`, admitForm, { headers });
      showToast("Patient admitted successfully.", "success");
      setShowAdmitModal(false);
      selectWard(activeWard);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Admission failed", "error");
    }
  };

  const totalOccupied = wards.reduce((acc, w) => acc + Number(w.occupied || 0), 0);
  const totalBeds = wards.reduce((acc, w) => acc + Number(w.capacity || 0), 0);
  const occupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <Header title="IPD Census & Bed Management" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#eff6ff', color: '#3b82f6', display: 'grid', placeItems: 'center', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.1)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>
            </svg>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Inpatient Census Command</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Real-time bed availability tracking, patient admission logistics, and ward utilization surveillance.</p>
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {[
            { label: 'Total Beds', value: totalBeds, color: '#3b82f6', icon: '🛏️' },
            { label: 'Occupied', value: totalOccupied, color: '#ef4444', icon: '🔴' },
            { label: 'Available', value: totalBeds - totalOccupied, color: '#10b981', icon: '🟢' },
            { label: 'Occupancy Rate', value: `${occupancyRate}%`, color: occupancyRate > 80 ? '#ef4444' : '#f59e0b', icon: '📊' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{s.icon}</div>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</p>
              <p style={{ margin: '6px 0 0', fontSize: '28px', fontWeight: 900, color: s.color }}>{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '28px' }}>
          {/* Ward List */}
          <aside>
            <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: 'var(--app-bg)' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Care Categories</h3>
              </div>
              <div style={{ padding: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
                {["Emergency", "ICU", "Special Care", "Regular Care", "Daycare"].map(category => {
                  const categoryWards = wards.filter(w => w.type === category);
                  if (categoryWards.length === 0) return null;
                  
                  return (
                    <div key={category} style={{ marginBottom: '20px' }}>
                      <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{category}</div>
                      {categoryWards.map((ward, i) => {
                        const color = WARD_COLORS[ward.type] || WARD_COLORS["Regular Care"];
                        const pct = ward.capacity > 0 ? Math.round((Number(ward.occupied) / Number(ward.capacity)) * 100) : 0;
                        return (
                          <div key={i} onClick={() => selectWard(ward)} style={{
                            padding: '12px 16px', borderRadius: '12px', marginTop: '4px', cursor: 'pointer',
                            background: activeWard?.id === ward.id ? color.bg : 'transparent',
                            border: `1px solid ${activeWard?.id === ward.id ? color.badge : 'transparent'}`,
                            transition: 'all 0.2s'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{ward.name}</span>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: color.text }}>{ward.occupied}/{ward.capacity}</span>
                            </div>
                            <div style={{ height: '3px', background: '#f1f5f9', borderRadius: '2px' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#ef4444' : color.badge, borderRadius: '2px' }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => navigate('/tenant/ipd/admissions')}
              style={{ width: '100%', marginTop: '16px', padding: '14px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', fontSize: '14px' }}
            >
              📋 View All Admissions
            </button>
          </aside>

          {/* Bed Grid */}
          <section>
            <div style={{ background: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{activeWard?.name || 'Select a Ward'}</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>{activeWard?.floor} · {activeWard?.type}</p>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  {[
                    { color: '#f0fdf4', border: '#86efac', label: 'Vacant' },
                    { color: '#fee2e2', border: '#fca5a5', label: 'Occupied' },
                    { color: '#fffbeb', border: '#fcd34d', label: 'Maintenance' },
                  ].map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '14px', height: '14px', background: l.color, border: `1px solid ${l.border}`, borderRadius: '4px' }}></div>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                {wardBeds.map((bed, i) => {
                  const isOccupied = bed.status === 'Occupied';
                  const isMaint = bed.status === 'Maintenance';
                  const bg = isOccupied ? '#fee2e2' : isMaint ? '#fffbeb' : '#f0fdf4';
                  const border = isOccupied ? '#fca5a5' : isMaint ? '#fcd34d' : '#86efac';
                  const textColor = isOccupied ? '#ef4444' : isMaint ? '#f59e0b' : '#10b981';
                  return (
                    <div
                      key={i}
                      onClick={() => !isOccupied && !isMaint && openAdmitModal(bed)}
                      style={{
                        padding: '20px 16px', borderRadius: '20px', background: bg, border: `2px solid ${border}`,
                        cursor: isOccupied ? 'default' : 'pointer',
                        textAlign: 'center', transition: 'all 0.2s',
                        boxShadow: isOccupied ? '0 4px 12px rgba(239, 68, 68, 0.1)' : 'none'
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                        <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>
                      </svg>
                      <div style={{ fontWeight: 900, fontSize: '13px', color: '#0f172a' }}>{bed.bed_number}</div>
                      {isOccupied ? (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: textColor, marginTop: '4px' }}>{bed.patient_name?.split(' ')[0]}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{bed.mrn}</div>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/tenant/ipd/admissions/${bed.admission_id}`); }}
                            style={{ marginTop: '8px', padding: '4px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            VIEW
                          </button>
                        </>
                      ) : (
                        <div style={{ fontSize: '11px', color: textColor, fontWeight: 700, marginTop: '6px' }}>
                          {isMaint ? 'Maintenance' : '+ Admit Patient'}
                        </div>
                      )}
                    </div>
                  );
                })}
                {wardBeds.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                    Select a ward to see beds
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Admit Modal */}
        {showAdmitModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '32px', width: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>Admit Patient</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                    {activeWard?.name} · <strong>{selectedBed?.bed_number}</strong>
                  </p>
                </div>
                <button onClick={() => setShowAdmitModal(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', color: '#64748b', fontSize: '18px' }}>✕</button>
              </div>

              <form onSubmit={handleAdmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Patient</label>
                  <select required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '14px' }}
                    onChange={e => setAdmitForm(f => ({ ...f, patientId: e.target.value }))}
                  >
                    <option value="">Search & Select Patient...</option>
                    {patients.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Admitting Doctor</label>
                  <select required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '14px' }}
                    onChange={e => setAdmitForm(f => ({ ...f, admittingDoctorId: e.target.value }))}
                  >
                    <option value="">Select Doctor...</option>
                    {staff.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Admission Reason / Presenting Complaints</label>
                  <textarea required rows={3} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', resize: 'none', fontSize: '14px' }}
                    placeholder="e.g. Chest pain, shortness of breath..."
                    onChange={e => setAdmitForm(f => ({ ...f, admissionReason: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Daily Bed Charge (₹)</label>
                  <input type="number" required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '14px' }}
                    value={admitForm.dailyCharge}
                    onChange={e => setAdmitForm(f => ({ ...f, dailyCharge: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowAdmitModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ flex: 2, padding: '16px', borderRadius: '16px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 900, fontSize: '15px', cursor: 'pointer' }}>
                    Confirm Admission
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
