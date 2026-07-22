import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import {
  User, Activity, Pill, FlaskConical,
  CheckCircle2, FileText,
  Stethoscope, Thermometer, Scale, Zap,
  AlertTriangle, Info, Briefcase, Sparkles, Brain, Loader2, Wand2, Timer,
  HeartPulse, ChevronDown
} from 'lucide-react';
import PrescriptionTab from './components/PrescriptionTab';
import LabTab from './components/LabTab';
import ClinicalHistoryTab from './components/ClinicalHistoryTab';

export default function OPDConsultationPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const role = localStorage.getItem("role");
  const [encounter, setEncounter] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);

  // Master Data
  const [medicines, setMedicines] = useState<any[]>([]);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);

  // Consult State
  const [diagnosis, setDiagnosis] = useState("");
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [medSearch, setMedSearch] = useState("");
  const [filteredMeds, setFilteredMeds] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('prescription');
  const [showPostConsultModal, setShowPostConsultModal] = useState(false);

  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Clinical History
  const [pastLabs, setPastLabs] = useState<any[]>([]);
  const [pastMeds, setPastMeds] = useState<any[]>([]);
  const [isAdmissionPrescribed, setIsAdmissionPrescribed] = useState(false);
  const [admissionReason, setAdmissionReason] = useState("");
  const [predictions, setPredictions] = useState<any>(null);

  // Timer
  const [hasStarted, setHasStarted] = useState(() => localStorage.getItem("isAutomation") === "true");
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Sticky HUD ref
  const mainContentRef = useRef<HTMLDivElement>(null);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  useEffect(() => {
    if (!role) { navigate("/"); return; }
    const data = localStorage.getItem("currentEncounter");
    if (data) {
      const enc = JSON.parse(data);
      setEncounter(enc);
      fetchPatientDetails(enc.patient_id);
    }
    fetchMasters();
  }, []);

  useEffect(() => {
    if (patient && encounter) fetchPredictions();
  }, [patient]);

  const fetchPredictions = async () => {
    if (!patient || !encounter) return;
    try {
      const res = await axios.post(`${API_BASE}/api/consultations/predict`, {
        patientId: patient.id, encounterId: encounter.id,
        complaints: encounter.complaints || "Routine checkup",
        doctorId: localStorage.getItem("userId") || ""
      }, { headers: getHeaders() });
      setPredictions(res.data);
    } catch (err) { console.error("Prediction failed:", err); }
  };

  const recordEvent = async (eventType: string, metadata: any = {}) => {
    try {
      await axios.post(`${API_BASE}/api/consultations/events`, {
        encounterId: encounter.id, eventType, metadata
      }, { headers: getHeaders() });
    } catch (err) { console.error(`Failed to record event ${eventType}:`, err); }
  };

  const startConsultation = () => { setHasStarted(true); recordEvent('CONSULT_START'); };
  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    recordEvent(next ? 'PAUSE' : 'RESUME', { elapsedSeconds });
  };

  useEffect(() => {
    let interval: any;
    if (hasStarted && !isPaused) {
      interval = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [hasStarted, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchPatientDetails = async (id: string) => {
    try {
      const res = await axios.get(`${API_BASE}/api/patients/${id}`, { headers: getHeaders() });
      setPatient(res.data);
      const [labRes, medRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/lab/orders?patientId=${id}`, { headers: getHeaders() }),
        axios.get(`${API_BASE}/api/hospital/encounters?patientId=${id}&status=Completed`, { headers: getHeaders() })
      ]);
      setPastLabs(labRes.data || []);
      const medList = Array.isArray(medRes.data) ? medRes.data : (Array.isArray(medRes.data?.data) ? medRes.data.data : []);
      setPastMeds(medList);
    } catch (err) { console.error(err); }
  };

  const fetchMasters = async () => {
    try {
      const h = getHeaders();
      const [medRes, disRes, diagRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/masters/medicines`, { headers: h }),
        axios.get(`${API_BASE}/api/hospital/masters/diseases`, { headers: h }),
        axios.get(`${API_BASE}/api/hospital/masters/diagnostics`, { headers: h })
      ]);
      setMedicines(medRes.data || []);
      setDiseases(disRes.data || []);
      setDiagnostics(diagRes.data || []);
    } catch (err) {
      console.error(err);
      showToast("Master data fetch failed. Some clinical dropdowns may be empty.", "info");
    }
  };

  const handleMedSearch = (val: string) => {
    setMedSearch(val);
    if (val.length < 1) { setFilteredMeds([]); return; }
    const filtered = (medicines || []).filter(m =>
      (m.name || "").toLowerCase().includes(val.toLowerCase()) ||
      (m.composition || "").toLowerCase().includes(val.toLowerCase())
    ).slice(0, 8);
    setFilteredMeds(filtered);
  };

  const addMed = (m: any) => {
    setPrescriptions([...prescriptions, {
      medicine_id: m.id, name: m.name, composition: m.composition,
      dosage: '1 Tab', frequency: '1-0-1', duration: '5', instructions: '-', note: ''
    }]);
    setMedSearch(""); setFilteredMeds([]);
  };

  const printPrescription = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow popups to print the prescription."); return; }
    const medRows = prescriptions.map((m, idx) => `
      <tr>
        <td style="font-weight:700;padding:10px;border-bottom:1px solid #e2e8f0">${idx + 1}. ${m.name}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${m.dosage || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${m.frequency || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${m.duration || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${m.instructions || ''}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${m.note || ''}</td>
      </tr>
    `).join("");
    const htmlContent = `
      <html><head><title>Prescription_${encounter?.patient_name || 'Patient'}</title>
      <style>body{font-family:'Helvetica Neue',Arial,sans-serif;padding:40px;color:#1e293b}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #3b82f6;padding-bottom:20px;margin-bottom:30px}
      .hospital-title{font-size:24px;font-weight:800;color:#1e3a8a}.hospital-sub{font-size:12px;color:#64748b;margin-top:4px}
      .doctor-info{text-align:right}.doc-name{font-size:16px;font-weight:700}.doc-sub{font-size:12px;color:#64748b}
      .patient-card{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:30px}
      .info-label{font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;margin-bottom:2px}
      .rx-symbol{font-size:32px;font-weight:800;color:#3b82f6;margin-bottom:16px;font-family:Georgia,serif}
      .med-table{width:100%;border-collapse:collapse;margin-bottom:40px}
      .med-table th{text-align:left;padding:10px;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase}
      .footer{margin-top:80px;display:flex;justify-content:space-between;align-items:flex-end}
      .sig-line{border-top:1px solid #94a3b8;width:200px;text-align:center;padding-top:8px;font-size:12px;color:#64748b;font-weight:600}
      </style></head><body>
      <div class="header"><div><div class="hospital-title">${localStorage.getItem("tenantName") || "PALMTREE CLINICS"}</div><div class="hospital-sub">Integrated Health Management System</div></div>
      <div class="doctor-info"><div class="doc-name">Dr. ${encounter?.doctor_name || 'Consultant'}</div><div class="doc-sub">Attending Practitioner</div></div></div>
      <div class="patient-card">
        <div><div class="info-label">Patient Name</div><div style="font-weight:700">${encounter?.patient_name || ''}</div></div>
        <div><div class="info-label">MRN / ID</div><div>${encounter?.mrn || ''}</div></div>
        <div><div class="info-label">Age / Gender</div><div>${encounter?.age || ''} Y / ${encounter?.gender || ''}</div></div>
        <div><div class="info-label">Date</div><div>${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</div></div>
      </div>
      <div class="rx-symbol">R<sub>x</sub></div>
      <table class="med-table"><thead><tr>
        <th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Timing</th><th>Note/Advise</th>
      </tr></thead><tbody>${medRows}</tbody></table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:40px">
        <div><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px">Diagnosis</div><div style="font-weight:700">${diagnosis}</div></div>
        <div><div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px">Clinical Notes</div><div style="font-size:14px;line-height:1.6">${notes || 'Routine checkup.'}</div></div>
      </div>
      <div class="footer"><div style="font-size:11px;color:#94a3b8">Printed via HIMS Portal</div><div class="sig-line">Authorized Signature / Stamp</div></div>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
      </body></html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const finishConsultation = async () => {
    if (!diagnosis) { showToast("Clinical Diagnosis is mandatory to finish.", "error"); return; }
    setIsFinishing(true);
    const h = getHeaders();
    try {
      await axios.put(`${API_BASE}/api/hospital/encounters/${encounter.id}`, {
        diagnosis, status: 'Completed', notes
      }, { headers: h });
      if (prescriptions.length > 0) {
        await axios.post(`${API_BASE}/api/hospital/encounters/${encounter.id}/prescriptions`, { items: prescriptions }, { headers: h });
      }
      if (selectedLabTests.length > 0) {
        await axios.post(`${API_BASE}/api/hospital/encounters/${encounter.id}/lab-orders`, { diagnosticIds: selectedLabTests }, { headers: h });
      }
      if (isAdmissionPrescribed) {
        try {
          await axios.post(`${API_BASE}/api/hospital/encounters/${encounter.id}/admission-recommendation`, {
            reason: admissionReason || notes
          }, { headers: h });
        } catch (e) { console.warn("Admission rec failed", e); }
      }
      localStorage.removeItem("currentEncounter");
      await recordEvent('CONSULT_END', { totalDuration: elapsedSeconds });
      setShowPostConsultModal(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save consultation.";
      showToast(msg, "error");
    } finally { setIsFinishing(false); }
  };

  const handlePostConsultClose = () => {
    setShowPostConsultModal(false);
    navigate("/tenant/opd/queue");
  };

  const getAiAdvice = async () => {
    if (!notes && !encounter.complaints) {
      showToast("Please enter patient complaints or notes first.", "error");
      return;
    }
    setIsAiLoading(true); setShowAiPanel(true);
    try {
      const res = await axios.post(`${API_BASE}/api/consultations/ai-suggest`, {
        patientId: patient.id, complaints: notes || encounter.complaints
      }, { headers: getHeaders() });
      setAiAdvice(res.data);
    } catch (err: any) {
      if (err.response?.status === 429) {
        showToast("AI limit reached. Please wait 30 seconds.", "info");
        setAiAdvice({ error: "LIMIT", message: "Maximum clinical AI capacity reached for this minute. Please pause for 30 seconds before retry." });
      } else {
        console.error(err);
        showToast("AI Advice unavailable right now.", "error");
        setAiAdvice({ error: "FAILED", message: "The clinical AI is temporarily unreachable. Please try again in a moment." });
      }
    } finally { setIsAiLoading(false); }
  };

  const applyAiAdvice = () => {
    if (!aiAdvice) return;
    if (aiAdvice.suggested_diagnosis) setDiagnosis(aiAdvice.suggested_diagnosis);
    if (aiAdvice.proposed_medicines?.length > 0) {
      const newPrescriptions = [...prescriptions];
      aiAdvice.proposed_medicines.forEach((m: any) => {
        const sysMed = medicines.find(sm => (sm.name || "").toLowerCase().includes((m.name || "").toLowerCase()));
        newPrescriptions.push({
          medicine_id: sysMed?.id || null, name: m.name,
          dosage: m.dosage || '1 Tab', frequency: m.frequency || '1-0-1',
          duration: m.duration || '5', instructions: m.instructions || '-', note: ''
        });
      });
      setPrescriptions(newPrescriptions);
    }
    if (aiAdvice.proposed_tests?.length > 0) {
      const newTests = [...selectedLabTests];
      aiAdvice.proposed_tests.forEach((testName: string) => {
        const sysTest = diagnostics.find(sd => (sd.name || "").toLowerCase().includes(testName.toLowerCase()));
        if (sysTest && !newTests.includes(sysTest.id)) newTests.push(sysTest.id);
      });
      setSelectedLabTests(newTests);
    }
    let newNotes = notes;
    if (aiAdvice.reasoning || aiAdvice.clinical_advice) {
      newNotes += `\n\n--- AI CLINICAL NOTE ---\n${aiAdvice.clinical_advice || ''}\nReasoning: ${aiAdvice.reasoning || ''}`;
      setNotes(newNotes.trim());
    }
    showToast("AI proposal applied to consultation.", "success");
    setShowAiPanel(false);
  };

  // ── No encounter state ────────────────────────────────
  if (!encounter) return (
    <div className="dashboard-layout" style={{ backgroundColor: '#f1f5f9' }}>
      <Sidebar />
      <main className="main-content" style={{ padding: '32px' }}>
        <Header title="Clinical Consultation" />
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 140px)', alignItems: 'center', justifyContent: 'center' }}>
          <div className="page-card" style={{ padding: '48px', textAlign: 'center', maxWidth: '440px' }}>
            <Info size={48} style={{ color: '#94a3b8', margin: '0 auto 24px' }} />
            <h2 style={{ fontWeight: 900, margin: '0 0 12px' }}>No Active Patient</h2>
            <p style={{ color: '#64748b', marginBottom: '32px' }}>Please select a patient from your queue to begin the clinical consultation.</p>
            <button onClick={() => navigate("/tenant/opd/queue")} className="button-primary" style={{ width: '100%' }}>Return to Queue</button>
          </div>
        </div>
      </main>
    </div>
  );

  // ── Vitals for HUD ────────────────────────────────────
  const vitals = encounter.vitals || {};

  return (
    <div className="dashboard-layout" style={{ backgroundColor: '#f1f5f9', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* START CONSULTATION OVERLAY */}
      {!hasStarted && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(12px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="page-card" style={{ padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <Timer size={56} style={{ color: '#3b82f6', margin: '0 auto 20px', animation: 'pulse 2s infinite' }} />
            <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '14px' }}>Ready to Begin?</h2>
            <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '15px' }}>
              Starting the consultation will begin the session timer and notify the queue manager.
            </p>
            <button
              onClick={startConsultation}
              className="button-primary"
              style={{ width: '100%', padding: '18px', fontSize: '17px', borderRadius: '16px' }}
            >
              START CONSULTATION NOW
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN SCROLLABLE AREA ── */}
      <main
        ref={mainContentRef}
        className="main-content"
        style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: 0 }}
      >
        {/* Header (no-scroll) */}
        <div style={{ flexShrink: 0, padding: '20px 24px 0 24px' }}>
          <Header title="Clinical Consultation" compact={true} />
        </div>

        {/* ── STICKY PATIENT HUD ─────────────────────────── */}
        <div style={{
          flexShrink: 0,
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          {/* Top row: patient identity + timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            {/* Patient identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              <div style={{
                width: '52px', height: '52px', flexShrink: 0,
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                color: 'white', borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}>
                <User size={26} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {encounter.patient_name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 800 }}>{encounter.mrn}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px' }}>|</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{encounter.age}Y • {encounter.gender}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>
                    {patient?.blood_group || 'BG N/A'}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                    TOKEN #{encounter.token}
                  </span>
                </div>
              </div>
            </div>

            {/* Timer control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Timer size={15} style={{ color: isPaused ? '#ef4444' : '#10b981' }} />
                  <span style={{ fontSize: '20px', fontWeight: 900, color: isPaused ? '#ef4444' : '#0f172a', fontFamily: 'monospace' }}>
                    {formatTime(elapsedSeconds)}
                  </span>
                </div>
                <button onClick={togglePause} style={{ border: 'none', background: 'transparent', color: '#3b82f6', fontSize: '10px', fontWeight: 800, cursor: 'pointer', padding: '2px 0' }}>
                  {isPaused ? 'RESUME' : 'PAUSE'}
                </button>
              </div>
            </div>
          </div>

          {/* Vitals strip */}
          <div style={{
            display: 'flex', gap: '12px', marginTop: '12px',
            overflowX: 'auto', paddingBottom: '2px',
            scrollbarWidth: 'none'
          }}>
            {[
              { icon: <Activity size={13} style={{ color: '#ef4444' }} />, label: 'BP', val: vitals.bp || '--' },
              { icon: <Thermometer size={13} style={{ color: '#f59e0b' }} />, label: 'Temp', val: vitals.temp ? `${vitals.temp}°F` : '--' },
              { icon: <HeartPulse size={13} style={{ color: '#10b981' }} />, label: 'Pulse', val: vitals.heartRate || vitals.pulse || '--' },
              { icon: <Scale size={13} style={{ color: '#3b82f6' }} />, label: 'Weight', val: vitals.weight ? `${vitals.weight}kg` : '--' },
              { icon: <span style={{ fontSize: '12px', fontWeight: 900, color: '#8b5cf6' }}>Ht</span>, label: 'Height', val: vitals.height ? `${vitals.height}cm` : '--' },
              { icon: <Briefcase size={13} style={{ color: '#64748b' }} />, label: 'Occupation', val: patient?.occupation || '--' },
            ].map((v, i) => (
              <div key={i} style={{
                flexShrink: 0,
                background: 'var(--app-bg)', border: '1px solid #f1f5f9',
                borderRadius: '12px', padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                {v.icon}
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>{v.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{v.val}</div>
                </div>
              </div>
            ))}

            {/* AI predictions inline */}
            {predictions && (
              <>
                <div style={{ flexShrink: 0, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '8px 14px' }}>
                  <div style={{ fontSize: '9px', color: '#92400e', fontWeight: 800, textTransform: 'uppercase' }}>Est. Time</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#92400e' }}>{predictions.predictedTimeMins}m</div>
                </div>
                <div style={{ flexShrink: 0, background: predictions.complexity === 'High' ? '#fee2e2' : predictions.complexity === 'Medium' ? '#ffedd5' : '#dcfce7', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 14px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Complexity</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>{predictions.complexity}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* TWO-COLUMN LAYOUT (collapses on narrow screens via CSS) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'clamp(300px, 30%, 380px) 1fr',
            gap: '20px',
            alignItems: 'start'
          }}>
            {/* ── LEFT COLUMN ──────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Complaints / Chief Complaints shown from encounter */}
              {encounter.complaints && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '14px 18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: '6px' }}>Chief Complaints</div>
                  <div style={{ fontSize: '14px', color: '#78350f', fontWeight: 600 }}>{encounter.complaints}</div>
                </div>
              )}

              {/* Diagnosis */}
              <div className="page-card" style={{ padding: '20px', borderRadius: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Stethoscope size={16} style={{ color: '#3b82f6' }} /> Diagnosis
                  <span style={{ color: '#ef4444' }}>*</span>
                </h3>

                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <input
                    className="input-field"
                    placeholder="Enter clinical diagnosis..."
                    style={{
                      margin: 0, fontSize: '15px', height: '50px', borderRadius: '12px', paddingRight: '36px',
                      border: !diagnosis ? '2px solid #fca5a5' : '2px solid #86efac',
                      background: !diagnosis ? '#fff5f5' : '#f0fdf4'
                    }}
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                  />
                  <select
                    style={{ position: 'absolute', right: '10px', top: '14px', opacity: 0.15, width: '24px', cursor: 'pointer', border: 'none', background: 'transparent' }}
                    onChange={e => { if (e.target.value) setDiagnosis(e.target.value); }}
                  >
                    <option value="">ICD-10...</option>
                    {diseases.map(d => <option key={d.id} value={d.name}>{d.name} ({d.icd_code})</option>)}
                  </select>
                  <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '17px', pointerEvents: 'none', color: '#64748b' }} />
                </div>

                {/* AI Advisor */}
                <button
                  onClick={getAiAdvice}
                  disabled={isAiLoading}
                  style={{
                    width: '100%', height: '44px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                    color: 'white', fontWeight: 800, fontSize: '13px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    cursor: 'pointer', boxShadow: '0 6px 16px rgba(99,102,241,0.2)'
                  }}
                >
                  {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                  AI ADVISOR
                </button>

                {/* AI Panel */}
                {showAiPanel && (
                  <div style={{ marginTop: '14px', padding: '16px', borderRadius: '16px', background: '#f5f3ff', border: '1px solid #ddd6fe', position: 'relative' }}>
                    <button onClick={() => setShowAiPanel(false)} style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'transparent', color: '#7c3aed', cursor: 'pointer', fontWeight: 800, fontSize: '12px' }}>CLOSE</button>
                    <h4 style={{ margin: '0 0 12px', color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 900 }}>
                      <Sparkles size={14} /> AI CLINICAL PROPOSAL
                    </h4>
                    {isAiLoading ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#7c3aed' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        <p style={{ fontWeight: 700, fontSize: '13px' }}>Synthesizing clinical advice...</p>
                      </div>
                    ) : aiAdvice?.error === 'LIMIT' ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#991b1b' }}>
                        <AlertTriangle size={24} style={{ margin: '0 auto 8px' }} />
                        <p style={{ fontWeight: 800, fontSize: '13px' }}>{aiAdvice.message}</p>
                        <button onClick={getAiAdvice} style={{ marginTop: '12px', padding: '8px 16px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Retry</button>
                      </div>
                    ) : aiAdvice ? (
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e1b4b', marginBottom: '8px' }}>{aiAdvice.suggested_diagnosis}</p>
                        <p style={{ fontSize: '12px', color: '#6d28d9', fontStyle: 'italic', marginBottom: '12px' }}>{aiAdvice.reasoning}</p>
                        <button
                          onClick={applyAiAdvice}
                          style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                        >
                          <Wand2 size={14} /> APPLY PROPOSAL
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center' }}>
                        <AlertTriangle size={24} style={{ margin: '0 auto 8px', color: '#ef4444' }} />
                        <p style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '13px' }}>Failed to generate suggestions.</p>
                        <button onClick={getAiAdvice} style={{ marginTop: '12px', padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>Try Again</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clinical Notes */}
              <div className="page-card" style={{ padding: '20px', borderRadius: '20px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Clinical Notes / Findings <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  className="input-field"
                  placeholder="Type clinical observations, chief complaints, advice..."
                  style={{ height: '120px', padding: '14px', borderRadius: '14px', fontSize: '14px', lineHeight: '1.6', resize: 'vertical' }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setIsAdmissionPrescribed(true); setAdmissionReason("Acute clinical condition requiring IPD monitoring"); setNotes(notes + " [IPD_ADMISSION_ORDERED]"); }}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', flex: 1,
                      background: isAdmissionPrescribed ? '#fbbf24' : '#fff7ed',
                      border: '1px solid #ffedd5',
                      color: isAdmissionPrescribed ? 'white' : '#c2410c',
                      fontSize: '12px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    {isAdmissionPrescribed ? '✅ IPD Prescribed' : '+ IPD Admission'}
                  </button>
                  <button
                    onClick={() => setNotes(notes + " [FOLLOW_UP_7D]")}
                    style={{ padding: '8px 16px', borderRadius: '10px', flex: 1, background: '#eff6ff', border: '1px solid #dbeafe', color: '#3b82f6', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    + Follow-up 7D
                  </button>
                </div>
                {isAdmissionPrescribed && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#854d0e', marginBottom: '6px' }}>ADMISSION REASON</label>
                    <input
                      className="input-field"
                      value={admissionReason}
                      onChange={e => setAdmissionReason(e.target.value)}
                      placeholder="e.g. Severe Dehydration..."
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                )}
              </div>

              {/* FINISH BUTTON */}
              {!diagnosis && (
                <div style={{ padding: '10px 14px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={15} style={{ color: '#c2410c', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600 }}>Diagnosis is required to finish this consultation.</span>
                </div>
              )}

              <button
                disabled={isFinishing || !diagnosis}
                onClick={finishConsultation}
                style={{
                  width: '100%', padding: '20px', borderRadius: '20px', border: 'none',
                  background: diagnosis
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
                  color: 'white', fontWeight: 900, fontSize: '17px', cursor: diagnosis ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  boxShadow: diagnosis ? '0 12px 32px rgba(16,185,129,0.25)' : 'none',
                  transition: 'all 0.3s ease', opacity: isFinishing ? 0.7 : 1
                }}
              >
                {isFinishing ? (
                  <><Loader2 size={22} className="animate-spin" /> FINALIZING...</>
                ) : (
                  <><CheckCircle2 size={22} /> {diagnosis ? 'FINISH CONSULTATION' : 'DIAGNOSIS REQUIRED'}</>
                )}
              </button>
            </div>

            {/* ── RIGHT COLUMN: TABS ─────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '4px', gap: '4px' }}>
                {[
                  { key: 'prescription', label: 'Prescription', icon: <Pill size={15} />, count: prescriptions.length },
                  { key: 'lab', label: 'Lab Tests', icon: <FlaskConical size={15} />, count: selectedLabTests.length },
                  { key: 'history', label: 'History', icon: <Zap size={15} />, count: pastLabs.length + pastMeds.length }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: '10px', border: 'none',
                      background: activeTab === tab.key ? '#3b82f6' : 'transparent',
                      color: activeTab === tab.key ? 'white' : '#64748b',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {tab.icon} {tab.label}
                    {tab.count > 0 && (
                      <span style={{
                        background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                        color: activeTab === tab.key ? 'white' : '#475569',
                        padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 700
                      }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div>
                {activeTab === 'prescription' && (
                  <PrescriptionTab
                    prescriptions={prescriptions}
                    setPrescriptions={setPrescriptions}
                    medicines={medicines}
                    medSearch={medSearch}
                    setMedSearch={setMedSearch}
                    filteredMeds={filteredMeds}
                    handleMedSearch={handleMedSearch}
                    addMed={addMed}
                  />
                )}
                {activeTab === 'lab' && (
                  <LabTab
                    diagnostics={diagnostics}
                    selectedLabTests={selectedLabTests}
                    setSelectedLabTests={setSelectedLabTests}
                  />
                )}
                {activeTab === 'history' && (
                  <ClinicalHistoryTab
                    patient={patient}
                    pastLabs={pastLabs}
                    pastMeds={pastMeds}
                    onRefresh={() => fetchPatientDetails(patient.id)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── POST-CONSULTATION MODAL ─────────────────────────── */}
      {showPostConsultModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '32px', width: '100%', maxWidth: '480px', margin: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 8px', color: '#0f172a' }}>Consultation Complete</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>
                Clinical encounter recorded for <strong>{encounter.patient_name}</strong>.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', borderRadius: '20px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Next Steps</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {prescriptions.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pill size={18} /></div>
                    <div><div style={{ fontSize: '14px', fontWeight: 800 }}>Pharmacy</div><div style={{ fontSize: '12px', color: '#64748b' }}>Pick up {prescriptions.length} prescribed medicines</div></div>
                  </div>
                )}
                {selectedLabTests.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FlaskConical size={18} /></div>
                    <div><div style={{ fontSize: '14px', fontWeight: 800 }}>Diagnostic Lab</div><div style={{ fontSize: '12px', color: '#64748b' }}>{selectedLabTests.length} ordered lab tests</div></div>
                  </div>
                )}
                {isAdmissionPrescribed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={18} /></div>
                    <div><div style={{ fontSize: '14px', fontWeight: 800 }}>Admission Desk</div><div style={{ fontSize: '12px', color: '#64748b' }}>Proceed for IPD admission</div></div>
                  </div>
                )}
                {!prescriptions.length && !selectedLabTests.length && !isAdmissionPrescribed && (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>
                    No further clinical actions required.
                  </div>
                )}
              </div>
            </div>

            {prescriptions.length > 0 && (
              <button
                onClick={printPrescription}
                style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #3b82f6', background: 'white', color: '#3b82f6', fontSize: '15px', fontWeight: 800, cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <FileText size={18} /> Print Prescription
              </button>
            )}
            <button
              onClick={handlePostConsultClose}
              style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: '#0f172a', color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}
            >
              Close & Return to Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
