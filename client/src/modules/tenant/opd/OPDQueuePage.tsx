import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Clock, ArrowRight, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function OPDQueuePage() {
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vitalsModalEncounter, setVitalsModalEncounter] = useState<any>(null);
  const [vitalsData, setVitalsData] = useState({ bp: "", heartRate: "", temp: "" });
  const [isSavingVitals, setIsSavingVitals] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchEncounters();
    const interval = setInterval(fetchEncounters, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchEncounters = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const res = await axios.get(`${API_BASE}/api/hospital/encounters?status=Active`, { headers });
      const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setEncounters(list);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  const calculateActualWaitTime = (createdAt: string) => {
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 60000);
    return diff > 60 ? `${Math.floor(diff/60)}h ${diff%60}m` : `${diff}m`;
  };

  const saveVitals = async () => {
    if (!vitalsModalEncounter) return;
    setIsSavingVitals(true);
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      const mergedVitals = {
        ...(vitalsModalEncounter.vitals || {}),
        ...vitalsData
      };
      await axios.put(`${API_BASE}/api/hospital/encounters/${vitalsModalEncounter.id}`, { vitals: mergedVitals }, { headers });
      setVitalsModalEncounter(null);
      setVitalsData({ bp: "", heartRate: "", temp: "" });
      fetchEncounters();
    } catch (err) {
      console.error(err);
      alert("Error saving vitals.");
    } finally {
      setIsSavingVitals(false);
    }
  };
  const getBPStatus = (bp: string) => {
    if (!bp) return { label: "BP PENDING", bg: "#fff7ed", color: "#c2410c" };
    const parts = bp.split('/');
    if (parts.length !== 2) return { label: "BP INVALID", bg: "#fee2e2", color: "#b91c1c" };
    const sys = parseInt(parts[0]);
    const dia = parseInt(parts[1]);
    if (isNaN(sys) || isNaN(dia)) return { label: "BP INVALID", bg: "#fee2e2", color: "#b91c1c" };

    if (sys >= 140 || dia >= 90) {
      return { label: "BP HIGH", bg: "#fee2e2", color: "#b91c1c" };
    }
    if (sys < 90 || dia < 60) {
      return { label: "BP LOW", bg: "#fee2e2", color: "#b91c1c" };
    }
    if (sys >= 130 || dia >= 80) {
      return { label: "BP ELEVATED", bg: "#ffedd5", color: "#b45309" };
    }
    return { label: "BP OK", bg: "#ecfdf5", color: "#10b981" };
  };

  const getTempStatus = (temp: string) => {
    if (!temp) return { label: "TEMP PENDING", bg: "#fff7ed", color: "#c2410c" };
    const val = parseFloat(temp);
    if (isNaN(val)) return { label: "TEMP INVALID", bg: "#fee2e2", color: "#b91c1c" };

    if (val >= 99.5) {
      return { label: "TEMP HIGH", bg: "#fee2e2", color: "#b91c1c" };
    }
    if (val < 95.0) {
      return { label: "TEMP LOW", bg: "#fee2e2", color: "#b91c1c" };
    }
    return { label: "TEMP OK", bg: "#ecfdf5", color: "#10b981" };
  };

  return (
    <div className="dashboard-layout" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      <Sidebar />
      <main className="main-content" style={{ padding: isMobile ? '16px' : '32px', flex: 1, width: '100%' }}>
        <Header title="Live OPD Patient Queue" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px', marginTop: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#ecfdf5', display: 'grid', placeItems: 'center', color: '#059669', boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.1)' }}>
            <Clock size={24} />
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Flow Surveillance</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Real-time monitoring of patient wait times, triage status, and consultation throughput across all OPD clinics.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '20px', marginBottom: '32px' }}>
           <div className="page-card" style={{ padding: isMobile ? '16px' : '20px', borderLeft: '4px solid #3b82f6' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', margin: 0 }}>TOTAL WAITING</p>
              <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 900, margin: '4px 0' }}>{encounters.length}</h2>
              {!isMobile && <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>LIVE CENSUS</div>}
           </div>
           <div className="page-card" style={{ padding: isMobile ? '16px' : '20px', borderLeft: '4px solid #10b981' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', margin: 0 }}>AVG WAIT TIME</p>
              <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 900, margin: '4px 0' }}>12m</h2>
              {!isMobile && <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>OPTIMIZED FLOW</div>}
           </div>
           <div className="page-card" style={{ padding: isMobile ? '16px' : '20px', borderLeft: '4px solid #f59e0b' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', margin: 0 }}>URGENT CASES</p>
              <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 900, margin: '4px 0' }}>0</h2>
              {!isMobile && <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>TRIAGE ACTIVE</div>}
           </div>
           <div className="page-card" style={{ padding: isMobile ? '16px' : '20px', borderLeft: '4px solid #8b5cf6' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', margin: 0 }}>ACTIVE DOCTORS</p>
              <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 900, margin: '4px 0' }}>{new Set(encounters.map(e => e.doctor_id)).size}</h2>
              {!isMobile && <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 700 }}>ON-DUTY STAFF</div>}
           </div>
        </div>

        <div className="manage-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ margin: 0, fontWeight: 900, fontSize: '18px' }}>Patient Queue List</h3>
             <span style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', background: '#dcfce7', padding: '6px 12px', borderRadius: '20px' }}>● AUTO-REFRESHING</span>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Initializing real-time queue...</div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
               {encounters.map((enc: any, i: number) => (
                 <div key={i} style={{ 
                   background: 'var(--app-bg)', 
                   borderRadius: '20px', 
                   padding: '20px', 
                   border: '1px solid #f1f5f9',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: '12px'
                 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                     <div>
                       <div style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', marginBottom: '4px' }}>TOKEN #{enc.token || (i + 1)}</div>
                       <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>{enc.patient_name}</div>
                       <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{enc.mrn} • {enc.gender}, {enc.age} yrs</div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                        <Clock size={12} /> {calculateActualWaitTime(enc.created_at)}
                     </div>
                   </div>

                   {enc.is_in_consultation ? (
                      <div style={{ background: '#dcfce7', color: '#059669', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, textAlign: 'center' }}>
                        IN CONSULTATION NOW
                      </div>
                    ) : (
                      <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, textAlign: 'center' }}>
                        ESTIMATED WAIT: {enc.predicted_wait_time} MINS
                      </div>
                    )}
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                     <div style={{ fontWeight: 700, color: '#475569', fontSize: '12px' }}>Dr. {enc.doctor_name}</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {enc.vitals && (enc.vitals.bp || enc.vitals.temp || enc.vitals.heartRate || enc.vitals.pulse || enc.vitals.weight || enc.vitals.height) ? (
                          <>
                             {enc.vitals.bp && (() => {
                               const bpStat = getBPStatus(enc.vitals.bp);
                               return <span style={{ fontSize: '10px', background: bpStat.bg, color: bpStat.color, padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>BP: {enc.vitals.bp}</span>;
                             })()}
                             {enc.vitals.temp && (() => {
                               const tempStat = getTempStatus(enc.vitals.temp);
                               return <span style={{ fontSize: '10px', background: tempStat.bg, color: tempStat.color, padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>Temp: {enc.vitals.temp}°F</span>;
                             })()}
                             {(enc.vitals.heartRate || enc.vitals.pulse) && (
                               <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>HR: {enc.vitals.heartRate || enc.vitals.pulse} bpm</span>
                             )}
                             {enc.vitals.weight && (
                               <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>Wt: {enc.vitals.weight} kg</span>
                             )}
                             {enc.vitals.height && (
                               <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>Ht: {enc.vitals.height} cm</span>
                             )}
                          </>
                        ) : (
                          <span style={{ fontSize: '10px', background: '#fff7ed', color: '#c2410c', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>PENDING VITALS</span>
                        )}
                      </div>
                   </div>

                    {(!enc.vitals || (!enc.vitals.bp && !enc.vitals.temp && !enc.vitals.heartRate && !enc.vitals.pulse)) ? (
                      <button 
                        onClick={() => {
                          setVitalsModalEncounter(enc);
                          setVitalsData({
                            bp: enc.vitals?.bp || "",
                            temp: enc.vitals?.temp || "",
                            heartRate: enc.vitals?.heartRate || enc.vitals?.pulse || ""
                          });
                        }}
                        style={{ 
                          width: '100%',
                          padding: '12px', background: '#3b82f6', color: 'white', border: 'none', 
                          borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                      >
                        Capture Vitals <Activity size={14} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          localStorage.setItem("currentEncounter", JSON.stringify(enc));
                          navigate(`/tenant/opd/consultation`);
                        }}
                        style={{ 
                          width: '100%',
                          padding: '12px', background: '#0f172a', color: 'white', border: 'none', 
                          borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                      >
                        Start Consult <ArrowRight size={14} />
                      </button>
                    )}
                 </div>
               ))}
               {encounters.length === 0 && (
                 <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <CheckCircle2 size={32} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                    <p style={{ fontWeight: 700, fontSize: '14px' }}>Queue is empty.</p>
                 </div>
               )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--app-bg)', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}># TOKEN</th>
                  <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>PATIENT & MRN</th>
                  <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>ASSIGNED DOCTOR</th>
                  <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>VITALS STATUS</th>
                  <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800 }}>WAIT TIME</th>
                  <th style={{ padding: '16px 24px', fontSize: '12px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {encounters.map((enc: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-light">
                    <td style={{ padding: '16px 24px' }}>
                       <span style={{ fontSize: '16px', fontWeight: 900, color: '#3b82f6' }}>{enc.token || (i + 1)}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {enc.patient_name} 
                         {(enc.vitals?.bp || enc.vitals?.temp || enc.vitals?.heartRate || enc.vitals?.pulse || enc.vitals?.weight || enc.vitals?.height) && <Activity size={14} style={{ color: '#10b981' }} />}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{enc.mrn} • {enc.gender}, {enc.age} yrs</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900 }}>DR</div>
                          <div style={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>Dr. {enc.doctor_name}</div>
                       </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {enc.vitals && (enc.vitals.bp || enc.vitals.temp || enc.vitals.heartRate || enc.vitals.pulse || enc.vitals.weight || enc.vitals.height) ? (
                          <>
                            {enc.vitals.bp && (() => {
                              const bpStat = getBPStatus(enc.vitals.bp);
                              return <span style={{ fontSize: '10px', background: bpStat.bg, color: bpStat.color, padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>BP: {enc.vitals.bp}</span>;
                            })()}
                            {enc.vitals.temp && (() => {
                              const tempStat = getTempStatus(enc.vitals.temp);
                              return <span style={{ fontSize: '10px', background: tempStat.bg, color: tempStat.color, padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>Temp: {enc.vitals.temp}°F</span>;
                            })()}
                            {(enc.vitals.heartRate || enc.vitals.pulse) && (
                              <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>HR: {enc.vitals.heartRate || enc.vitals.pulse} bpm</span>
                            )}
                            {enc.vitals.weight && (
                              <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>Wt: {enc.vitals.weight} kg</span>
                            )}
                            {enc.vitals.height && (
                              <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>Ht: {enc.vitals.height} cm</span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '10px', background: '#fff7ed', color: '#c2410c', padding: '4px 8px', borderRadius: '6px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <AlertCircle size={10} /> PENDING VITALS
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>ACTUAL:</span> {calculateActualWaitTime(enc.created_at)}
                          </div>
                          {enc.is_in_consultation ? (
                            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>● IN CONSULTATION</div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 800 }}>EST. WAIT: {enc.predicted_wait_time}m</div>
                          )}
                        </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {(!enc.vitals || (!enc.vitals.bp && !enc.vitals.temp && !enc.vitals.heartRate && !enc.vitals.pulse)) ? (
                        <button 
                          onClick={() => {
                            setVitalsModalEncounter(enc);
                            setVitalsData({
                              bp: enc.vitals?.bp || "",
                              temp: enc.vitals?.temp || "",
                              heartRate: enc.vitals?.heartRate || enc.vitals?.pulse || ""
                            });
                          }}
                          style={{ 
                            padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', 
                            borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '8px', transition: '0.2s'
                          }}
                        >
                          Capture Vitals <Activity size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            localStorage.setItem("currentEncounter", JSON.stringify(enc));
                            navigate(`/tenant/opd/consultation`);
                          }}
                          style={{ 
                            padding: '10px 20px', background: '#0f172a', color: 'white', border: 'none', 
                            borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '8px', transition: '0.2s'
                          }}
                        >
                          Start Consult <ArrowRight size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {encounters.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                    <CheckCircle2 size={40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                    <p style={{ fontWeight: 700 }}>Queue is empty. Great job!</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Vitals Modal */}
        {vitalsModalEncounter && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 900 }}>Capture Vitals</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 24px' }}>
                Entering vitals for <span style={{ fontWeight: 700, color: '#0f172a' }}>{vitalsModalEncounter.patient_name}</span>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>BLOOD PRESSURE</label>
                  <input 
                    placeholder="e.g. 120/80"
                    value={vitalsData.bp}
                    onChange={e => setVitalsData({...vitalsData, bp: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>TEMPERATURE (°F)</label>
                  <input 
                    placeholder="e.g. 98.6"
                    value={vitalsData.temp}
                    onChange={e => setVitalsData({...vitalsData, temp: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>HEART RATE (BPM)</label>
                  <input 
                    placeholder="e.g. 72"
                    value={vitalsData.heartRate}
                    onChange={e => setVitalsData({...vitalsData, heartRate: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setVitalsModalEncounter(null)}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveVitals}
                  disabled={isSavingVitals}
                  style={{ flex: 2, padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isSavingVitals ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
