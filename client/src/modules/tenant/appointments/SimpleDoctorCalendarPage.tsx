import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Stethoscope,
  ChevronDown,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';

export default function DoctorAvailabilityPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [docRes, patRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/doctors`, { headers }),
        axios.get(`${API_BASE}/api/patients?limit=200`, { headers })
      ]);
      
      const allDocs = docRes.data || [];
      const doctorList = allDocs.filter((s: any) => !s.role || s.role.toLowerCase() === 'doctor');
      setDoctors(doctorList);
      setPatients(patRes.data || []);
      
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
      fetchSchedule();
    }
  }, [selectedDoctor, currentDate]);

  const fetchSchedule = async () => {
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const response = await axios.get(
        `${API_BASE}/api/doctors/${selectedDoctor.id}/schedule?startDate=${start.toLocaleDateString('en-CA')}&endDate=${end.toLocaleDateString('en-CA')}`,
        { headers }
      );
      setAppointments(response.data.appointments || []);
      // Pre-process availability for faster matching
      const rawAvail = response.data.availability || [];
      console.log("RAW AVAILABILITY FROM DB:", rawAvail);

      const processedAvail = rawAvail.map((a: any) => {
        let ts = "00:00";
        try {
          const rawTime = String(a.start_time || "");
          // Look for HH:MM anywhere in the string
          const match = rawTime.match(/(\d{2}:\d{2})/);
          ts = match ? match[1] : "00:00";
        } catch (e) { console.error("Time Parse Error:", e); }

        let ds = "1970-01-01";
        try {
          const rawDate = String(a.date || "");
          const match = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
          ds = match ? match[1] : "1970-01-01";
        } catch (e) { console.error("Date Parse Error:", e); }
        
        return { ...a, dateStr: ds, timeStr: ts };
      });

      console.log("PROCESSED AVAILABILITY:", processedAvail);
      setAvailability(processedAvail);
    } catch (err) {
      console.error("Fetch Schedule Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlockSlot = async (time: string, date: Date) => {
    try {
      const dateStr = date.toLocaleDateString('en-CA');
      const existing = availability.find(a => a.dateStr === dateStr && a.timeStr === time);
      
      const payload = {
        date: dateStr,
        startTime: time,
        endTime: calculateEndTime(time),
        isAvailable: existing ? !existing.is_available : false 
      };

      await axios.post(`${API_BASE}/api/doctors/${selectedDoctor.id}/availability`, payload, { headers });
      fetchSchedule();
    } catch (err) {
      console.error(err);
      alert("Failed to update availability");
    }
  };

  const blockBulk = async (type: 'day' | 'week') => {
    if (!selectedDoctor) return;
    const confirmMsg = type === 'day' 
      ? "Are you sure you want to block the ENTIRE current day for appointments?" 
      : "Are you sure you want to block the ENTIRE current week for appointments?";
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const dates = [];
      if (type === 'day') {
        const selDate = currentDate.toLocaleDateString('en-CA');
        if (selDate < todayStr) {
          alert("Cannot block dates in the past.");
          return;
        }
        dates.push(selDate);
      } else {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dStr = d.toLocaleDateString('en-CA');
          if (dStr >= todayStr) {
            dates.push(dStr);
          }
        }
      }

      if (dates.length === 0) {
        alert("No valid future dates selected to block.");
        return;
      }

      await axios.post(`${API_BASE}/api/doctors/${selectedDoctor.id}/bulk-availability`, {
        dates,
        startTime: "08:00",
        endTime: "20:00",
        isAvailable: false
      }, { headers });

      alert(`Successfully blocked the entire ${type}!`);
      fetchSchedule();
    } catch (err: any) {
      console.error("Bulk Block Error:", err.response?.data || err.message);
      alert(`Failed to block bulk slots: ${err.response?.data?.error || err.message}`);
    }
  };

  const blockBulkHours = async (start: string, end: string) => {
    if (!selectedDoctor) return;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const selDate = currentDate.toLocaleDateString('en-CA');

    if (selDate < todayStr) {
      alert("Cannot block slots for past dates.");
      return;
    }

    if (!window.confirm(`Block appointments from ${start} to ${end} on ${currentDate.toLocaleDateString()}?`)) return;

    try {
      await axios.post(`${API_BASE}/api/doctors/${selectedDoctor.id}/bulk-availability`, {
        dates: [currentDate.toLocaleDateString('en-CA')],
        startTime: start,
        endTime: end,
        isAvailable: false
      }, { headers });

      alert(`Successfully blocked hours: ${start} - ${end}`);
      fetchSchedule();
    } catch (err: any) {
      console.error("Hour Block Error:", err.response?.data || err.message);
      alert(`Failed to block hours: ${err.response?.data?.error || err.message}`);
    }
  };

  const calculateEndTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    let totalMins = h * 60 + m + 30;
    const nh = Math.floor(totalMins / 60);
    const nm = totalMins % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  };

  const bookAppointment = async () => {
    if (!selectedPatient || !selectedTime || !selectedDoctor || !selectedDate) {
      alert("Please ensure patient, doctor, and slot are selected.");
      return;
    }

    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const appointmentTimeStr = `${dateStr}T${selectedTime}:00`;

      const appointmentData = {
        patient_id: selectedPatient,
        doctor_id: selectedDoctor.id,
        appointment_time: appointmentTimeStr,
        status: 'Scheduled'
      };

      await axios.post(`${API_BASE}/api/appointments`, appointmentData, { headers });
      fetchSchedule();
      setShowBookingModal(false);
      setSelectedPatient("");
      alert("Success! Appointment has been scheduled.");
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Booking failed. Please try again.";
      alert(errMsg);
    }
  };

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

  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

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
        <Header title="Schedule Management" />

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Top Control Bar Redesign */}
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
            <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                  width: '52px', 
                  height: '52px', 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Stethoscope size={24} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Clinician</label>
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={selectedDoctor?.id || ""} 
                      onChange={(e) => setSelectedDoctor(doctors.find(d => d.id === e.target.value))}
                      style={{ 
                        fontSize: '16px', 
                        fontWeight: 800, 
                        color: '#1e293b', 
                        border: 'none', 
                        background: 'none', 
                        paddingRight: '24px',
                        appearance: 'none',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {doctors.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name.toLowerCase().startsWith('dr.') ? d.name : `Dr. ${d.name}`}
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--app-bg)', padding: '8px 16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <button onClick={() => {
                  const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d);
                }} style={navBtnStyle}><ChevronLeft size={16} /></button>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, minWidth: '160px', textAlign: 'center' }}>
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => {
                  const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d);
                }} style={navBtnStyle}><ChevronRight size={16} /></button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setBlockMode(!blockMode)} 
                style={{ 
                  ...actionBtnStyle, 
                  background: blockMode ? '#ef4444' : '#f1f5f9', 
                  color: blockMode ? 'white' : '#475569',
                  border: blockMode ? 'none' : '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: blockMode ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
                }}
              >
                {blockMode ? <Lock size={16} /> : <Unlock size={16} />}
                {blockMode ? "Exit Block Mode" : "Manage Unavailability"}
              </button>
              <button onClick={() => setCurrentDate(new Date())} style={{ ...actionBtnStyle, background: 'white', color: '#1e293b', border: '1px solid #e2e8f0' }}>Today</button>
            </div>
          </section>

          {blockMode && (
            <div style={{ 
              background: '#fff1f2', 
              padding: '16px 24px', 
              borderRadius: '16px', 
              border: '1px solid #fda4af',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.3s ease'
            }}>
              <AlertCircle size={20} color="#e11d48" />
              <div style={{ fontSize: '14px', color: '#9f1239', fontWeight: 700, flex: 1 }}>
                <strong>Unavailability Mode Active:</strong> Click any slot to toggle its availability.
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => blockBulk('day')}
                  style={{ background: '#be123c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                >
                  BLOCK FULL DAY
                </button>
                <button 
                  onClick={() => blockBulk('week')}
                  style={{ background: '#9f1239', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                >
                  BLOCK FULL WEEK
                </button>

                <div style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid #fda4af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9f1239' }}>HOURS:</span>
                  <select id="bulk-start" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '11px', fontWeight: 700, color: '#9f1239', background: 'white' }}>
                    {Array.from({length: 25}, (_, i) => `${i.toString().padStart(2, '0')}:00`).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ fontSize: '11px', color: '#9f1239' }}>TO</span>
                  <select id="bulk-end" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '11px', fontWeight: 700, color: '#9f1239', background: 'white' }}>
                    {Array.from({length: 25}, (_, i) => `${i.toString().padStart(2, '0')}:00`).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button 
                    onClick={() => {
                      const s = (document.getElementById('bulk-start') as HTMLSelectElement).value;
                      const e = (document.getElementById('bulk-end') as HTMLSelectElement).value;
                      blockBulkHours(s, e);
                    }}
                    style={{ background: '#e11d48', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    BLOCK HOURS
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Layout: Calendar + Sidebar */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Calendar Grid (70%) */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                background: 'white', 
                borderRadius: '32px', 
                overflow: 'hidden', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                border: '1px solid #eef2f6'
              }}>
                {/* Grid Header */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '100px repeat(7, 1fr)', 
                  background: '#fcfdfe',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{ padding: '24px', borderRight: '1px solid #f1f5f9' }}></div>
                  {weekDates.map((date, i) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div key={i} style={{ 
                        padding: '20px 12px', 
                        textAlign: 'center', 
                        borderRight: i < 6 ? '1px solid #f1f5f9' : 'none',
                        background: isToday ? 'rgba(14, 165, 233, 0.04)' : 'transparent'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: isToday ? '#0ea5e9' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                        </span>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: isToday ? '#0ea5e9' : '#1e293b', marginTop: '2px' }}>{date.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Grid Body */}
                <div style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
                  {timeSlots.map((time, slotIdx) => (
                    <div key={slotIdx} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '100px repeat(7, 1fr)',
                      borderBottom: '1px solid #f8fafc'
                    }}>
                      <div style={{ 
                        padding: '12px 8px', 
                        textAlign: 'center', 
                        fontSize: '12px', 
                        fontWeight: 700, 
                        color: '#cbd5e1',
                        background: '#fcfdfe',
                        borderRight: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>{time}</div>
                      
                      {weekDates.map((date, dayIdx) => {
                        const dateStr = date.toLocaleDateString('en-CA');
                        const isToday = date.toDateString() === new Date().toDateString();
                        
                        const appt = appointments.find(a => {
                          if (!a.appointment_time) return false;
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

                        const block = availability.find(a => 
                          a.dateStr === dateStr && a.timeStr === time && !a.is_available
                        );
                        
                        return (
                          <div key={dayIdx} style={{ 
                            padding: '4px', 
                            borderRight: dayIdx < 6 ? '1px solid #f8fafc' : 'none',
                            background: isToday ? 'rgba(14, 165, 233, 0.02)' : 'transparent',
                            minHeight: '44px'
                          }}>
                            {appt ? (
                              <div style={{
                                background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
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
                            ) : block ? (
                              <div 
                                onClick={() => blockMode && toggleBlockSlot(time, date)}
                                style={{
                                  background: '#fef2f2',
                                  color: '#ef4444',
                                  height: '100%',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  cursor: blockMode ? 'pointer' : 'default',
                                  border: '1px solid #fee2e2',
                                  textTransform: 'uppercase'
                                }}
                              >
                                NOT AVAILABLE
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  if (blockMode) {
                                    toggleBlockSlot(time, date);
                                  } else {
                                    setSelectedTime(time);
                                    setSelectedDate(date);
                                    setShowBookingModal(true);
                                  }
                                }}
                                className="slot-btn"
                                style={{
                                  width: '100%',
                                  height: '40px',
                                  borderRadius: '10px',
                                  border: '1px dashed #e2e8f0',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#cbd5e1',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar: Leave Summary (30%) */}
            <div style={{ width: '320px', position: 'sticky', top: '24px' }}>
              <div style={{ background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '10px' }}>
                    <Lock size={18} color="#ef4444" />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>Weekly Leave Log</h4>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                  {availability.filter(a => !a.is_available).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: 'var(--app-bg)', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                      No hours blocked this week.
                    </div>
                  ) : (
                    availability.filter(a => !a.is_available).sort((a,b) => a.dateStr.localeCompare(b.dateStr) || a.timeStr.localeCompare(b.timeStr)).map((a, idx) => (
                      <div key={idx} style={{ 
                        padding: '12px 14px', 
                        background: '#fff1f2', 
                        borderRadius: '12px', 
                        border: '1px solid #fda4af',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase' }}>
                            {a.dateStr}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>{a.timeStr}</div>
                        </div>
                        <button 
                          onClick={() => {
                            const d = new Date(a.dateStr);
                            if (!isNaN(d.getTime())) {
                              toggleBlockSlot(a.timeStr, d);
                            } else {
                              console.error("Invalid date for toggle:", a.dateStr);
                              alert("Cannot toggle: Invalid date format.");
                            }
                          }}
                          style={{ background: 'white', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Modal Redesign */}
        {showBookingModal && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <button onClick={() => setShowBookingModal(false)} style={closeBtnStyle}><X size={20} /></button>
              
              <div style={{ display: 'flex' }}>
                {/* Left Side: Summary */}
                <div style={{ width: '40%', background: 'var(--app-bg)', padding: '40px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <CalendarIcon size={28} color="#0ea5e9" />
                  </div>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Confirm Slot</h2>
                  <p style={{ color: '#64748b', marginTop: '12px', fontSize: '14px' }}>Review the appointment details before confirming.</p>
                  
                  <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={summaryItemStyle}>
                      <Clock size={16} color="#0ea5e9" />
                      <div>
                        <div style={summaryLabelStyle}>Time</div>
                        <div style={summaryValueStyle}>{selectedTime}</div>
                      </div>
                    </div>
                    <div style={summaryItemStyle}>
                      <CalendarIcon size={16} color="#0ea5e9" />
                      <div>
                        <div style={summaryLabelStyle}>Date</div>
                        <div style={summaryValueStyle}>{selectedDate?.toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Form */}
                <div style={{ width: '60%', padding: '40px' }}>
                  <label style={inputLabelStyle}>Select Patient</label>
                  {patients.length > 0 ? (
                    <select 
                      value={selectedPatient}
                      onChange={(e) => setSelectedPatient(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="">Select patient...</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}
                    </select>
                  ) : (
                    <div style={{ padding: '20px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#b91c1c', fontWeight: 700 }}>No patients found.</p>
                      <button 
                        onClick={() => window.location.href = '/tenant/opd/registration'}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        + REGISTER NEW PATIENT
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                    <button onClick={() => setShowBookingModal(false)} style={cancelBtnStyle}>Discard</button>
                    <button onClick={bookAppointment} style={confirmBtnStyle}>Confirm Appointment</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          .slot-btn:hover { border-color: #0ea5e9 !important; background: rgba(14, 165, 233, 0.05) !important; color: #0ea5e9 !important; }
          .loader { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-bottom-color: #0ea5e9; border-radius: 50%; animation: rotation 1s linear infinite; }
          @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </main>
    </div>
  );
}

// Styles
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

const modalOverlayStyle: any = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.4)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: '24px'
};

const modalContentStyle: any = {
  background: 'white',
  borderRadius: '40px',
  width: '100%',
  maxWidth: '900px',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 40px 80px -12px rgba(0,0,0,0.25)'
};

const closeBtnStyle: any = {
  position: 'absolute',
  right: '32px',
  top: '32px',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: '#f1f5f9',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#64748b',
  zIndex: 10
};

const summaryItemStyle: any = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '16px',
  background: 'white',
  borderRadius: '16px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const summaryLabelStyle = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em'
};

const summaryValueStyle = {
  fontSize: '15px',
  fontWeight: 800,
  color: '#1e293b',
  marginTop: '2px'
};

const inputLabelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 800,
  color: '#64748b',
  marginBottom: '10px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em'
};

const selectStyle: any = {
  width: '100%',
  padding: '18px 48px 18px 18px',
  borderRadius: '18px',
  border: '2px solid #f1f5f9',
  background: 'var(--app-bg)',
  fontSize: '16px',
  fontWeight: 700,
  color: '#1e293b',
  outline: 'none',
  appearance: 'none' as const,
  cursor: 'pointer'
};

const cancelBtnStyle = {
  flex: 1,
  padding: '20px',
  borderRadius: '20px',
  border: '2px solid #f1f5f9',
  background: 'white',
  color: '#64748b',
  fontWeight: 800,
  fontSize: '16px',
  cursor: 'pointer'
};

const confirmBtnStyle = {
  flex: 2,
  padding: '20px',
  borderRadius: '20px',
  border: 'none',
  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
  color: 'white',
  fontWeight: 800,
  fontSize: '16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  boxShadow: '0 12px 24px -6px rgba(37, 99, 235, 0.4)'
};



