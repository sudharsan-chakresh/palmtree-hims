
import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { 
  Plus, 
  Settings, 
  Layout, 
  Stethoscope,
  Activity,
  Globe,
  BarChart3,
  Trash2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

export default function AdvancedDoctorAvailabilityPage() {
  const [activeTab, setActiveTab] = useState('Weekly Schedule');
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Data for tabs
  const [schedules, setSchedules] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ utilization: 0, retention: 0, avgWait: 0, revenue: 0 });

  const tabs = [
    'Weekly Schedule',
    'Leave Management',
    'Session Templates',
    'Teleconsultation',
    'Overrides',
    'Analytics'
  ];

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/hospital/doctors`, { headers });
      const doctorList = (response.data || []).filter((s: any) => !s.role || s.role.toLowerCase() === 'doctor');
      setDoctors(doctorList);
      if (doctorList.length > 0) {
        setSelectedDoctor(doctorList[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor) {
      fetchAdminData();
      fetchDoctorStats();
    }
  }, [selectedDoctor]);

  const fetchDoctorStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/doctors/${selectedDoctor.id}/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error("Stats Error:", err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [schedRes, leaveRes, overrideRes] = await Promise.all([
        axios.get(`${API_BASE}/api/doctors/${selectedDoctor.id}/schedules`, { headers }),
        axios.get(`${API_BASE}/api/doctors/${selectedDoctor.id}/leaves`, { headers }),
        axios.get(`${API_BASE}/api/doctors/${selectedDoctor.id}/overrides`, { headers })
      ]);
      setSchedules(schedRes.data || []);
      setLeaves(leaveRes.data || []);
      setOverrides(overrideRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="loader-container">Loading...</div>;
  }

  return (
    <div className="dashboard-layout" style={{ background: 'var(--app-bg)', minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '24px 40px' }}>
        <Header title="Enterprise Scheduling Console" />

        <div style={{ marginTop: '32px' }}>
          {/* Doctor Selection & Tabs */}
          <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #eef2f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Stethoscope size={24} color="#0ea5e9" />
                <select 
                  value={selectedDoctor?.id || ""} 
                  onChange={(e) => setSelectedDoctor(doctors.find(d => d.id === e.target.value))}
                  style={{ fontSize: '18px', fontWeight: 800, border: 'none', background: 'none', outline: 'none' }}
                >
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name.toLowerCase().startsWith('dr') ? d.name : `Dr. ${d.name}`}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={actionBtnStyle}><Activity size={16} /> Status: Active</button>
                <button style={{ ...actionBtnStyle, background: '#1e293b', color: 'white' }}><Settings size={16} /> Settings</button>
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', gap: '32px' }}>
              {tabs.map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '12px 4px',
                    border: 'none',
                    background: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: activeTab === tab ? '#0ea5e9' : '#64748b',
                    borderBottom: activeTab === tab ? '2px solid #0ea5e9' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ marginTop: '32px' }}>
            {activeTab === 'Weekly Schedule' && (
              <WeeklyScheduleGrid doctor={selectedDoctor} schedules={schedules} onUpdate={fetchAdminData} />
            )}
            {activeTab === 'Leave Management' && (
              <LeaveManagementPanel doctor={selectedDoctor} leaves={leaves} onUpdate={fetchAdminData} />
            )}
            {activeTab === 'Overrides' && (
              <OverridesPanel doctor={selectedDoctor} overrides={overrides} onUpdate={fetchAdminData} />
            )}

            {activeTab === 'Session Templates' && (
               <SessionTemplatesPanel />
            )}
            {activeTab === 'Teleconsultation' && (
               <TeleconsultationPanel />
            )}
            {activeTab === 'Analytics' && (
               <AnalyticsPanel stats={stats} />
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

const WeeklyScheduleGrid = ({ doctor, schedules, onUpdate }: any) => {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [showAdd, setShowAdd] = useState(false);
  const [newSched, setNewSched] = useState({
    weekday: 1,
    session_name: 'Morning OPD',
    start_time: '09:00',
    end_time: '13:00',
    slot_duration: 30,
    consultation_type: 'OPD',
    is_active: true
  });

  const handleAdd = async () => {
    try {
      await axios.post(`${API_BASE}/api/doctors/schedules`, { ...newSched, doctor_id: doctor.id }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-tenant-id": localStorage.getItem("tenant") || ""
        }
      });
      setShowAdd(false);
      onUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #eef2f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>Doctor Recurring Schedule</h3>
        <button onClick={() => setShowAdd(true)} style={{ ...actionBtnStyle, background: '#0ea5e9', color: 'white' }}><Plus size={16} /> Add Session</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #f8fafc' }}>
            <th style={{ padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Day</th>
            <th style={{ padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Session</th>
            <th style={{ padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Hours</th>
            <th style={{ padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Slot</th>
            <th style={{ padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Type</th>
            <th style={{ padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s: any) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
              <td style={{ padding: '16px', fontWeight: 700 }}>{weekdays[s.weekday]}</td>
              <td style={{ padding: '16px' }}>{s.session_name}</td>
              <td style={{ padding: '16px', fontWeight: 600 }}>{s.start_time} - {s.end_time}</td>
              <td style={{ padding: '16px' }}>{s.slot_duration} mins</td>
              <td style={{ padding: '16px' }}><span style={{ padding: '4px 8px', borderRadius: '6px', background: '#f1f5f9', fontSize: '11px', fontWeight: 800 }}>{s.consultation_type}</span></td>
              <td style={{ padding: '16px' }}><button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd && (
        <div style={{ marginTop: '24px', padding: '24px', background: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h4>Add New Weekly Session</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <select value={newSched.weekday} onChange={(e) => setNewSched({...newSched, weekday: parseInt(e.target.value)})}>
              {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input type="text" placeholder="Session Name" value={newSched.session_name} onChange={(e) => setNewSched({...newSched, session_name: e.target.value})} />
            <input type="time" value={newSched.start_time} onChange={(e) => setNewSched({...newSched, start_time: e.target.value})} />
            <input type="time" value={newSched.end_time} onChange={(e) => setNewSched({...newSched, end_time: e.target.value})} />
            <select value={newSched.consultation_type} onChange={(e) => setNewSched({...newSched, consultation_type: e.target.value as any})}>
              <option value="OPD">OPD</option>
              <option value="VIDEO">VIDEO</option>
              <option value="SURGERY">SURGERY</option>
            </select>
            <button onClick={handleAdd} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800 }}>Save Session</button>
          </div>
        </div>
      )}
    </div>
  );
};

const LeaveManagementPanel = ({ doctor, leaves, onUpdate }: any) => {
  const [showAdd, setShowAdd] = useState(false);
  const [isPartialDay, setIsPartialDay] = useState(false);
  const [newLeave, setNewLeave] = useState({
    leave_type: 'VACATION',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    reason: '',
    is_emergency: false
  });

  const handleAdd = async () => {
    try {
      const payload = {
        ...newLeave,
        doctor_id: doctor.id,
        start_time: isPartialDay ? newLeave.start_time : null,
        end_time: isPartialDay ? newLeave.end_time : null,
      };
      await axios.post(`${API_BASE}/api/doctors/leaves`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-tenant-id": localStorage.getItem("tenant") || ""
        }
      });
      setShowAdd(false);
      setIsPartialDay(false);
      onUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #eef2f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3>Leave & OOO Management</h3>
        <button onClick={() => setShowAdd(true)} style={{ ...actionBtnStyle, background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold' }}><Plus size={16} /> Record Leave</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {leaves.map((l: any) => (
          <div key={l.id} style={{ padding: '20px', borderRadius: '16px', background: l.is_emergency ? '#fff1f2' : '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: l.is_emergency ? '#e11d48' : '#64748b', textTransform: 'uppercase' }}>{l.leave_type}</span>
              {l.is_emergency && <AlertCircle size={14} color="#e11d48" />}
            </div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>
              {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
              {l.start_time && l.end_time ? ` (${l.start_time} - ${l.end_time})` : ' (Full Day)'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>{l.reason || 'No reason provided'}</div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ marginTop: '24px', padding: '24px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2' }}>
           <h4>Record Doctor Leave</h4>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
             <select value={newLeave.leave_type} onChange={(e) => setNewLeave({...newLeave, leave_type: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
               <option value="VACATION">VACATION</option>
               <option value="SICK">SICK</option>
               <option value="SURGERY">SURGERY</option>
               <option value="EMERGENCY">EMERGENCY</option>
             </select>
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <input type="checkbox" checked={newLeave.is_emergency} onChange={(e) => setNewLeave({...newLeave, is_emergency: e.target.checked})} />
               <label>Emergency</label>
             </div>
             <input type="date" value={newLeave.start_date} onChange={(e) => setNewLeave({...newLeave, start_date: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
             <input type="date" value={newLeave.end_date} onChange={(e) => setNewLeave({...newLeave, end_date: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
             
             <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
               <input 
                 type="checkbox" 
                 id="adv_partial_day_checkbox" 
                 checked={isPartialDay} 
                 onChange={(e) => setIsPartialDay(e.target.checked)} 
                 style={{ cursor: 'pointer' }}
               />
               <label htmlFor="adv_partial_day_checkbox" style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                 Partial Day Leave (Block Specific Hours)
               </label>
             </div>

             {isPartialDay && (
               <>
                 <div>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>Start Time</label>
                   <input type="time" value={newLeave.start_time} onChange={(e) => setNewLeave({ ...newLeave, start_time: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                 </div>
                 <div>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>End Time</label>
                   <input type="time" value={newLeave.end_time} onChange={(e) => setNewLeave({ ...newLeave, end_time: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                 </div>
               </>
             )}

             <textarea placeholder="Reason" value={newLeave.reason} onChange={(e) => setNewLeave({...newLeave, reason: e.target.value})} style={{ gridColumn: 'span 2', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
             <button onClick={handleAdd} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 800, cursor: 'pointer' }}>Save Leave Record</button>
           </div>
        </div>
      )}
    </div>
  );
};

const OverridesPanel = ({ doctor, overrides, onUpdate }: any) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newOverride, setNewOverride] = useState({
    override_date: '',
    start_time: '08:00',
    end_time: '12:00',
    is_available: false,
    reason: ''
  });

  const handleAdd = async () => {
    try {
      await axios.post(`${API_BASE}/api/doctors/overrides`, { ...newOverride, doctor_id: doctor.id }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-tenant-id": localStorage.getItem("tenant") || ""
        }
      });
      setShowAdd(false);
      onUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #eef2f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3>Availability Overrides</h3>
        <button onClick={() => setShowAdd(true)} style={{ ...actionBtnStyle, background: '#f97316', color: 'white' }}><Plus size={16} /> Add Exception</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {overrides.map((o: any) => (
          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{new Date(o.override_date).toLocaleDateString()} | {o.start_time} - {o.end_time}</div>
              <div style={{ fontSize: '13px', color: '#c2410c' }}>{o.is_available ? 'Available (Exception)' : 'Blocked (Exception)'}: {o.reason}</div>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#f97316' }}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ marginTop: '24px', padding: '24px', background: '#fff7ed', borderRadius: '16px', border: '1px solid #ffedd5' }}>
           <h4>Add Temporary Override</h4>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
             <input type="date" value={newOverride.override_date} onChange={(e) => setNewOverride({...newOverride, override_date: e.target.value})} />
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <input type="checkbox" checked={newOverride.is_available} onChange={(e) => setNewOverride({...newOverride, is_available: e.target.checked})} />
               <label>Mark Available</label>
             </div>
             <input type="time" value={newOverride.start_time} onChange={(e) => setNewOverride({...newOverride, start_time: e.target.value})} />
             <input type="time" value={newOverride.end_time} onChange={(e) => setNewOverride({...newOverride, end_time: e.target.value})} />
             <input type="text" placeholder="Reason (e.g. Doctor late, OT extended)" value={newOverride.reason} onChange={(e) => setNewOverride({...newOverride, reason: e.target.value})} style={{ gridColumn: 'span 2' }} />
             <button onClick={handleAdd} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 800 }}>Apply Override</button>
           </div>
        </div>
      )}
    </div>
  );
};


const SessionTemplatesPanel = () => {
  const templates = [
    { name: 'Morning General OPD', start: '09:00', end: '13:00', slots: 15, color: '#0ea5e9' },
    { name: 'Evening Specialist Clinic', start: '17:00', end: '20:00', slots: 10, color: '#8b5cf6' },
    { name: 'Night Emergency Block', start: '21:00', end: '00:00', slots: 6, color: '#ef4444' }
  ];

  return (
    <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #eef2f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3>Shared Session Templates</h3>
        <button style={actionBtnStyle}><Plus size={16} /> Create Template</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {templates.map(t => (
          <div key={t.name} style={{ padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9', background: '#fafafa' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px' }}>
              <Layout size={20} />
            </div>
            <h4 style={{ margin: '0 0 8px 0' }}>{t.name}</h4>
            <div style={{ fontSize: '13px', color: '#64748b' }}>{t.start} - {t.end} • {t.slots} slots</div>
            <button style={{ marginTop: '16px', background: 'none', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Apply to Doctor</button>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeleconsultationPanel = () => {
  return (
    <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #eef2f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3>Virtual Consultation Setup</h3>
        <button style={{ ...actionBtnStyle, background: '#0ea5e9', color: 'white' }}><Globe size={16} /> Update Links</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <label style={labelStyle}>Primary Platform</label>
          <select style={inputStyle} defaultValue="zoom">
            <option value="zoom">Zoom Healthcare</option>
            <option value="teams">MS Teams Clinical</option>
            <option value="hims-native">Nexus Native Video</option>
          </select>
          <div style={{ marginTop: '20px' }}>
            <label style={labelStyle}>Waiting Room Message</label>
            <textarea style={{ ...inputStyle, height: '100px' }} placeholder="Please wait while the doctor joins the call..." />
          </div>
        </div>
        <div style={{ background: 'var(--app-bg)', padding: '24px', borderRadius: '20px' }}>
          <h4 style={{ marginTop: 0 }}>Tele-consult Rules</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Buffer between calls</span>
              <span style={{ fontWeight: 800 }}>5 mins</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Auto-close after end</span>
              <span style={{ fontWeight: 800 }}>Enabled</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Allow international callers</span>
              <span style={{ color: '#ef4444', fontWeight: 800 }}>Restricted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsPanel = ({ stats }: any) => {
  const statItems = [
    { label: 'Avg Utilization', value: `${Math.round(stats.utilization)}%`, icon: BarChart3, color: '#0ea5e9' },
    { label: 'Patient Retention', value: `${Math.round(stats.retention)}%`, icon: Activity, color: '#10b981' },
    { label: 'Avg Wait Time', value: `${Math.round(stats.avgWait)}m`, icon: AlertCircle, color: '#f59e0b' },
    { label: 'Est. Revenue', value: `₹${(stats.revenue / 100000).toFixed(1)}L`, icon: TrendingUp, color: '#8b5cf6' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {statItems.map(s => (
          <div key={s.label} style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #eef2f6' }}>
            <div style={{ color: s.color, marginBottom: '12px' }}><s.icon size={24} /></div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #eef2f6', minHeight: '300px' }}>
        <h3>Utilization Trends (Last 30 Days)</h3>
        <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '20px 0' }}>
          {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 40, 95].map((h, i) => (
            <div key={i} style={{ flex: 1, background: i === 11 ? '#0ea5e9' : '#f1f5f9', height: `${h}%`, borderRadius: '6px', transition: 'all 0.3s' }}></div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', fontWeight: 700 }}>
          <span>WEEK 1</span>
          <span>WEEK 2</span>
          <span>WEEK 3</span>
          <span>WEEK 4</span>
        </div>
      </div>
    </div>
  );
};

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, outline: 'none' };
const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', border: '1px solid #e2e8f0', background: 'white', transition: 'all 0.2s' };

