import { useState } from "react";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { API_BASE_URL as API_BASE } from "../../config/api";


const Icons = {
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
};

export default function AppointmentsPage() {
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);

  const createAppointment = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/appointments`, {
        patientId,
        doctorId: localStorage.getItem("userId") || "",
        time: new Date(),
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-tenant-id": localStorage.getItem("tenant") || "",
        }
      });
      alert("Appointment Created Successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Appointments" />

        <div style={{ maxWidth: '600px' }}>
          <section className="form-card">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#3b82f6' }}><Icons.Calendar /></div>
                <h3 className="section-title">Book New Appointment</h3>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Patient ID</label>
              <input
                placeholder="Enter Patient ID (e.g. P-10024)"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="form-input"
              />
            </div>

            <button 
              onClick={createAppointment} 
              className="button-primary" 
              disabled={loading}
            >
              {loading ? "Booking..." : <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icons.Plus /> Book Appointment</div>}
            </button>
          </section>

          <div style={{ marginTop: '40px' }}>
            <div className="section-header">
              <h3 className="section-title">Upcoming Today</h3>
            </div>
            <div className="page-card" style={{ overflow: 'hidden' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ padding: '20px', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '15px' }}>Patient #{1000 + i}</p>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>General Checkup • 10:30 AM</p>
                  </div>
                  <span className="status-pill success">Scheduled</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
