import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { useToast } from "../../../components/ToastProvider";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { 
  Search, UserPlus, Shield, CheckCircle2, Trash2, User,
  Activity, Scale, HeartPulse, MapPin, Users, Zap
} from 'lucide-react';

export default function OPDRegistrationPage() {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showFullReg, setShowFullReg] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState("");
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Initialize with empty array so test waits for real seeded doctors
  const [doctors, setDoctors] = useState<any[]>([]);
  const [recentQueue, setRecentQueue] = useState<any[]>([]);

  // Comprehensive Form State
  const [regData, setRegData] = useState({ 
    name: '', phone: '', email: '', dob: '', age: '', gender: 'Male', 
    blood_group: '', occupation: '', address: '', 
    guardian_name: '', guardian_phone: '',
    medical_history: '', allergies: '',
    abhaId: '', abhaNumber: '', abhaStatus: 'NOT_LINKED', abhaVerified: false
  });
  
  const computeAgeFromDob = (dobStr: string) => {
    if (!dobStr) return '';
    try {
      const dob = new Date(dobStr);
      if (isNaN(dob.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return String(age >= 0 ? age : '');
    } catch {
      return '';
    }
  };
  const [vitals, setVitals] = useState({ weight: '', bp: '', temp: '', height: '', heartRate: '' });
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [isAbhaMandatory, setIsAbhaMandatory] = useState(false);
  const [abhaStep, setAbhaStep] = useState<'IDLE' | 'OTP_SENT' | 'VERIFIED'>('IDLE');
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [abhaTxnId, setAbhaTxnId] = useState("");
  const [isAbhaLoading, setIsAbhaLoading] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [discoveredAbhas, setDiscoveredAbhas] = useState<any[]>([]);
  const [abhaMobile, setAbhaMobile] = useState("");
  const [abhaMessage, setAbhaMessage] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const getHeaders = () => ({ 
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  });

  const fetchInitialData = async () => {
    const h = getHeaders();
    // Fetch doctors independently
    try {
      const docRes = await axios.get(`${API_BASE}/api/hospital/doctors`, { headers: h });
      if (docRes.data && docRes.data.length > 0) {
        setDoctors(docRes.data);
      }
    } catch (err) { console.error("Doctor fetch failed", err); }

    // Fetch queue independently
    try {
      const queueRes = await axios.get(`${API_BASE}/api/hospital/encounters`, { headers: h });
      const list = Array.isArray(queueRes.data) ? queueRes.data : (Array.isArray(queueRes.data?.data) ? queueRes.data.data : []);
      setRecentQueue(list.slice(0, 5));
    } catch (err) { console.error("Queue fetch failed", err); }

    // Fetch ABHA Config
    try {
      const configRes = await axios.get(`${API_BASE}/api/abha/config`, { headers: h });
      setIsAbhaMandatory(configRes.data.isAbhaMandatory);
    } catch (err) { console.warn("ABHA config fetch failed"); }
  };

  const handleLiveSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/patients?search=${val}`, { headers: getHeaders() });
      setSearchResults(res.data);
      
      // AUTO-FILL LOGIC
      if (res.data.length === 0) {
        setShowFullReg(true);
        const isPhone = /^\d+$/.test(val);
        if (isPhone) {
          setRegData(prev => ({ ...prev, phone: val, name: prev.name }));
        } else {
          setRegData(prev => ({ ...prev, name: val, phone: prev.phone }));
        }
      } else {
        setShowFullReg(false);
      }
    } catch (err) { console.error(err); }
  };

  const selectPatient = async (p: any) => {
    setSelectedPatient(p);
    setSearchResults([]);
    setSearchTerm(p.name);
    setRegData({
      name: p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      dob: p.dob ? p.dob.split('T')[0] : '',
      age: p.age || (p.dob ? computeAgeFromDob(p.dob.split('T')[0]) : ''),
      gender: p.gender || 'Male',
      blood_group: p.blood_group || '',
      occupation: p.occupation || '',
      address: p.address || '',
      guardian_name: p.guardian_name || '',
      guardian_phone: p.guardian_phone || '',
      medical_history: p.medical_history || '',
      allergies: p.allergies || '',
      abhaId: p.abha_id || p.abhaId || '',
      abhaNumber: p.abha_number || p.abhaNumber || '',
      abhaStatus: (p.abha_id || p.abhaId) ? 'LINKED' : 'NOT_LINKED',
      abhaVerified: !!(p.abha_id || p.abhaId)
    });
    // Auto-skip ABHA flow if patient already has ABHA linked
    if (p.abha_id || p.abhaId) {
      setAbhaStep('VERIFIED');
      showToast(`ABHA already linked: ${p.abha_id || p.abhaId}`, 'success');
    } else {
      setAbhaStep('IDLE');
    }
    setShowFullReg(true);

    // Fetch previous vitals
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/encounters?patientId=${p.id}&status=All`, { headers: getHeaders() });
      const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      if (list.length > 0) {
        const sorted = [...list].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestEncWithVitals = sorted.find((enc: any) => enc.vitals && (enc.vitals.weight || enc.vitals.bp || enc.vitals.temp || enc.vitals.height || enc.vitals.heartRate));
        if (latestEncWithVitals && latestEncWithVitals.vitals) {
          setVitals({
            weight: latestEncWithVitals.vitals.weight || '',
            bp: latestEncWithVitals.vitals.bp || '',
            temp: latestEncWithVitals.vitals.temp || '',
            height: latestEncWithVitals.vitals.height || '',
            heartRate: latestEncWithVitals.vitals.heartRate || latestEncWithVitals.vitals.pulse || ''
          });
          showToast("Pre-populated vitals from patient's previous visit.", "info");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch previous vitals history", err);
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
      setAbhaMobile(regData.phone || "");
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
    if (!regData.phone || regData.phone.length < 10) {
      showToast("Please enter a valid mobile number first", "error");
      return;
    }
    if (!hasConsent) {
      showToast("ABDM Consent is required for discovery", "error");
      return;
    }
    setIsAbhaLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/abha/search-mobile`, { mobile: regData.phone }, { headers: getHeaders() });
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

  const linkDiscoveredAbha = (abha: any) => {
    setRegData(prev => ({ 
      ...prev, 
      name: abha.name || prev.name,
      abhaId: abha.healthId,
      abhaNumber: abha.healthIdNumber,
      abhaStatus: 'LINKED',
      abhaVerified: true
    }));
    setAbhaStep('VERIFIED');
    setDiscoveredAbhas([]);
  };

  const handleAbhaVerify = async () => {
    if (otpInput.length !== 6) {
      showToast("Please enter 6-digit OTP", "error");
      return;
    }
    setIsAbhaLoading(true);
    try {
      const payload: any = { otp: otpInput, txnId: abhaTxnId };
      if (abhaMobile && abhaMobile.length === 10) {
        payload.mobile = abhaMobile;
      }
      const res = await axios.post(`${API_BASE}/api/abha/verify-otp`, payload, { headers: getHeaders() });
      const profile = res.data;

      // Safely build DOB — pad month/day to 2 digits
      let dob = '';
      if (profile.yearOfBirth && profile.monthOfBirth && profile.dayOfBirth) {
        const mm = String(profile.monthOfBirth).padStart(2, '0');
        const dd = String(profile.dayOfBirth).padStart(2, '0');
        dob = `${profile.yearOfBirth}-${mm}-${dd}`;
      }

      setRegData(prev => ({
        ...prev,
        name: profile.name || prev.name,
        gender: profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : (prev.gender || 'Other'),
        dob: dob || prev.dob,
        address: profile.address || prev.address,
        abhaId: profile.healthId || '',
        abhaNumber: profile.healthIdNumber || '',
        abhaStatus: profile.status || 'ACTIVE',
        abhaVerified: true
      }));
      setAbhaStep('VERIFIED');
      showToast("ABHA Verified & Form Auto-populated!", "success");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || "ABHA Verification failed";
      showToast(msg, "error");
    } finally {
      setIsAbhaLoading(false);
    }
  };


  const registerAndQueue = async () => {
    if (!regData.name || !regData.phone || !selectedDoctorId) {
      showToast("Basic info (Name, Phone) and Doctor selection are mandatory.", "error");
      return;
    }
    if (isAbhaMandatory && abhaStep !== 'VERIFIED') {
      showToast("ABHA Verification is mandatory for this facility.", "error");
      return;
    }
    setIsProcessing(true);
    try {
      // Ensure age is present (derive from DOB if missing)
      const payload: any = { ...regData };
      if ((!payload.age || payload.age === '') && payload.dob) payload.age = computeAgeFromDob(payload.dob);

      const pRes = await axios.post(`${API_BASE}/api/patients`, payload, { headers: getHeaders() });
      const patientId = pRes.data?.id || pRes.data?.[0]?.id;
      if (!patientId) {
        throw new Error("Patient registration returned an unexpected response.");
      }

      await axios.post(`${API_BASE}/api/hospital/encounters`, {
        patientId,
        doctorId: selectedDoctorId,
        type: 'OPD',
        vitals,
        complaints: regData.medical_history || 'Routine Checkup'
      }, { headers: getHeaders() });

      resetFlow("Registration Successful! Patient is now in queue.");
    } catch (err: any) { 
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Registration failed.";
      showToast(msg, "error"); 
    }
    finally { setIsProcessing(false); }
  };

  const queueExistingPatient = async () => {
    if (!selectedDoctorId) {
      showToast("Doctor selection is mandatory.", "error");
      return;
    }
    if (!selectedPatient) return;
    setIsProcessing(true);
    try {
      await axios.post(`${API_BASE}/api/hospital/encounters`, {
        patientId: selectedPatient.id,
        doctorId: selectedDoctorId,
        type: 'OPD',
        vitals,
        complaints: 'Follow-up Consultation'
      }, { headers: getHeaders() });
      resetFlow("Visit generated. Token issued.");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to issue token.";
      showToast(msg, "error");
    }
    finally { setIsProcessing(false); }
  };

  const resetFlow = (msg: string) => {
    showToast(msg, "success");
    setSelectedPatient(null);
    setSearchTerm("");
    setRegData({ 
      name: '', phone: '', email: '', dob: '', age: '', gender: 'Male', 
        blood_group: '', occupation: '', address: '', 
        guardian_name: '', guardian_phone: '', medical_history: '', allergies: '',
        abhaId: '', abhaNumber: '', abhaStatus: 'NOT_LINKED', abhaVerified: false
    });
    setVitals({ weight: '', bp: '', temp: '', height: '', heartRate: '' });
    setSelectedDoctorId("");
    setAbhaStep('IDLE');
    setAadhaarInput("");
    setOtpInput("");
    setShowFullReg(false);
    fetchInitialData();
  };

  return (
    <div className="dashboard-layout" style={{ backgroundColor: '#f1f5f9', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      <Sidebar />
      <main className="main-content" style={{ padding: isMobile ? '16px' : '32px', flex: 1, width: '100%' }}>
        <Header title="OPD Professional Intake Desk" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#e0e7ff', display: 'grid', placeItems: 'center', color: '#4338ca', boxShadow: '0 10px 15px -3px rgba(67, 56, 202, 0.1)' }}>
            <UserPlus size={24} />
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>High-Velocity Registration</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Streamlined clinical intake and token management for efficient outpatient operations.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1.6fr', gap: isMobile ? '16px' : '28px' }}>
          
          {/* LEFT: UNIFIED INTAKE CONSOLE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div className="page-card" style={{ padding: '28px', borderRadius: '28px' }}>
              <h3 style={{ margin: '0 0 24px', fontSize: '13px', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} /> 1. IDENTIFY OR REGISTER PATIENT
              </h3>
              
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <input 
                  placeholder="Type Phone, Name or MRN to begin..." 
                  className="input-field high-velocity-input" 
                  style={{ paddingLeft: '52px', fontSize: '16px', height: '60px', borderRadius: '18px', border: '2px solid #e2e8f0' }}
                  value={searchTerm}
                  onChange={e => handleLiveSearch(e.target.value)}
                />
                <Search style={{ position: 'absolute', left: '18px', top: '20px', color: '#3b82f6' }} size={22} />
              </div>

              {/* SEARCH RESULTS — shown immediately below search bar, before ABHA */}
              {searchResults.length > 0 && (
                <div style={{ background: 'white', border: '2px solid #3b82f6', borderRadius: '18px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 12px 20px -5px rgba(59,130,246,0.15)' }}>
                  <div style={{ padding: '10px 20px', background: '#eff6ff', fontSize: '11px', fontWeight: 800, color: '#1d4ed8' }}>
                    {searchResults.length} PATIENT{searchResults.length > 1 ? 'S' : ''} FOUND
                  </div>
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      style={{ 
                        width: '100%',
                        padding: '14px 20px', 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        textAlign: 'left'
                      }}
                      className="hover-light"
                    >
                       <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>{p.name}</span>
                            {(p.abha_id || p.abhaId) && (
                              <span style={{ fontSize: '9px', background: '#0369a1', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>ABHA ✓</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{p.mrn} • {p.phone} • {p.blood_group || 'N/A'}</div>
                       </div>
                       <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>SELECT</div>
                    </button>
                  ))}
                </div>
              )}

              {/* ABHA INTEGRATION SECTION — only shown when no patient selected or for new patients */}
              {!selectedPatient && (
              <div style={{ background: '#f0f9ff', padding: '24px', borderRadius: '24px', border: '1px solid #bae6fd', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Shield size={20} style={{ color: '#0369a1' }} />
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0c4a6e' }}>ABHA IDENTITY (ABDM)</div>
                  {isAbhaMandatory && <span style={{ fontSize: '10px', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>MANDATORY</span>}
                </div>

                {abhaStep === 'IDLE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#eff6ff', padding: '10px 14px', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                      <input 
                        type="checkbox" 
                        id="abha-consent"
                        checked={hasConsent}
                        onChange={(e) => setHasConsent(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="abha-consent" style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600, cursor: 'pointer' }}>
                        I consent to use my ABHA for healthcare services (Mandatory)
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input 
                        placeholder="Enter 12 Digit Aadhaar" 
                        className="input-field" 
                        style={{ background: 'white' }}
                        value={aadhaarInput}
                        onChange={e => setAadhaarInput(e.target.value)}
                        maxLength={12}
                      />
                      <button 
                        onClick={handleAbhaOtpRequest}
                        disabled={isAbhaLoading || !hasConsent}
                        style={{ whiteSpace: 'nowrap', padding: '0 24px', background: '#0369a1', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: (!hasConsent || isAbhaLoading) ? 0.6 : 1 }}
                      >
                        {isAbhaLoading ? '...' : 'GET OTP'}
                      </button>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>— OR —</div>

                    <button 
                      onClick={handleAbhaDiscovery}
                      disabled={isAbhaLoading || !hasConsent}
                      style={{ width: '100%', padding: '12px', background: 'white', color: '#0369a1', borderRadius: '12px', border: '2px dashed #0369a1', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Search size={16} /> CHECK FOR EXISTING ABHA BY MOBILE
                    </button>

                    {discoveredAbhas.length > 0 && (
                      <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1', marginBottom: '12px' }}>DISCOVERED IDENTITIES:</div>
                        {discoveredAbhas.map((a, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'white', borderRadius: '10px', marginBottom: '8px', border: '1px solid #e0f2fe' }}>
                             <div>
                                <div style={{ fontWeight: 800, fontSize: '13px' }}>{a.name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{a.healthId} • {a.healthIdNumber}</div>
                             </div>
                             <button onClick={() => linkDiscoveredAbha(a)} style={{ background: '#0369a1', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>LINK</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {abhaStep === 'OTP_SENT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#0369a1', background: '#e0f2fe', padding: '12px', borderRadius: '12px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        {abhaMessage || `OTP sent to mobile linked with Aadhaar ${aadhaarInput ? `●●●● ${aadhaarInput.slice(-4)}` : ''}. Enter details below.`}
                      </div>
                      <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', borderTop: '1px solid #bae6fd', paddingTop: '6px', fontWeight: 500, lineHeight: 1.4 }}>
                        <strong>⚠️ Aadhaar Mobile Match Required:</strong> ABDM sandbox requires the patient's phone number on the form to match their Aadhaar-registered mobile exactly.
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800 }}>1. Aadhaar-Registered Mobile Number*</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Enter 10-Digit Mobile" 
                        className="input-field" 
                        style={{ background: 'white', fontWeight: 600, fontSize: '15px' }}
                        value={abhaMobile}
                        onChange={e => setAbhaMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800 }}>2. Enter 6-Digit OTP*</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input 
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Enter 6-Digit OTP" 
                          className="input-field" 
                          style={{ background: 'white', letterSpacing: '4px', fontSize: '20px', fontWeight: 700 }}
                          value={otpInput}
                          onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          autoComplete="one-time-code"
                        />
                        <button 
                          onClick={handleAbhaVerify}
                          disabled={isAbhaLoading || otpInput.length !== 6 || abhaMobile.length !== 10}
                          style={{ whiteSpace: 'nowrap', padding: '0 24px', background: '#059669', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: isAbhaLoading || otpInput.length !== 6 || abhaMobile.length !== 10 ? 'not-allowed' : 'pointer', opacity: isAbhaLoading || otpInput.length !== 6 || abhaMobile.length !== 10 ? 0.6 : 1 }}
                        >
                          {isAbhaLoading ? '...' : 'VERIFY'}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => { setAbhaStep('IDLE'); setOtpInput(''); setAbhaTxnId(''); setAbhaMessage(''); }}
                      style={{ background: 'none', border: 'none', color: '#0369a1', fontSize: '12px', cursor: 'pointer', textAlign: 'left', padding: 0, fontWeight: 600, marginTop: '8px' }}
                    >
                      ← Resend OTP / Change Aadhaar
                    </button>
                  </div>
                )}

                {abhaStep === 'VERIFIED' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', fontWeight: 700 }}>
                    <CheckCircle2 size={20} />
                    <div>
                       <div style={{ fontSize: '13px' }}>ABHA Verified: {regData.abhaId}</div>
                       <div style={{ fontSize: '11px', opacity: 0.8 }}>{regData.abhaNumber} • {regData.abhaStatus}</div>
                    </div>
                    <button onClick={() => { setAbhaStep('IDLE'); setDiscoveredAbhas([]); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#0369a1', fontSize: '12px', cursor: 'pointer' }}>Change</button>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '12px', opacity: 0.8 }}>Verify patient identity instantly via India's National Health Stack.</div>
              </div>
              )}

              {/* ABHA STATUS BANNER for existing patient with ABHA */}
              {selectedPatient && abhaStep === 'VERIFIED' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f0fdf4', padding: '16px 20px', borderRadius: '16px', border: '1px solid #86efac', marginBottom: '20px' }}>
                  <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#15803d' }}>ABHA Already Linked</div>
                    <div style={{ fontSize: '11px', color: '#16a34a' }}>{regData.abhaId} — no re-verification needed</div>
                  </div>
                </div>
              )}

              {/* FULL REGISTRATION FORM (The "Clean" Expanded View) */}
              {(showFullReg || (searchTerm && searchResults.length === 0)) && (
                <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserPlus size={16} /> NEW PATIENT PROFILE
                      </div>
                      <button onClick={() => setShowFullReg(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={16} /></button>
                   </div>

                   {/* Personal Section */}
                   <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                       <div className="input-group">
                          <label className="field-label" htmlFor="reg-full-name">Full Name*</label>
                          <input id="reg-full-name" className="input-field" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                       </div>
                      <div className="input-group">
                         <label className="field-label">Phone Number*</label>
                         <input className="input-field" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
                      </div>
                      <div className="input-group">
                         <label className="field-label">Date of Birth</label>
                         <input type="date" className="input-field" value={regData.dob} onChange={e => {
                           const val = e.target.value;
                           setRegData({...regData, dob: val, age: computeAgeFromDob(val)});
                         }} />
                      </div>
                      <div className="input-group">
                         <label className="field-label">Gender</label>
                         <select className="select-field" value={regData.gender} onChange={e => setRegData({...regData, gender: e.target.value})}>
                            <option>Male</option><option>Female</option><option>Other</option>
                         </select>
                      </div>
                      <div className="input-group">
                         <label className="field-label">ABHA ID / PHR</label>
                         <input className="input-field" value={regData.abhaId} readOnly style={{ background: '#f1f5f9' }} />
                      </div>
                   </div>

                   {/* Additional Details */}
                   <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                      <div><label className="field-label">Blood Group</label><select className="select-field" value={regData.blood_group} onChange={e => setRegData({...regData, blood_group: e.target.value})}><option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select></div>
                      <div><label className="field-label">Occupation</label><input className="input-field" value={regData.occupation} onChange={e => setRegData({...regData, occupation: e.target.value})} /></div>
                   </div>

                   <div className="input-group" style={{ marginBottom: '24px' }}>
                      <label className="field-label">Guardian / Emergency Contact Name</label>
                      <input className="input-field" value={regData.guardian_name} onChange={e => setRegData({...regData, guardian_name: e.target.value})} />
                   </div>

                   <div className="input-group">
                      <label className="field-label">Permanent Address</label>
                      <textarea className="input-field" style={{ height: '80px', resize: 'none' }} value={regData.address} onChange={e => setRegData({...regData, address: e.target.value})} />
                   </div>
                </div>
              )}

              {/* SELECTED PATIENT BANNER */}
              {selectedPatient && (
                <div style={{ background: '#0f172a', color: 'white', padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={28} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: '18px' }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7, fontWeight: 600 }}>{selectedPatient.mrn} • {selectedPatient.phone} • {selectedPatient.gender}</div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>CHANGE</button>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: CLINICAL & ASSIGNMENT (The "Professional" Checkout) */}
          <div className="page-card glass-card" style={{ padding: '32px', borderRadius: '32px', display: 'flex', flexDirection: 'column', border: '2px solid white', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 28px', fontSize: '13px', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} /> 2. CAPTURE VITALS & ASSIGN DOCTOR
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? '12px' : '20px', marginBottom: '32px' }}>
               <div className="input-group">
                  <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Scale size={12} /> Weight (kg)</label>
                  <input className="input-field high-velocity-input" placeholder="e.g. 70" value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} />
               </div>
               <div className="input-group">
                  <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={12} /> BP (Syst/Dia)</label>
                  <input className="input-field high-velocity-input" placeholder="e.g. 120/80" value={vitals.bp} onChange={e => setVitals({...vitals, bp: e.target.value})} />
               </div>
               <div className="input-group">
                  <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><HeartPulse size={12} /> Temp (°F)</label>
                  <input className="input-field high-velocity-input" placeholder="e.g. 98.6" value={vitals.temp} onChange={e => setVitals({...vitals, temp: e.target.value})} />
               </div>
               <div className="input-group">
                  <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={12} /> Height (cm)</label>
                  <input className="input-field high-velocity-input" placeholder="e.g. 175" value={vitals.height} onChange={e => setVitals({...vitals, height: e.target.value})} />
               </div>
               <div className="input-group">
                  <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><HeartPulse size={12} /> Pulse / HR (bpm)</label>
                  <input className="input-field high-velocity-input" placeholder="e.g. 72" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} />
               </div>
            </div>

             <div style={{ marginBottom: '40px' }}>
                <label className="field-label" style={{ marginBottom: '16px', display: 'block' }}>SELECT CONSULTING DOCTOR</label>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search doctor by name or specialty..."
                    className="input-field"
                    style={{ width: '100%', paddingLeft: '44px', borderRadius: '12px' }}
                    value={doctorSearchTerm}
                    onChange={(e) => setDoctorSearchTerm(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                  {doctors.length === 0 && (
                    <div style={{ padding: '20px', borderRadius: '15px', border: '2px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                      <Users size={24} style={{ marginBottom: '10px', opacity: 0.5 }} />
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>SEARCHING FOR CLINICIANS...</div>
                      <div style={{ fontSize: '11px' }}>If this persists, please check Hospital Masters.</div>
                    </div>
                  )}
                  {doctors
                    .filter(d => {
                      const search = doctorSearchTerm ? doctorSearchTerm.toLowerCase() : "";
                      if (!search) return true;
                      const nameMatch = d.name ? d.name.toLowerCase().includes(search) : false;
                      const specialization = d.specialization || d.specialty || d.department || '';
                      const specMatch = specialization ? specialization.toLowerCase().includes(search) : false;
                      const deptMatch = d.department ? d.department.toLowerCase().includes(search) : false;
                      return nameMatch || specMatch || deptMatch;
                    })
                    .map(d => (
                    <button 
                     key={d.id || Math.random()} 
                     type="button"
                     className={`doctor-card ${selectedDoctorId === d.id ? 'active' : ''}`}
                     onClick={() => setSelectedDoctorId(d.id)}
                     style={{ 
                       width: '100%',
                       padding: '20px', borderRadius: '20px', border: `2px solid ${selectedDoctorId === d.id ? '#3b82f6' : '#f1f5f9'}`, 
                       background: selectedDoctorId === d.id ? '#f0f9ff' : 'white', cursor: 'pointer', transition: '0.2s',
                       display: 'flex', alignItems: 'center', gap: '16px',
                       textAlign: 'left'
                     }}
                   >
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: selectedDoctorId === d.id ? '#3b82f6' : '#f8fafc', color: selectedDoctorId === d.id ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                         <Users size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontWeight: 800, fontSize: '15px', color: selectedDoctorId === d.id ? '#1e40af' : '#1e293b' }}>{d.name && d.name.startsWith('Dr.') ? d.name : `Dr. ${d.name}`}</div>
                         <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{d.specialization || d.specialty || d.department || 'General Physician'}</div>
                      </div>
                      {selectedDoctorId === d.id && <CheckCircle2 size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />}
                    </button>
                  ))}
                  {doctors.length > 0 && doctors.filter(d => {
                      const search = doctorSearchTerm ? doctorSearchTerm.toLowerCase() : "";
                      if (!search) return true;
                      const nameMatch = d.name ? d.name.toLowerCase().includes(search) : false;
                      const specMatch = d.specialization ? d.specialization.toLowerCase().includes(search) : false;
                      const deptMatch = d.department ? d.department.toLowerCase().includes(search) : false;
                      return nameMatch || specMatch || deptMatch;
                    }).length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No doctors match your search.
                      </div>
                  )}
                </div>
             </div>

            <div style={{ marginTop: 'auto' }}>
               {(() => {
                 return (
                   <button 
                    type="button"
                    disabled={isProcessing || !selectedDoctorId}
                    onClick={selectedPatient ? queueExistingPatient : registerAndQueue}
                    style={{ 
                      width: '100%', padding: '26px', borderRadius: '24px', border: 'none', 
                      background: !isProcessing ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#cbd5e1',
                      color: 'white', fontWeight: 900, fontSize: '18px', cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px',
                      boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)'
                    }}
                   >
                     {isProcessing ? 'PROCESSING...' : <><Zap size={22} fill="currentColor" /> FINALIZE & ISSUE TOKEN</>}
                   </button>
                 );
               })()}
               <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', fontWeight: 700 }}><Shield size={12} /> HIPAA COMPLIANT</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', fontWeight: 700 }}><CheckCircle2 size={12} /> REAL-TIME SYNC</div>
               </div>
            </div>
          </div>

          {/* RECENT QUEUE MINI-CARD */}
          <div className="page-card" style={{ gridColumn: isMobile ? 'auto' : '1 / 2', padding: isMobile ? '20px' : '28px', borderRadius: '28px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#64748b' }}>RECENTLY PROCESSED</h3>
                <button onClick={fetchInitialData} className="button-link" style={{ fontSize: '11px', fontWeight: 800 }}>REFRESH</button>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {recentQueue.map((q, i) => (
                 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '5px', background: '#10b981' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 800 }}>{q.patient_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Assigned to Dr. {q.doctor_name}</div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6' }}>TOKEN #{q.token || (i+1)}</div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
