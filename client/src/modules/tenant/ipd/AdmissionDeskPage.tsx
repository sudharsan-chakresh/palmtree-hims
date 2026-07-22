import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function AdmissionDeskPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [availableBeds, setAvailableBeds] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const [form, setForm] = useState({
    patientId: "",
    wardId: "",
    bedId: "",
    admittingDoctorId: "",
    admissionReason: "",
    dailyCharge: "0"
  });

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patRes, wardRes, staffRes, recRes] = await Promise.all([
          axios.get(`${API_BASE}/api/patients?limit=100`, { headers }),
          axios.get(`${API_BASE}/api/hospital/masters/wards`, { headers }),
          axios.get(`${API_BASE}/api/hospital/staff`, { headers }),
          axios.get(`${API_BASE}/api/hospital/ipd/recommendations`, { headers })
        ]);
        setPatients(patRes.data);
        setWards(wardRes.data);
        setDoctors(staffRes.data.filter((s: any) => s.role === 'DOCTOR' || s.role === 'ADMIN' || s.role === 'doctor' || s.role === 'admin'));
        setRecommendations(recRes.data || []);
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  const handleWardChange = async (wardId: string) => {
    setForm({ ...form, wardId, bedId: "" });
    const ward = wards.find(w => w.id === wardId);
    if (ward) setForm(f => ({ ...f, dailyCharge: String(ward.base_charge || 0) }));
    
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/ipd/wards/${wardId}/beds`, { headers });
      setAvailableBeds(res.data.filter((b: any) => b.status === 'Vacant'));
    } catch (err) { console.error(err); }
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.bedId || !form.admittingDoctorId) {
      showToast("Please fill all required fields.", "error");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/hospital/ipd/admissions`, form, { headers });
      showToast("Patient admitted successfully.", "success");
      navigate("/tenant/ipd/admissions");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Admission failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px' }}>
        <Header title="IPD Admission Desk" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
             <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>Register New Admission</h2>
             <p style={{ color: '#64748b', marginBottom: '32px' }}>Complete the inpatient enrollment and ward allocation</p>

             <form onSubmit={handleAdmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                   <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Patient</label>
                      <select required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                        value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})}
                      >
                         <option value="">Select Patient...</option>
                         {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}
                      </select>
                   </div>
                   <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Admitting Doctor</label>
                      <select required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                        value={form.admittingDoctorId} onChange={e => setForm({...form, admittingDoctorId: e.target.value})}
                      >
                         <option value="">Select Doctor...</option>
                         {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                   <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Target Ward</label>
                      <select required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                        value={form.wardId} onChange={e => handleWardChange(e.target.value)}
                      >
                         <option value="">Select Ward...</option>
                         {wards.map(w => <option key={w.id} value={w.id}>{w.name} ({w.type})</option>)}
                      </select>
                   </div>
                   <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Available Beds</label>
                      <select required style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                        value={form.bedId} onChange={e => setForm({...form, bedId: e.target.value})}
                      >
                         <option value="">Select Bed...</option>
                         {availableBeds.map(b => <option key={b.id} value={b.id}>{b.bed_number}</option>)}
                      </select>
                   </div>
                </div>

                <div>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Admission Reason</label>
                   <textarea required rows={3} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', resize: 'none' }}
                     value={form.admissionReason} onChange={e => setForm({...form, admissionReason: e.target.value})}
                     placeholder="Principal diagnosis and reason for hospitalization..."
                   />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', alignItems: 'flex-end' }}>
                   <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Daily Charge (₹)</label>
                      <input type="number" style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 700 }}
                        value={form.dailyCharge} onChange={e => setForm({...form, dailyCharge: e.target.value})}
                      />
                   </div>
                   <button type="submit" disabled={loading} style={{ 
                     width: '100%', padding: '16px', borderRadius: '16px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 900, cursor: 'pointer' 
                   }}>
                      {loading ? "PROCESSING..." : "CONFIRM ADMISSION"}
                   </button>
                </div>
             </form>
          </div>

          <aside>
             <div style={{ background: '#0f172a', color: 'white', padding: '32px', borderRadius: '32px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px' }}>Clinical Referrals</h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px' }}>Pending IPD recommendations from OPD doctors</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {recommendations.length > 0 ? recommendations.map((r, i) => (
                     <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                        onClick={() => setForm({...form, patientId: r.patient_id, admissionReason: r.reason || r.diagnosis || ""})}
                     >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                           <span style={{ fontWeight: 800, fontSize: '14px' }}>{r.patient_name}</span>
                           <span style={{ fontSize: '10px', background: '#f97316', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>URGENT</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Rec by: {r.doctor_name || 'OPD Physician'}</p>
                     </div>
                   )) : (
                     <p style={{ fontSize: '13px', color: '#475569', textAlign: 'center', padding: '20px' }}>No pending recommendations.</p>
                   )}
                </div>
             </div>

             <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Admission Policy</h3>
                <ul style={{ padding: 0, listStyle: 'none', fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   <li style={{ display: 'flex', gap: '8px' }}>• Valid ID proof required for registration</li>
                   <li style={{ display: 'flex', gap: '8px' }}>• Initial deposit applies for self-pay</li>
                   <li style={{ display: 'flex', gap: '8px' }}>• Insurance pre-auth needed for cashless</li>
                </ul>
             </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
