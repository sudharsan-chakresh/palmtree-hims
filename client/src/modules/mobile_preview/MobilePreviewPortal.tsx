import { useState, useEffect } from 'react';
import { Search, Shield, User, Calendar, Activity, Mic, Bell, ArrowLeft, ChevronRight, Video, FileText } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API_BASE = API_BASE_URL;

const MobilePreviewPortal = () => {
  const [view, setView] = useState('doctor-dashboard'); // doctor-dashboard, patient-dashboard, abha-card, patient-record
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      // Reusing existing HIMS API
      const res = await axios.get(`${API_BASE}/api/appointments`, {
        headers: { 
          'x-tenant-id': localStorage.getItem('tenant') || '',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      setAppointments(res.data.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  const renderHeader = (title: string, showBack = true) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '20px', background: 'white', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #f1f5f9' }}>
      {showBack && <ArrowLeft size={20} style={{ marginRight: '16px', color: '#64748b' }} onClick={() => setView('doctor-dashboard')} />}
      <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#1e293b' }}>{title}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px' }}>
        <Bell size={20} color="#0284c7" />
        <User size={20} color="#64748b" onClick={() => setView(view === 'doctor-dashboard' ? 'patient-dashboard' : 'doctor-dashboard')} />
      </div>
    </div>
  );

  const DoctorDashboard = () => (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
        <div style={{ flex: 1, background: '#eff6ff', padding: '20px', borderRadius: '20px', border: '1px solid #dbeafe' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', marginBottom: '4px' }}>APPOINTMENTS</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a' }}>{appointments.length}</div>
        </div>
        <div style={{ flex: 1, background: '#fff7ed', padding: '20px', borderRadius: '20px', border: '1px solid #ffedd5' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', marginBottom: '4px' }}>IPD ROUNDS</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#7c2d12' }}>04</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 900, color: '#64748b', letterSpacing: '1px' }}>UPCOMING QUEUE</h2>
        <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700 }}>View All</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {appointments.map((apt: any) => (
          <div 
            key={apt.id} 
            onClick={() => setView('patient-record')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
          >
            <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '14px', marginRight: '16px' }}>
              <Calendar size={20} color="#64748b" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>{apt.patient?.name || 'Selvakumar Balakrishnan'}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{apt.appointment_time} • {apt.type || 'OPD'}</div>
            </div>
            <ChevronRight size={16} color="#cbd5e1" />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 900, color: '#64748b', letterSpacing: '1px' }}>QUICK ACTIONS</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[{ i: Mic, l: 'Voice Note', c: '#a855f7' }, { i: Video, l: 'Tele-Health', c: '#ef4444' }, { i: Activity, l: 'View Labs', c: '#6366f1' }, { i: FileText, l: 'Add Patient', c: '#22c55e' }].map((act, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <act.i size={18} color={act.c} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>{act.l}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const AbhaCard = () => (
    <div style={{ padding: '24px' }}>
      <div style={{ 
        width: '100%', height: '220px', 
        background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)', 
        borderRadius: '24px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        padding: '24px', display: 'flex', flexDirection: 'column', color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2px', opacity: 0.8 }}>ABHA ID CARD</div>
          <Shield size={20} />
        </div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, marginBottom: '4px' }}>Selvakumar Balakrishnan</div>
          <div style={{ fontSize: '16px', letterSpacing: '2px', opacity: 0.8 }}>91-1234-5678-9012</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px' }}>
            <div>
              <div style={{ fontSize: '9px', opacity: 0.6 }}>DATE OF BIRTH</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>15 / 06 / 1985</div>
            </div>
            <div style={{ background: 'white', padding: '6px', borderRadius: '8px' }}>
               <Search size={28} color="#0369a1" />
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '40px' }}>
         <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#64748b', letterSpacing: '1px', marginBottom: '16px' }}>LINKED CLINICAL DATA</h3>
         {[
           { l: 'LATEST REPORT', v: 'Complete Blood Count', d: 'May 10', c: '#0ea5e9' },
           { l: 'CONSENT LOGS', v: 'Apollo Hospitals', d: 'Active', c: '#22c55e' }
         ].map((item, i) => (
           <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'white', borderRadius: '18px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
             <div style={{ width: '4px', height: '30px', background: item.c, borderRadius: '2px', marginRight: '16px' }} />
             <div style={{ flex: 1 }}>
               <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8' }}>{item.l}</div>
               <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{item.v}</div>
             </div>
             <div style={{ fontSize: '11px', fontWeight: 700, color: item.c }}>{item.d}</div>
           </div>
         ))}
      </div>
    </div>
  );

  return (
    <div style={{ 
      width: '100vw', height: '100vh', background: 'var(--app-bg)', overflowY: 'auto',
      maxWidth: '500px', margin: '0 auto', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0'
    }}>
      {view === 'doctor-dashboard' && (
        <>
          {renderHeader('Command Center', false)}
          <DoctorDashboard />
        </>
      )}
      {view === 'patient-dashboard' && (
        <>
          {renderHeader('Patient Portal')}
          <div style={{ padding: '24px' }}>
             <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b', marginBottom: '32px' }}>Welcome back,<br/><span style={{ color: '#0284c7' }}>Selvakumar</span></h2>
             <div 
               onClick={() => setView('abha-card')}
               style={{ padding: '20px', background: 'linear-gradient(to right, #0284c7, #0369a1)', borderRadius: '24px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
             >
                <Shield size={32} color="white" />
                <div style={{ marginLeft: '16px', color: 'white' }}>
                   <div style={{ fontWeight: 800 }}>Digital ABHA Card</div>
                   <div style={{ fontSize: '12px', opacity: 0.8 }}>Secure National Identity</div>
                </div>
                <ChevronRight size={18} color="white" style={{ marginLeft: 'auto' }} />
             </div>
          </div>
        </>
      )}
      {view === 'abha-card' && (
        <>
          {renderHeader('Digital ID')}
          <AbhaCard />
        </>
      )}
      {view === 'patient-record' && (
        <>
          {renderHeader('Patient Record')}
          <div style={{ padding: '20px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <div style={{ width: '60px', height: '60px', background: '#e0f2fe', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <User size={35} color="#0284c7" />
                </div>
                <div>
                   <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>Selvakumar B.</div>
                   <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800 }}>MRN-2405-001243 • 38y • Male</div>
                </div>
             </div>
             
             <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '32px' }}>
                {[{l:'BP', v:'120/80', c:'red'}, {l:'TEMP', v:'98.6', c:'orange'}, {l:'WT', v:'72kg', c:'green'}].map((v, i) => (
                  <div key={i} style={{ minWidth: '90px', padding: '12px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 900, color: v.c }}>{v.l}</div>
                    <div style={{ fontSize: '16px', fontWeight: 900 }}>{v.v}</div>
                  </div>
                ))}
             </div>

             <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#64748b', letterSpacing: '1px', marginBottom: '16px' }}>CLINICAL TIMELINE</h3>
             <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '6px', paddingLeft: '20px' }}>
                <div style={{ position: 'relative', marginBottom: '24px' }}>
                   <div style={{ position: 'absolute', left: '-27px', top: '0', width: '12px', height: '12px', background: '#0284c7', borderRadius: '6px' }} />
                   <div style={{ fontWeight: 800, fontSize: '15px' }}>OPD Consultation</div>
                   <div style={{ fontSize: '11px', color: '#94a3b8' }}>May 12, 2026 • Dr. Selva</div>
                   <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Patient reported mild fever and cough. Vital signs stable.</div>
                </div>
             </div>
          </div>
          <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '400px', padding: '0 20px' }}>
             <button style={{ 
               width: '100%', height: '56px', background: '#0284c7', color: 'white', 
               borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '15px',
               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
               boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.4)'
             }}>
                <Mic size={20} /> AI VOICE NOTE
             </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MobilePreviewPortal;
