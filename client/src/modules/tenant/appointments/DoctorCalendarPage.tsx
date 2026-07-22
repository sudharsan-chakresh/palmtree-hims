import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { 
  Settings, 
  ChevronRight, 
  ChevronLeft, 
  Stethoscope
} from 'lucide-react';

export default function AdvancedDoctorAvailabilityPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/hospital/staff`, { headers });
      const doctorList = response.data.filter((staff: any) => staff.role === 'doctor' || staff.role === 'DOCTOR');
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
      fetchAppointments();
    }
  }, [selectedDoctor, currentDate]);

  const fetchAppointments = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/appointments`, { headers });
      setAppointments(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: 'var(--app-bg)' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loader"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" style={{ background: '#f4f7fa', minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '24px 40px' }}>
        <Header title="Advanced Scheduling Console" />

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Advanced Control Bar */}
          <section style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'white',
            padding: '24px 32px',
            borderRadius: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            border: '1px solid #eef2f6'
          }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--app-bg)', padding: '10px 16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <Stethoscope size={18} color="#0ea5e9" />
                <select 
                  value={selectedDoctor?.id || ""} 
                  onChange={(e) => setSelectedDoctor(doctors.find(d => d.id === e.target.value))}
                  style={{ border: 'none', background: 'none', fontWeight: 700, outline: 'none', color: '#1e293b' }}
                >
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                <button 
                  onClick={() => setViewMode('week')}
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: viewMode === 'week' ? 'white' : 'transparent',
                    color: viewMode === 'week' ? '#0ea5e9' : '#64748b',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'week' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Week View
                </button>
                <button 
                  onClick={() => setViewMode('day')}
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: viewMode === 'day' ? 'white' : 'transparent',
                    color: viewMode === 'day' ? '#0ea5e9' : '#64748b',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'day' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Day View
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => {
                  const d = new Date(currentDate); d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 1)); setCurrentDate(d);
                }} style={navBtnStyle}><ChevronLeft size={18} /></button>
                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>
                  {viewMode === 'week' ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <button onClick={() => {
                  const d = new Date(currentDate); d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 1)); setCurrentDate(d);
                }} style={navBtnStyle}><ChevronRight size={18} /></button>
              </div>
              <button style={{ ...actionBtnStyle, background: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} />
                Global Settings
              </button>
            </div>
          </section>

          {/* Grid View */}
          <div style={{ 
            background: 'white', 
            borderRadius: '32px', 
            overflow: 'hidden', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            border: '1px solid #eef2f6'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: `100px repeat(${viewMode === 'week' ? 7 : 1}, 1fr)`, 
              background: '#fcfdfe',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ padding: '20px', borderRight: '1px solid #f1f5f9' }}></div>
              {(viewMode === 'week' ? weekDates : [currentDate]).map((date, i) => (
                <div key={i} style={{ padding: '16px', textAlign: 'center', borderRight: i < 6 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', marginTop: '2px' }}>{date.getDate()}</div>
                </div>
              ))}
            </div>

            <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
              {timeSlots.map((time, slotIdx) => (
                <div key={slotIdx} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `100px repeat(${viewMode === 'week' ? 7 : 1}, 1fr)`,
                  borderBottom: '1px solid #f8fafc'
                }}>
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#cbd5e1', borderRight: '1px solid #f1f5f9' }}>{time}</div>
                  {(viewMode === 'week' ? weekDates : [currentDate]).map((date, dayIdx) => {
                    const appt = appointments.find(a => {
                      if (a.doctor_id !== selectedDoctor?.id || !a.appointment_time) return false;
                      const str = typeof a.appointment_time === 'string' ? a.appointment_time : new Date(a.appointment_time).toISOString();
                      const parts = str.split('T');
                      if (parts.length >= 2) {
                        const apptDateStr = parts[0];
                        const apptTime = parts[1].substring(0, 5);
                        
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const targetDateStr = `${year}-${month}-${day}`;
                        
                        return apptDateStr === targetDateStr && apptTime === time;
                      }
                      return false;
                    });
                    return (
                      <div key={dayIdx} style={{ padding: '4px', borderRight: dayIdx < 6 ? '1px solid #f8fafc' : 'none' }}>
                        {appt ? (
                          <div style={{ 
                            background: '#0ea5e9', 
                            color: 'white', 
                            padding: '8px 12px', 
                            borderRadius: '10px', 
                            fontSize: '11px', 
                            fontWeight: 700,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {appt.patient_name}
                          </div>
                        ) : (
                          <div style={{ height: '36px', borderRadius: '8px', border: '1px dashed #e2e8f0' }}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          .loader {
            width: 48px;
            height: 48px;
            border: 5px solid #e2e8f0;
            border-bottom-color: #0ea5e9;
            border-radius: 50%;
            display: inline-block;
            box-sizing: border-box;
            animation: rotation 1s linear infinite;
          }
          @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    </div>
  );
}

const navBtnStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#64748b',
  transition: 'all 0.2s'
};

const actionBtnStyle = {
  padding: '10px 20px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
  border: '1px solid #e2e8f0',
  transition: 'all 0.2s'
};

