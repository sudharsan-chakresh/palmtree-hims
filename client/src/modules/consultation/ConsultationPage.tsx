import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { useToast } from "../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../config/api";


const Icons = {
  User: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Pulse: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  Stethoscope: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .2.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  ),
  Pill: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

export default function ConsultationPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [patientId] = useState("P-10024");
  const [patientName] = useState("John Doe");
  const [diagnosis, setDiagnosis] = useState("");
  const [drug, setDrug] = useState("");
  const [vitals, setVitals] = useState({ bp: "120/80", heartRate: "72", temp: "98.6" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/consultation`, {
        patientId,
        doctorId: localStorage.getItem("userId") || "",
        diagnosis,
        prescriptions: [{ drugName: drug, dosage: "1-0-1" }],
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-tenant-id": localStorage.getItem("tenant") || "",
        }
      });

      localStorage.setItem("encounterId", res.data.encounterId);
      showToast("Consultation saved. Opening billing.", "success");
      navigate("/billing");
    } catch (err) {
      console.error(err);
      showToast("Error saving consultation.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout print-document">
      <style>{`
        @media print {
          .no-print, sidebar, header, nav, button, .submit-btn, .dashboard-layout > div:first-child {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .dashboard-layout {
            display: block !important;
            background: white !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          section {
            border: none !important;
            box-shadow: none !important;
            padding: 10px 0 !important;
          }
          input, textarea {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="no-print">
        <Sidebar />
      </div>
      
      <main className="main-content">
        <div className="no-print">
          <Header title="Clinical Consultation" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Patient Info Card */}
            <section style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f0f7ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.User />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{patientName}</h2>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Patient ID: <span style={{ fontWeight: 600, color: '#0f172a' }}>{patientId}</span> • Male, 34 Years</p>
              </div>
            </section>

            {/* Vitals Section */}
            <section style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ color: '#ef4444' }}><Icons.Pulse /></div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Clinical Vitals</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'var(--app-bg)', borderRadius: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Blood Pressure</p>
                  <input value={vitals.bp} onChange={(e) => setVitals({...vitals, bp: e.target.value})} style={{ background: 'transparent', border: 'none', fontSize: '18px', fontWeight: 700, width: '100%', outline: 'none' }} />
                </div>
                <div style={{ padding: '16px', background: 'var(--app-bg)', borderRadius: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Heart Rate (bpm)</p>
                  <input value={vitals.heartRate} onChange={(e) => setVitals({...vitals, heartRate: e.target.value})} style={{ background: 'transparent', border: 'none', fontSize: '18px', fontWeight: 700, width: '100%', outline: 'none' }} />
                </div>
                <div style={{ padding: '16px', background: 'var(--app-bg)', borderRadius: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Temperature (°F)</p>
                  <input value={vitals.temp} onChange={(e) => setVitals({...vitals, temp: e.target.value})} style={{ background: 'transparent', border: 'none', fontSize: '18px', fontWeight: 700, width: '100%', outline: 'none' }} />
                </div>
              </div>
            </section>

            {/* Diagnosis & Notes */}
            <section style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ color: '#3b82f6' }}><Icons.Stethoscope /></div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Diagnosis & Clinical Notes</h3>
              </div>
              <textarea 
                placeholder="Start typing clinical findings and diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                style={{ width: '100%', height: '200px', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'var(--app-bg)', outline: 'none', fontSize: '15px', lineHeight: '1.6' }}
              />
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ color: '#10b981' }}><Icons.Pill /></div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Prescription</h3>
              </div>
              <input 
                placeholder="Medicine Name" 
                value={drug}
                onChange={(e) => setDrug(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'var(--app-bg)', outline: 'none', marginBottom: '24px' }}
              />
              <button 
                onClick={submit}
                disabled={loading}
                className="submit-btn"
                style={{ background: 'var(--primary-dark)', width: '100%' }}
              >
                {loading ? "Saving..." : <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><Icons.Check /> Finish & Bill</div>}
              </button>
              
              <button 
                onClick={() => window.print()}
                className="no-print"
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}
              >
                Print Record
              </button>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
