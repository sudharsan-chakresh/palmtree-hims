import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { 
  Search, 
  User, 
  Phone, 
  Calendar, 
  Stethoscope, 
  FileText, 
  Plus, 
  Info, 
  X, 
  Activity, 
  Heart, 
  ShieldAlert, 
  UserCheck,
  Shield,
  CheckCircle2,
  RefreshCw,
  Zap
} from "lucide-react";

export default function PatientRegisterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // ABDM / ABHA Integration states
  const [modalTab, setModalTab] = useState<'CLINICAL' | 'ABDM'>('CLINICAL');
  const [abdmStatus, setAbdmStatus] = useState<any>(null);
  const [abdmLoading, setAbdmLoading] = useState(false);
  const [consentStatus, setConsentStatus] = useState<'NONE' | 'INITIATING' | 'GRANTED'>('NONE');
  const [externalRecords, setExternalRecords] = useState<any[]>([]);
  const [consentId, setConsentId] = useState("");
  const [syncingEncounterId, setSyncingEncounterId] = useState<string | null>(null);
  const [isAbhaLoading, setIsAbhaLoading] = useState(false);
  
  // ABHA registration states
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [abhaTxnId, setAbhaTxnId] = useState("");
  const [abhaStep, setAbhaStep] = useState<'IDLE' | 'OTP_SENT' | 'VERIFIED'>('IDLE');
  const [hasConsent, setHasConsent] = useState(false);
  const [discoveredAbhas, setDiscoveredAbhas] = useState<any[]>([]);
  const [abhaMobile, setAbhaMobile] = useState("");
  const [abhaMessage, setAbhaMessage] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openPatientProfile = (p: any) => {
    setSelectedPatient(p);
    setModalTab('CLINICAL');
    setConsentStatus('NONE');
    setExternalRecords([]);
    setConsentId("");
    setAbhaStep('IDLE');
    setAadhaarInput("");
    setOtpInput("");
    setAbhaTxnId("");
    setHasConsent(false);
    setDiscoveredAbhas([]);
    setAbdmStatus(null);
  };

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  const fetchAbdmStatus = async (patientId: string) => {
    setAbdmLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/abha/patients/${patientId}/status`, { headers: getHeaders() });
      setAbdmStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch ABDM status", err);
      showToast("Failed to fetch ABDM integration details", "error");
    } finally {
      setAbdmLoading(false);
    }
  };

  const handleAbhaOtpRequest = async () => {
    if (aadhaarInput.length !== 12) {
      showToast("Please enter a valid 12-digit Aadhaar number", "error");
      return;
    }
    setIsAbhaLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/abha/generate-otp`, { aadhaar: aadhaarInput }, { headers: getHeaders() });
      setAbhaTxnId(res.data.txnId);
      setAbhaMobile(selectedPatient?.phone || "");
      setAbhaMessage(res.data.message || "OTP sent to Aadhaar-registered mobile number.");
      setAbhaStep('OTP_SENT');
      showToast("OTP sent to Aadhaar-registered mobile", "success");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to generate ABHA OTP", "error");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  const handleAbhaDiscovery = async () => {
    if (!selectedPatient?.phone || selectedPatient.phone.length < 10) {
      showToast("Patient phone contact is invalid", "error");
      return;
    }
    if (!hasConsent) {
      showToast("ABDM Consent is required for discovery", "error");
      return;
    }
    setIsAbhaLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/abha/search-mobile`, { mobile: selectedPatient.phone, patientId: selectedPatient.id }, { headers: getHeaders() });
      if (res.data.healthIds && res.data.healthIds.length > 0) {
        setDiscoveredAbhas(res.data.healthIds);
        showToast(`Found ${res.data.healthIds.length} existing ABHA(s)`, "success");
      } else {
        showToast("No existing ABHA found for this mobile. Please use Aadhaar flow.", "info");
      }
    } catch (err: any) {
      showToast("Discovery failed", "error");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  const linkDiscoveredAbha = async (abha: any) => {
    setIsAbhaLoading(true);
    try {
      await axios.post(`${API_BASE}/api/abha/patients/${selectedPatient.id}/link`, {
        abhaId: abha.healthId,
        abhaNumber: abha.healthIdNumber,
        abhaStatus: 'ACTIVE',
        abhaVerified: true
      }, { headers: getHeaders() });
      showToast("ABHA linked to patient successfully!", "success");
      setDiscoveredAbhas([]);
      setAbhaStep('IDLE');
      fetchAbdmStatus(selectedPatient.id);
      fetchPatients(searchQuery); // refresh table
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to link ABHA ID", "error");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  const handleAbhaVerify = async () => {
    if (otpInput.length !== 6) {
      showToast("Please enter 6-digit OTP", "error");
      return;
    }
    setIsAbhaLoading(true);
    try {
      const payload: any = { otp: otpInput, txnId: abhaTxnId, patientId: selectedPatient.id };
      if (abhaMobile && abhaMobile.length === 10) {
        payload.mobile = abhaMobile;
      }
      const res = await axios.post(`${API_BASE}/api/abha/verify-otp`, payload, { headers: getHeaders() });
      const profile = res.data;

      // Link in DB
      await axios.post(`${API_BASE}/api/abha/patients/${selectedPatient.id}/link`, {
        abhaId: profile.healthId || '',
        abhaNumber: profile.healthIdNumber || '',
        abhaStatus: profile.status || 'ACTIVE',
        abhaVerified: true
      }, { headers: getHeaders() });

      showToast("ABHA created and linked successfully!", "success");
      setAbhaStep('IDLE');
      setOtpInput('');
      setAbhaTxnId('');
      fetchAbdmStatus(selectedPatient.id);
      fetchPatients(searchQuery); // refresh table
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || "ABHA Verification failed";
      showToast(msg, "error");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  const handleAbhaUnlink = async () => {
    if (!selectedPatient) return;
    if (!window.confirm("Are you sure you want to unlink and clear the ABHA ID for this patient profile?")) {
      return;
    }
    setIsAbhaLoading(true);
    try {
      await axios.post(`${API_BASE}/api/abha/patients/${selectedPatient.id}/unlink`, {}, { headers: getHeaders() });
      showToast("ABHA ID unlinked and cleared successfully!", "success");
      fetchAbdmStatus(selectedPatient.id);
      fetchPatients(searchQuery); // refresh table
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to unlink ABHA ID", "error");
    } finally {
      setIsAbhaLoading(false);
    }
  };

  const handlePushEncounter = async (encounterId: string) => {
    setSyncingEncounterId(encounterId);
    try {
      await axios.post(`${API_BASE}/api/abha/encounters/${encounterId}/push`, {}, { headers: getHeaders() });
      showToast("Clinical records pushed and shared with ABDM!", "success");
      fetchAbdmStatus(selectedPatient.id);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to share records with ABDM", "error");
    } finally {
      setSyncingEncounterId(null);
    }
  };

  const handleRequestConsent = async () => {
    setConsentStatus('INITIATING');
    setTimeout(async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/abha/patients/${selectedPatient.id}/request-consent`, {}, { headers: getHeaders() });
        setConsentId(res.data.consentId);
        setConsentStatus('GRANTED');
        showToast("Consent granted by patient via ABHA PHR app!", "success");
        
        // Auto fetch external records
        const recordsRes = await axios.get(`${API_BASE}/api/abha/patients/${selectedPatient.id}/fetch-external-records?consentId=${res.data.consentId}`, { headers: getHeaders() });
        setExternalRecords(recordsRes.data || []);
      } catch (err: any) {
        showToast("Consent request failed", "error");
        setConsentStatus('NONE');
      }
    }, 1500);
  };

  const fetchPatients = async (query = "") => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/api/patients?detailed=true&search=${encodeURIComponent(query)}`,
        { headers: getHeaders() }
      );
      setPatients(res.data || []);
    } catch (err) {
      console.error("Error fetching patients detailed list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    const fetchAbhaConfig = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/abha/config`, { headers: getHeaders() });
        setIsDemoMode(res.data.isDemoMode);
      } catch (err) {
        console.error("Failed to fetch ABHA config:", err);
      }
    };
    fetchAbhaConfig();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients(searchQuery);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    // If search is cleared, fetch default list
    if (val.trim() === "") {
      fetchPatients("");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="dashboard-layout" style={{ backgroundColor: "var(--app-bg)", display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: isMobile ? "16px" : "32px", flex: 1, width: "100%" }}>
        <Header title="Patient Registry & Archives" />

        {/* Hero Section */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "12px", marginBottom: "32px", marginTop: "8px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "16px", background: "#eff6ff", display: "grid", placeItems: "center", color: "#2563eb", boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.1)" }}>
            <User size={24} />
          </div>
          <p style={{ margin: 0, color: "#475569", fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>Clinical Directory Hub</p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "15px", fontWeight: 500, maxWidth: "600px" }}>
            Search complete patient records, view clinical histories, check primary doctor relationships, and instantly schedule appointments.
          </p>
        </div>

        {/* Search & Actions Bar */}
        <div className="page-card" style={{ padding: "20px", marginBottom: "24px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: "16px", justifyContent: "space-between", alignItems: "center", background: "white", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", width: isMobile ? "100%" : "60%", gap: "8px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={18} style={{ position: "absolute", left: "14px", top: "13px", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search by Patient Name, MRN, or Phone Number..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  width: "100%",
                  padding: "10px 16px 10px 42px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 500,
                  outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)"
                }}
              />
            </div>
            <button 
              type="submit" 
              style={{
                padding: "10px 20px",
                background: "#0f172a",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              Search
            </button>
          </form>

          <button 
            onClick={() => navigate("/tenant/opd/registration")}
            style={{
              padding: "10px 20px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: isMobile ? "100%" : "auto",
              justifyContent: "center",
              boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.15)"
            }}
          >
            <Plus size={16} /> Register New Patient
          </button>
        </div>

        {/* Patients Table Card */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          {loading ? (
            <div style={{ padding: "80px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Loading patient records...</div>
              <div style={{ fontSize: "13px", color: "#94a3b8" }}>Compiling archives & clinical activity logs</div>
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: "80px", textAlign: "center", color: "#94a3b8" }}>
              <User size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
              <p style={{ fontWeight: 700, fontSize: "16px", color: "#475569", margin: "0 0 4px" }}>No Patients Found</p>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>Try adjusting your search criteria or register a new patient profile.</p>
            </div>
          ) : isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
              {patients.map((p, i) => (
                <div key={p.id || i} style={{ background: "var(--app-bg)", borderRadius: "12px", padding: "16px", border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>{p.mrn || "No MRN"}</div>
                      <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "15px" }}>{p.name}</div>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "15px", maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "15px", maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    </div>
                    <button 
                      onClick={() => openPatientProfile(p)}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                    >
                      <Info size={18} />
                    </button>
                  </div>

                  <div style={{ fontSize: "13px", color: "#475569", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Phone size={12} style={{ color: "#94a3b8" }} /> {p.phone || "No phone contact"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Stethoscope size={12} style={{ color: "#94a3b8" }} /> 
                      <span style={{ fontWeight: 600 }}>Doctor:</span> {p.primary_doctor || "No primary physician"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={12} style={{ color: "#94a3b8" }} /> 
                      <span style={{ fontWeight: 600 }}>Last Visit:</span> {formatDate(p.last_visit_date) || "No visits yet"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      onClick={() => openPatientProfile(p)}
                      style={{ flex: 1, padding: "8px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      View Profile
                    </button>
                    <button 
                      onClick={() => navigate(`/tenant/appointments/book?patientId=${p.id}`)}
                      style={{ flex: 1.5, padding: "8px", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    >
                      <Calendar size={12} /> Book Appt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--app-bg)", borderBottom: "1px solid #f1f5f9" }}>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800 }}>PATIENT ID (MRN)</th>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800 }}>PATIENT NAME</th>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800 }}>PHONE NUMBER</th>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800 }}>PATIENT HISTORY</th>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800 }}>PRIMARY DOCTOR</th>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800 }}>LAST VISITED DATE</th>
                  <th style={{ padding: "16px 24px", fontSize: "12px", color: "#64748b", fontWeight: 800, textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p, i) => (
                  <tr key={p.id || i} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} className="hover-light">
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 900, color: "#3b82f6", background: "#eff6ff", padding: "4px 8px", borderRadius: "6px" }}>
                        {p.mrn || "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{p.name}</div>
                      {p.age && <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{p.gender || "Gender N/A"}, {p.age} Yrs</div>}
                        {p.age && Number(p.age) > 0 && <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{p.gender || "Gender N/A"}, {p.age} Yrs</div>}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#475569", fontSize: "13px" }}>
                        <Phone size={13} style={{ color: "#94a3b8" }} />
                        {p.phone || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", maxWidth: "250px" }}>
                      <div style={{ fontSize: "13px", color: "#475569", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {p.medical_history || "No recorded history"}
                      </div>
                      {p.allergies && (
                        <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          Allergies: {p.allergies}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      {p.primary_doctor ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }}></span>
                          <span style={{ fontWeight: 700, color: "#334155", fontSize: "13px" }}>Dr. {p.primary_doctor}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>None assigned</span>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      {p.last_visit_date ? (
                        <span style={{ fontSize: "12px", color: "#1e293b", background: "#f1f5f9", padding: "4px 8px", borderRadius: "20px", fontWeight: 700 }}>
                          {formatDate(p.last_visit_date)}
                        </span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#64748b", background: "var(--app-bg)", border: "1px dashed #e2e8f0", padding: "3px 8px", borderRadius: "20px", fontWeight: 500 }}>
                          No visits yet
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button 
                          onClick={() => openPatientProfile(p)}
                          style={{
                            padding: "8px 14px",
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#e2e8f0"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#f1f5f9"}
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={() => navigate(`/tenant/appointments/book?patientId=${p.id}`)}
                          style={{
                            padding: "8px 14px",
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#2563eb"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#3b82f6"}
                        >
                          <Calendar size={13} />
                          Book Appt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Patient Profile Detail Modal */}
        {selectedPatient && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1050
          }}>
            <div style={{
              background: "white", padding: "32px", borderRadius: "24px", width: "90%", maxWidth: "700px",
              maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0", animation: "modalIn 0.3s ease-out"
            }}>
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px", marginBottom: "24px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#3b82f6", background: "#eff6ff", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                    Patient Dossier • {selectedPatient.mrn || "No MRN"}
                  </span>
                  <h3 style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: 900, color: "#0f172a" }}>{selectedPatient.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", padding: "8px", cursor: "pointer", display: "grid", placeItems: "center", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tab Switcher */}
              <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px" }}>
                <button
                  type="button"
                  onClick={() => setModalTab('CLINICAL')}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: modalTab === 'CLINICAL' ? '#eff6ff' : 'none',
                    color: modalTab === 'CLINICAL' ? '#2563eb' : '#64748b',
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <UserCheck size={16} /> Clinical Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalTab('ABDM');
                    fetchAbdmStatus(selectedPatient.id);
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: modalTab === 'ABDM' ? '#f0f9ff' : 'none',
                    color: modalTab === 'ABDM' ? '#0369a1' : '#64748b',
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Shield size={16} /> ABDM / ABHA Portal
                </button>
              </div>

              {/* Modal Body */}
              {modalTab === 'CLINICAL' && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* Section 1: Demographics */}
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <UserCheck size={14} style={{ color: "#3b82f6" }} /> Personal Demographics
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "16px", background: "var(--app-bg)", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>GENDER & AGE</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                          {selectedPatient.gender || "—"}, {selectedPatient.age || "—"} yrs
                        </span>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>DATE OF BIRTH</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                          {selectedPatient.dob ? formatDate(selectedPatient.dob) : "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>BLOOD GROUP</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Heart size={12} fill="#ef4444" /> {selectedPatient.blood_group || "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>CONTACT PHONE</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>{selectedPatient.phone || "—"}</span>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>EMAIL ADDRESS</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>{selectedPatient.email || "—"}</span>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>OCCUPATION</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>{selectedPatient.occupation || "—"}</span>
                      </div>
                      <div style={{ gridColumn: isMobile ? "span 1" : "span 3" }}>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>RESIDENTIAL ADDRESS</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>{selectedPatient.address || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Guardian Details */}
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Activity size={14} style={{ color: "#10b981" }} /> Emergency contact & Guardian
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px", background: "var(--app-bg)", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>GUARDIAN NAME</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>{selectedPatient.guardian_name || "—"}</span>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>GUARDIAN PHONE</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>{selectedPatient.guardian_phone || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Clinical Information */}
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Stethoscope size={14} style={{ color: "#f59e0b" }} /> Clinical Profile
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "12px", border: "1px solid #fef3c7" }}>
                        <span style={{ display: "block", fontSize: "11px", color: "#b45309", fontWeight: 800, textTransform: "uppercase" }}>Primary Medical History</span>
                        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#78350f", fontWeight: 600, lineHeight: 1.5 }}>
                          {selectedPatient.medical_history || "No documented primary medical history."}
                        </p>
                      </div>

                      {selectedPatient.allergies && (
                        <div style={{ background: "#fef2f2", padding: "16px", borderRadius: "12px", border: "1px solid #fee2e2" }}>
                          <span style={{ fontSize: "11px", color: "#b91c1c", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                            <ShieldAlert size={12} /> Critical Allergies & Intolerances
                          </span>
                          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#991b1b", fontWeight: 700, lineHeight: 1.5 }}>
                            {selectedPatient.allergies}
                          </p>
                        </div>
                      )}

                      {selectedPatient.ai_summary && (
                        <div style={{ background: "#f0fdf4", padding: "16px", borderRadius: "12px", border: "1px solid #dcfce7" }}>
                          <span style={{ fontSize: "11px", color: "#166534", fontWeight: 800, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                            <FileText size={12} /> AI Clinical Summary
                          </span>
                          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#14532d", fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                            {selectedPatient.ai_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 4: Visitation & Physician */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px", background: "var(--app-bg)", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                    <div>
                      <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>PRIMARY ASSIGNED PHYSICIAN</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        {selectedPatient.primary_doctor ? `Dr. ${selectedPatient.primary_doctor}` : "No physician consultations recorded."}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>LAST VISIT DATE</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        {selectedPatient.last_visit_date ? formatDate(selectedPatient.last_visit_date) : "No records of clinical visits."}
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {modalTab === 'ABDM' && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {abdmLoading && !abdmStatus ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                      <RefreshCw size={24} style={{ margin: "0 auto 12px", animation: "spin 1.5s linear infinite" }} />
                      <div style={{ fontSize: "14px", fontWeight: 600 }}>Fetching ABDM registration status...</div>
                    </div>
                  ) : (
                    <>
                      {/* Identity Section (Milestone 1) */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Shield size={14} style={{ color: "#0369a1" }} /> ABDM identity (Milestone 1)
                          </h4>
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: isDemoMode ? "#fff7ed" : "#ecfdf5",
                            color: isDemoMode ? "#c2410c" : "#0f766e",
                            border: isDemoMode ? "1px solid #ffedd5" : "1px solid #ccfbf1",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isDemoMode ? "#ea580c" : "#10b981" }}></span>
                            {isDemoMode ? "SANDBOX MODE: SIMULATED" : "SANDBOX MODE: LIVE GATEWAY"}
                          </span>
                        </div>
                        
                        {(abdmStatus?.patient?.abha_id || selectedPatient?.abha_id) ? (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", padding: "16px 20px", borderRadius: "16px", border: "1px solid #86efac", width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <CheckCircle2 size={20} style={{ color: "#16a34a" }} />
                              <div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "#15803d" }}>ABHA Identity Verified & Linked</div>
                                <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>
                                  ID: {abdmStatus?.patient?.abha_id || selectedPatient?.abha_id} • Number: {abdmStatus?.patient?.abha_number || selectedPatient?.abha_number}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={handleAbhaUnlink}
                              disabled={isAbhaLoading}
                              style={{
                                padding: "6px 12px",
                                background: "#fee2e2",
                                color: "#ef4444",
                                border: "1px solid #fecaca",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 800,
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#fca5a5"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#fee2e2"}
                            >
                              {isAbhaLoading ? "..." : "UNLINK ABHA"}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "#fff7ed", padding: "20px", borderRadius: "16px", border: "1px solid #ffedd5" }}>
                            <div style={{ display: "flex", gap: "10px" }}>
                              <ShieldAlert size={20} style={{ color: "#ea580c" }} />
                              <div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "#9a3412" }}>No ABHA Identity Linked</div>
                                <div style={{ fontSize: "12px", color: "#ea580c" }}>This patient profile does not have an active ABDM Health ID associated. Link or generate one below.</div>
                              </div>
                            </div>

                            {abhaStep === 'IDLE' && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #fed7aa" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#eff6ff", padding: "10px 14px", borderRadius: "10px", border: "1px solid #dbeafe" }}>
                                  <input 
                                    type="checkbox" 
                                    id="abha-dossier-consent"
                                    checked={hasConsent}
                                    onChange={(e) => setHasConsent(e.target.checked)}
                                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                  />
                                  <label htmlFor="abha-dossier-consent" style={{ fontSize: "11px", color: "#1e40af", fontWeight: 600, cursor: "pointer" }}>
                                    I consent to use my ABHA for healthcare services (Mandatory)
                                  </label>
                                </div>

                                <div style={{ display: "flex", gap: "8px" }}>
                                  <input 
                                    placeholder="Enter 12 Digit Aadhaar" 
                                    className="input-field" 
                                    style={{ height: "42px", fontSize: "13px" }}
                                    value={aadhaarInput}
                                    onChange={e => setAadhaarInput(e.target.value)}
                                    maxLength={12}
                                  />
                                  <button 
                                    onClick={handleAbhaOtpRequest}
                                    disabled={isAbhaLoading || !hasConsent}
                                    style={{ padding: "0 16px", height: "42px", background: "#0369a1", color: "white", borderRadius: "8px", border: "none", fontWeight: 700, cursor: "pointer", opacity: (!hasConsent || isAbhaLoading) ? 0.6 : 1 }}
                                  >
                                    {isAbhaLoading ? "..." : "GET OTP"}
                                  </button>
                                </div>

                                <div style={{ textAlign: "center", fontSize: "10px", color: "#cbd5e1", fontWeight: 700 }}>— OR —</div>

                                <button 
                                  onClick={handleAbhaDiscovery}
                                  disabled={isAbhaLoading || !hasConsent}
                                  style={{ padding: "10px", background: "white", color: "#0369a1", borderRadius: "8px", border: "2px dashed #0369a1", fontWeight: 800, cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                >
                                  <Search size={14} /> DISCOVER EXISTING ABHA BY PHONE
                                </button>

                                {discoveredAbhas.length > 0 && (
                                  <div style={{ background: "#f0f9ff", padding: "12px", borderRadius: "10px", border: "1px solid #bae6fd", marginTop: "8px" }}>
                                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#0369a1", marginBottom: "8px" }}>FOUND IDENTITIES:</div>
                                    {discoveredAbhas.map((a, idx) => (
                                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", background: "white", borderRadius: "8px", marginBottom: "6px", border: "1px solid #e0f2fe" }}>
                                         <div>
                                            <div style={{ fontWeight: 800, fontSize: "12px" }}>{a.name}</div>
                                            <div style={{ fontSize: "10px", color: "#64748b" }}>{a.healthId} • {a.healthIdNumber}</div>
                                         </div>
                                         <button onClick={() => linkDiscoveredAbha(a)} style={{ background: "#0369a1", color: "white", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, cursor: "pointer" }}>LINK</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {abhaStep === 'OTP_SENT' && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #fed7aa" }}>
                                <div style={{ fontSize: "11px", color: "#0369a1", background: "#e0f2fe", padding: "10px", borderRadius: "8px", fontWeight: 600 }}>
                                  {abhaMessage || "OTP sent to mobile linked with Aadhaar."}
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 800 }}>Aadhaar-Registered Mobile Number*</label>
                                  <input 
                                    placeholder="Enter 10-Digit Mobile" 
                                    className="input-field" 
                                    style={{ height: "38px", fontSize: "13px" }}
                                    value={abhaMobile}
                                    onChange={e => setAbhaMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    maxLength={10}
                                  />
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 800 }}>Enter 6-Digit OTP*</label>
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <input 
                                      placeholder="Enter 6-Digit OTP" 
                                      className="input-field" 
                                      style={{ height: "38px", fontSize: "13px", letterSpacing: "2px" }}
                                      value={otpInput}
                                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                      maxLength={6}
                                    />
                                    <button 
                                      onClick={handleAbhaVerify}
                                      disabled={isAbhaLoading || otpInput.length !== 6 || abhaMobile.length !== 10}
                                      style={{ background: "#059669", color: "white", borderRadius: "8px", border: "none", padding: "0 16px", fontWeight: 700, cursor: "pointer" }}
                                    >
                                      {isAbhaLoading ? "..." : "VERIFY"}
                                    </button>
                                  </div>
                                </div>

                                <button
                                  onClick={() => { setAbhaStep('IDLE'); setOtpInput(''); }}
                                  style={{ background: "none", border: "none", color: "#0369a1", fontSize: "11px", cursor: "pointer", textAlign: "left", padding: 0, fontWeight: 600 }}
                                >
                                  ← Back / Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* HIP Section (Milestone 2) */}
                      <div>
                        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Activity size={14} style={{ color: "#0369a1" }} /> Health Information Provider (HIP - Milestone 2)
                        </h4>

                        {!(abdmStatus?.patient?.abha_id || selectedPatient?.abha_id) ? (
                          <div style={{ padding: "16px", background: "var(--app-bg)", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                            Link ABHA Identity above to enable clinical treatment record sharing.
                          </div>
                        ) : !abdmStatus?.encounters || abdmStatus.encounters.length === 0 ? (
                          <div style={{ padding: "16px", background: "var(--app-bg)", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                            No treatment encounter records found for this patient yet.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {abdmStatus.encounters.map((enc: any, idx: number) => (
                              <div key={enc.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--app-bg)", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>
                                    Visit on {formatDate(enc.created_at)}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                                    Diagnosis: {enc.diagnosis || "None specified"} • Doctor: {enc.doctor_name || "Practitioner"}
                                  </div>
                                </div>
                                
                                {enc.abha_linked ? (
                                  <span style={{ fontSize: "11px", background: "#d1fae5", color: "#065f46", padding: "4px 8px", borderRadius: "6px", fontWeight: 800 }}>
                                    Shared ✓ (Context: {enc.abha_care_context})
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handlePushEncounter(enc.id)}
                                    disabled={syncingEncounterId === enc.id}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#3b82f6",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    <Zap size={11} fill="currentColor" /> {syncingEncounterId === enc.id ? 'Pushing...' : 'Push to ABDM'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* HIU Section (Milestone 3) */}
                      <div>
                        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <FileText size={14} style={{ color: "#0369a1" }} /> Health Information User (HIU - Milestone 3)
                        </h4>

                        {!(abdmStatus?.patient?.abha_id || selectedPatient?.abha_id) ? (
                          <div style={{ padding: "16px", background: "var(--app-bg)", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                            Link ABHA Identity above to request consent and retrieve external medical records.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {consentStatus === 'NONE' && (
                              <button
                                onClick={handleRequestConsent}
                                style={{
                                  width: "100%",
                                  padding: "12px",
                                  background: "#0f172a",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "10px",
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "8px"
                                }}
                              >
                                <Shield size={14} /> Request Patient Consent via PHR App
                              </button>
                            )}

                            {consentStatus === 'INITIATING' && (
                              <div style={{ padding: "16px", background: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: "10px" }}>
                                <RefreshCw size={16} style={{ animation: "spin 1.5s linear infinite", color: "#2563eb" }} />
                                <div style={{ fontSize: "12px", color: "#1e40af", fontWeight: 600 }}>
                                  Initiating request... Awaiting approval on patient's ABHA App (Aarogya Setu / PHR)...
                                </div>
                              </div>
                            )}

                            {consentStatus === 'GRANTED' && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ padding: "12px 16px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #86efac", fontSize: "12px", color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                  <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                                  Consent GRANTED (ID: {consentId}). Decrypting health logs from Central ABDM Repository.
                                </div>

                                {externalRecords.length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>External Health Records Timeline</div>
                                    
                                    <div style={{ borderLeft: "2px solid #cbd5e1", paddingLeft: "16px", marginLeft: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                      {externalRecords.map((rec, rIdx) => (
                                        <div key={rec.id || rIdx} style={{ position: "relative", background: "white", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                          <div style={{ position: "absolute", left: "-25px", top: "18px", width: "16px", height: "16px", borderRadius: "50%", background: "#3b82f6", border: "4px solid white" }}></div>
                                          
                                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                            <span style={{ fontSize: "11px", fontWeight: 800, color: "#3b82f6", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px" }}>
                                              {rec.recordType}
                                            </span>
                                            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                                              {new Date(rec.date).toLocaleDateString()}
                                            </span>
                                          </div>
                                          
                                          <div style={{ fontSize: "13px", fontWeight: 900, color: "#0f172a" }}>{rec.facilityName}</div>
                                          <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginBottom: "8px" }}>Author: {rec.doctor}</div>
                                          
                                          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#334155", lineHeight: 1.4 }}>
                                            <strong>Diagnosis/Findings:</strong> {rec.diagnosis || rec.notes}
                                          </p>

                                          {rec.vitals && (
                                            <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#64748b", background: "var(--app-bg)", padding: "4px 8px", borderRadius: "4px", marginBottom: "6px" }}>
                                              {rec.vitals.bp && <span>BP: {rec.vitals.bp}</span>}
                                              {rec.vitals.weight && <span>Weight: {rec.vitals.weight}</span>}
                                              {rec.vitals.heartRate && <span>Pulse: {rec.vitals.heartRate}</span>}
                                            </div>
                                          )}

                                          {rec.results && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "var(--app-bg)", padding: "8px", borderRadius: "6px" }}>
                                              {rec.results.map((res: any, aIdx: number) => (
                                                <div key={aIdx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                                                  <span style={{ color: "#475569" }}>{res.parameter}</span>
                                                  <span style={{ fontWeight: 700, color: res.status.includes('High') ? '#ef4444' : '#1e293b' }}>
                                                    {res.value} {res.unit} ({res.status})
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {rec.prescriptions && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", borderTop: "1px solid #f1f5f9", paddingTop: "6px" }}>
                                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b" }}>PRESCRIBED MEDICINES:</span>
                                              {rec.prescriptions.map((m: any, mIdx: number) => (
                                                <div key={mIdx} style={{ fontSize: "11px", color: "#334155", fontWeight: 600 }}>
                                                  • {m.drugName} ({m.dosage} — {m.frequency} for {m.duration})
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "32px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  style={{ padding: "10px 20px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                >
                  Close Dossier
                </button>
                <button 
                  onClick={() => {
                    const pid = selectedPatient.id;
                    setSelectedPatient(null);
                    navigate(`/tenant/appointments/book?patientId=${pid}`);
                  }}
                  style={{ padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Calendar size={14} /> Schedule Appointment
                </button>
              </div>

            </div>
          </div>
        )}
      </main>
      
      <style>{`
        .hover-light:hover {
          background-color: #f8fafc;
        }
        @keyframes modalIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
