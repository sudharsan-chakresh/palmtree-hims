import { useState } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function AILabAssistant() {
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [labFile, setLabFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const searchPatient = async () => {
    if (!searchTerm) return;
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/patients?search=${searchTerm}`, { headers });
      setPatients(res.data);
    } catch (err) { console.error(err); }
  };

  const handleExternalScan = async () => {
    if (!selectedPatientId || !labFile) return alert("Select patient and file");
    setIsScanning(true);
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const formData = new FormData();
      formData.append("patientId", selectedPatientId);
      formData.append("lab_report", labFile);
      const res = await axios.post(`${API_BASE}/api/hospital/lab/upload-external`, formData, { headers });
      alert(`AI Extraction Complete!\n\n${res.data.noteText}`);
      setLabFile(null); setSelectedPatientId(""); setSearchTerm(""); setPatients([]);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to parse external lab report");
    } finally { setIsScanning(false); }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="AI Diagnostic Assistant" />

        <div className="manage-card" style={{ maxWidth: '800px', margin: '40px auto', background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)', padding: '48px', borderRadius: '40px', border: '1px solid #f5d0fe', boxShadow: '0 20px 40px -10px rgba(217, 70, 239, 0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
               <div style={{ fontSize: '64px', marginBottom: '16px' }}>🧬</div>
               <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#86198f', margin: 0 }}>AI Smart Import</h2>
               <p style={{ color: '#a21caf', fontSize: '15px', marginTop: '8px' }}>Automatically extract clinical values from external lab reports using AI</p>
            </div>
            
            <div style={{ display: 'grid', gap: '32px' }}>
               <section>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#a21caf', marginBottom: '12px', textTransform: 'uppercase' }}>1. Locate Patient Record</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && searchPatient()}
                      placeholder="Search by MRN or Name..." 
                      style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #f5d0fe', fontSize: '16px', background: 'white' }} 
                    />
                    <button onClick={searchPatient} style={{ background: '#d946ef', color: 'white', border: 'none', padding: '0 32px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer' }}>Search</button>
                  </div>
                  {patients.length > 0 && (
                    <div style={{ marginTop: '16px', background: 'white', borderRadius: '24px', padding: '12px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #f5d0fe' }}>
                      {patients.map(p => (
                        <div key={p.id} onClick={() => setSelectedPatientId(p.id)} style={{ padding: '16px', borderRadius: '16px', background: selectedPatientId === p.id ? '#fdf4ff' : 'white', cursor: 'pointer', border: `2px solid ${selectedPatientId === p.id ? '#d946ef' : 'transparent'}`, marginBottom: '8px' }}>
                          <div style={{ fontWeight: 800, fontSize: '16px' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>MRN: {p.mrn} • {p.gender} • {p.age} Yrs</div>
                        </div>
                      ))}
                    </div>
                  )}
               </section>

               <section>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#a21caf', marginBottom: '12px', textTransform: 'uppercase' }}>2. Upload Digital Report</label>
                  <div style={{ background: 'white', border: '2px dashed #f5d0fe', borderRadius: '24px', padding: '32px', textAlign: 'center' }}>
                     <input 
                       type="file" 
                       accept=".pdf,image/*" 
                       disabled={!selectedPatientId} 
                       onChange={e => setLabFile(e.target.files?.[0] || null)} 
                       style={{ display: 'none' }} 
                       id="lab-upload"
                     />
                     <label htmlFor="lab-upload" style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
                        <div style={{ fontWeight: 700, color: '#86198f' }}>{labFile ? labFile.name : 'Click to select or drag PDF/Image report'}</div>
                        <div style={{ fontSize: '12px', color: '#a21caf', marginTop: '4px' }}>Max size 10MB</div>
                     </label>
                  </div>
               </section>

               <button 
                  onClick={handleExternalScan} 
                  disabled={!labFile || isScanning} 
                  style={{ width: '100%', padding: '24px', background: '#86198f', color: 'white', border: 'none', borderRadius: '24px', fontWeight: 900, fontSize: '18px', cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(134, 25, 143, 0.4)', opacity: (!labFile || isScanning) ? 0.5 : 1 }}
                >
                  {isScanning ? '✨ AI ENGINE EXTRACTING DATA...' : 'AUTHORIZE AI ANALYSIS'}
               </button>
            </div>
        </div>
      </main>
    </div>
  );
}
