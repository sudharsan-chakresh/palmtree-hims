import { useState, useEffect } from "react";
import { useMemo } from "react";
import { API_BASE_URL as API_BASE } from '../../../config/api';
import axios from "axios";
import { 
  Calendar as CalendarIcon, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Timer,
  Activity,
  Zap,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { getSlotState, parseApptTime } from "../../../utils/schedulingEngine";
import { useSearchParams } from "react-router-dom";
import { trackEvent } from "../../../utils/analytics";
import { useToast } from "../../../components/ToastProvider";


const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


export default function DoctorAvailabilityPage() {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "";
  
  // Normalize incoming tab parameter to avoid loading blank screen
  let normalizedTab = "Operational Calendar";
  if (rawTab === "Weekly Rules" || rawTab === "Weekly Schedule" || rawTab === "Weekly+Schedule") {
    normalizedTab = "Weekly Rules";
  } else if (rawTab === "Leave Master") {
    normalizedTab = "Leave Master";
  } else if (rawTab === "Overrides") {
    normalizedTab = "Overrides";
  } else if (rawTab === "Analytics") {
    normalizedTab = "Analytics";
  } else if (rawTab === "Operational Calendar" || rawTab === "Booking & Operations" || rawTab === "Booking+%26+Operations") {
    normalizedTab = "Operational Calendar";
  }

  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState<any[]>([]);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>({ utilization: 0, retention: 0, avgWait: 0, revenue: 0 });
  
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(normalizedTab);
  const [showActionDrawer, setShowActionDrawer] = useState(false);
  const [selectedSlotState, setSelectedSlotState] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, AVAILABLE, BOOKED

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const [reschedulingAppt, setReschedulingAppt] = useState<any>(null);

  const fetchInitialData = async () => {
    try {
      console.log("[DEBUG] Fetching Clinical Master Data...");
      const [docRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/doctors`, { headers })
      ]);
      console.log(`[DEBUG] Loaded ${docRes.data?.length || 0} doctors.`);
      const doctorList = docRes.data || [];
      setDoctors(doctorList);
      
      const loggedInRole = localStorage.getItem("role");
      const loggedInUserId = localStorage.getItem("userId");
      
      let firstDoctor: any = null;
      if (loggedInRole === 'doctor' || loggedInRole === 'Doctor') {
        firstDoctor = doctorList.find((d: any) => d.id === loggedInUserId) || (doctorList.length > 0 ? doctorList[0] : null);
      } else if (doctorList.length > 0) {
        firstDoctor = doctorList[0];
      }

      if (firstDoctor) {
        setSelectedDoctor(firstDoctor);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("[DEBUG] Initialization Error:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor) {
      setLoading(true);
      Promise.all([
        fetchSchedulingData(),
        fetchDoctorStats()
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [selectedDoctor, currentDate]);

  const fetchDoctorStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/doctors/${selectedDoctor.id}/stats`, { headers });
      setStats(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchSchedulingData = async () => {
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const response = await axios.get(
        `${API_BASE}/api/doctors/${selectedDoctor.id}/availability-rules?startDate=${toLocalDateKey(start)}&endDate=${toLocalDateKey(end)}`,
        { headers }
      );

      setAppointments(response.data.appointments || []);
      const scheds = response.data.schedules || [];
      setSchedules(scheds);
      setLeaves(response.data.leaves || []);
      setOverrides(response.data.overrides || []);
      setDoctorStatus(response.data.status);

      // Generate dynamic time slots based on doctor's schedule
      if (scheds.length > 0) {
        let minHour = 24;
        let maxHour = 0;
        scheds.forEach((s: any) => {
          const startH = parseInt(s.start_time.split(':')[0]);
          const endH = parseInt(s.end_time.split(':')[0]);
          if (startH < minHour) minHour = startH;
          if (endH > maxHour) maxHour = endH;
        });
        
        // Fallback if data is weird or span is 0
        if (minHour >= maxHour) { minHour = 8; maxHour = 20; }
        
        const slots = [];
        for (let h = minHour; h < maxHour; h++) {
          slots.push(`${h.toString().padStart(2, '0')}:00`);
          slots.push(`${h.toString().padStart(2, '0')}:30`);
        }
        setTimeSlots(slots);
      } else {
        // Default slots if no schedule defined yet
        const slots = [];
        for (let h = 8; h < 20; h++) {
          slots.push(`${h.toString().padStart(2, '0')}:00`);
          slots.push(`${h.toString().padStart(2, '0')}:30`);
        }
        setTimeSlots(slots);
      }
    } catch (err) { console.error(err); }
  };

  const updateDoctorStatus = async (status: string, delay: number = 0) => {
    try {
      await axios.post(`${API_BASE}/api/doctors/${selectedDoctor.id}/status`, { status, delay_minutes: delay }, { headers });
      
      // Analytics: Track status change
      trackEvent('physician_status_changed', {
        doctor_id: selectedDoctor.id,
        new_status: status,
        delay_minutes: delay,
        specialization: selectedDoctor.specialization
      });

      fetchSchedulingData();
    } catch (err) { console.error(err); }
  };



  // getWeekDates unused helper removed

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  const slotMatrix = useMemo(() => {
    // Matrix: array of rows for each time slot, each row contains array of slot states per day
    if (!timeSlots || timeSlots.length === 0 || !weekDates) return [];
    return timeSlots.map(time => {
      const row = weekDates.map(date => {
        return getSlotState({
          date: toLocalDateKey(date),
          time,
          appointments,
          leaves,
          schedules,
          overrides,
          doctorStatus
        });
      });
      return { time, row };
    });
  }, [timeSlots, weekDates, appointments, leaves, schedules, overrides, doctorStatus]);

  if (loading) return <div className="loading-state">Initializing Clinical Engine...</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 24px' }}>
        <Header title="Clinical Scheduling Command" />

        {reschedulingAppt && (
          <div style={{ 
            background: 'rgba(79, 70, 229, 0.1)', 
            border: '1.5px dashed #4f46e5', 
            borderRadius: '16px', 
            padding: '16px 24px', 
            margin: '16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'pulse 2s infinite'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4f46e5', color: 'white', display: 'grid', placeItems: 'center' }}>
                <Activity size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#4f46e5' }}>RESCHEDULING MODE ACTIVE</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Moving <strong>{reschedulingAppt.patient_name}</strong>. Select a new available slot in the calendar.</div>
              </div>
            </div>
            <button 
              onClick={() => setReschedulingAppt(null)}
              style={{ padding: '8px 16px', borderRadius: '10px', background: 'white', border: '1px solid #4f46e5', color: '#4f46e5', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              Cancel Move
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', margin: '16px 0 4px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eef2ff', color: '#4f46e5', display: 'grid', placeItems: 'center', boxShadow: '0 8px 12px -3px rgba(79, 70, 233, 0.1)' }}>
            <CalendarIcon size={20} />
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 500, maxWidth: '600px' }}>Unified command center for physician availability, appointment scheduling, and clinical resource optimization.</p>
        </div>
        
        <div className="avail-layout" style={{ flex: 1, display: 'flex', padding: '16px 8px', gap: '20px', overflow: 'hidden' }}>
          
          {/* LEFT: DOCTOR INFO & QUICK ACTIONS */}
          <div className="avail-left-panel" style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: 'none', color: 'white' }}>
               <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>ACTIVE CONTEXT</div>
               <div style={{ fontSize: '14px', fontWeight: 900 }}>{localStorage.getItem("tenantName") || 'Palmtree Wellness Hospital'}</div>
               <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px', opacity: 0.8 }}>ID: {localStorage.getItem("tenant")?.substring(0, 8)}...</div>
            </div>

            <div style={cardStyle}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={avatarStyle}><User size={24} /></div>
                   <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, marginBottom: '4px', color: '#4f46e5' }}>SELECTED DOCTOR</label>
                      {localStorage.getItem("role") === 'doctor' || localStorage.getItem("role") === 'Doctor' ? (
                        <div style={{ ...doctorSelectStyle, padding: '8px', background: '#f1f5f9', borderRadius: '8px', color: '#0f172a', fontWeight: 800 }}>
                          {selectedDoctor?.name || 'Loading...'}
                        </div>
                      ) : (
                        doctors.length > 0 ? (
                          <select 
                            value={selectedDoctor?.id || ""} 
                            onChange={(e) => setSelectedDoctor(doctors.find(d => d.id === e.target.value))}
                            style={{ ...doctorSelectStyle, border: '1px solid #e2e8f0', padding: '8px', borderRadius: '8px', background: 'var(--app-bg)', color: '#1e293b', fontWeight: 800 }}
                          >
                             <option value="" disabled>Select a doctor...</option>
                             {doctors.map(d => <option key={d.id} value={d.id}>{d.name.toLowerCase().startsWith('dr') ? d.name : `Dr. ${d.name}`}</option>)}
                          </select>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#be123c', fontWeight: 700 }}>No Doctors Loaded</div>
                        )
                      )}
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>{selectedDoctor?.specialization || 'Clinical Staff'}</div>
                   </div>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <StatusBadge status={doctorStatus?.status} delay={doctorStatus?.delay_minutes} />
                  <div style={dividerStyle} />
                  <h4 style={sectionTitleStyle}>PHYSICIAN STATUS CONTROL</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                     <button onClick={() => updateDoctorStatus('AVAILABLE', 0)} style={quickBtnStyle('#10b981')}><CheckCircle2 size={14} /> Available</button>
                     <button onClick={() => updateDoctorStatus('DELAYED', 15)} style={quickBtnStyle('#f59e0b')}><Timer size={14} /> +15m Delay</button>
                     <button onClick={() => updateDoctorStatus('DELAYED', 30)} style={quickBtnStyle('#ea580c')}><Timer size={14} /> +30m Delay</button>
                     <button onClick={() => updateDoctorStatus('EMERGENCY', 0)} style={quickBtnStyle('#e11d48')}><ShieldAlert size={14} /> Emergency</button>
                  </div>
               </div>
            </div>

            <div style={cardStyle}>
               <h4 style={sectionTitleStyle}>QUICK SUMMARY</h4>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <SummaryItem label="Appointments Today" value={appointments.filter(a => parseApptTime(a.appointment_time).dateStr === toLocalDateKey(new Date())).length} icon={<CalendarIcon size={16}/>} />
                  <SummaryItem label="Active Leaves" value={leaves.filter(l => new Date(l.end_date) >= new Date()).length} icon={<ShieldAlert size={16}/>} />
               </div>
               
               <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                  <button 
                    onClick={async () => {
                      if(confirm("Trigger DEEP synchronization for this clinic? This will restore any 'vanished' doctors or patients.")) {
                        try {
                          setLoading(true);
                          await axios.get(`${API_BASE}/api/hospital/heal-all-masters`, { headers });
                          alert("Deep Data Healing complete. Clinical masters restored.");
                          window.location.reload();
                        } catch(e) { alert("Healing failed. Check network."); }
                        finally { setLoading(false); }
                      }
                    }}
                    style={{ ...quickBtnStyle('#6366f1'), width: '100%', borderStyle: 'dashed', marginBottom: '8px' }}
                  >
                    <Activity size={14} /> Heal Clinical Master Data
                  </button>

                  <button 
                    onClick={() => { setLoading(true); fetchSchedulingData(); setTimeout(() => setLoading(false), 500); }}
                    style={{ ...quickBtnStyle('#64748b'), width: '100%' }}
                  >
                    <Zap size={14} /> Force UI Reload
                  </button>
               </div>
            </div>
          </div>

          {/* RIGHT: MAIN CALENDAR / TABS */}
          <div className="avail-right-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', minWidth: 0 }}>
             <div className="avail-tab-bar" style={{ ...cardStyle, padding: '8px 16px', display: 'flex', gap: '24px', marginBottom: '-4px', overflowX: 'auto' }}>
                {['Operational Calendar', 'Weekly Rules', 'Leave Master', 'Overrides', 'Analytics'].map(tab => (
                   <button 
                     key={tab} 
                     onClick={() => setActiveTab(tab)}
                     style={{ ...tabBtnStyle(activeTab === tab), whiteSpace: 'nowrap' }}
                   >
                      {tab}
                   </button>
                ))}
             </div>

             <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'Operational Calendar' && (
                    <div style={{ ...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                       <div style={{ padding: '16px 24px 0', display: 'flex', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
                          <LegendItem color="#dcfce7" border="1.5px solid #10b981" label="Available" />
                          <LegendItem color="#3b82f6" label="Booked" />
                          <LegendItem color="#7e22ce" label="Delayed Appointment" />
                          <LegendItem color="#d97706" label="Delayed Avail" />
                          <LegendItem color="#be123c" label="Emergency" />
                          <LegendItem color="#94a3b8" label="Leave" />
                          <LegendItem color="#f8fafc" label="Unavailable" border="1px solid #e2e8f0" />
                       </div>
                       <div style={calendarHeaderStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} style={navBtnStyle}><ChevronLeft size={16} /></button>
                             <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                             <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} style={navBtnStyle}><ChevronRight size={16} /></button>
                          </div>
                          
                          {/* Search & Filter Bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end' }}>
                             <div style={{ position: 'relative', width: '280px' }}>
                                <input 
                                  type="text" 
                                  placeholder="Search Appointment (Name/MRN)..." 
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  style={{ ...inputStyle, padding: '10px 40px 10px 36px', fontSize: '12px', borderRadius: '10px' }} 
                                />
                                <User size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                {searchQuery && (
                                  <button 
                                    onClick={() => setSearchQuery("")}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                             </div>
                             <select 
                               value={filterStatus}
                               onChange={(e) => setFilterStatus(e.target.value)}
                               style={{ ...inputStyle, width: '140px', padding: '10px', fontSize: '12px', borderRadius: '10px' }}
                             >
                                <option value="ALL">All Slots</option>
                                <option value="AVAILABLE">Available Only</option>
                                <option value="BOOKED">Booked Only</option>
                             </select>
                          </div>
                       </div>

                      <div className="calendar-scroll-container" style={gridScrollStyle}>
                         <div style={calendarGridStyle}>
                            <div style={{ padding: '20px', borderRight: '1px solid #f1f5f9', background: '#fcfdfe' }}></div>
                             {weekDates.map((date, i) => {
                               const isToday = date.toDateString() === new Date().toDateString();
                               const isPastDay = date < new Date(new Date().setHours(0,0,0,0));
                               return (
                                 <div key={i} style={{
                                   ...dayHeaderStyle(isToday),
                                   opacity: isPastDay ? 0.5 : 1,
                                   filter: isPastDay ? 'grayscale(1)' : 'none'
                                 }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: isToday ? '#4f46e5' : '#94a3b8' }}>
                                       {isToday ? 'TODAY' : ['SUN','MON','TUE','WED','THU','FRI','SAT'][date.getDay()]}
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: 900, color: isToday ? '#4f46e5' : '#1e293b' }}>{date.getDate()}</div>
                                 </div>
                               );
                             })}

                             {slotMatrix.map((slotRow, idx) => (
                               <div key={idx} style={{ display: 'contents' }}>
                                 <div style={timeLabelStyle}>{slotRow.time}</div>
                                 {slotRow.row.map((state, dayIdx) => {
                                   const date = weekDates[dayIdx];

                                     // Apply Filters
                                     const matchesSearch = searchQuery && state.appointment?.patient_name?.toLowerCase().includes(searchQuery.toLowerCase());
                                     const matchesStatus = filterStatus === 'ALL' || 
                                                          (filterStatus === 'AVAILABLE' && (state.status === 'AVAILABLE' || state.status === 'DELAYED_AVAIL')) ||
                                                          (filterStatus === 'BOOKED' && state.status === 'BOOKED');

                                     return (
                                        <div key={`${idx}-${dayIdx}`} style={{ 
                                           ...slotCellWrapperStyle, 
                                           opacity: (searchQuery && !matchesSearch) || !matchesStatus ? 0.3 : 1,
                                           filter: (searchQuery && !matchesSearch) || !matchesStatus ? 'grayscale(0.5)' : 'none'
                                        }}>
                                             <div 
                                               className="appointment-slot"
                                               onClick={() => {
                                                 if (state.status === 'AVAILABLE' || state.status === 'DELAYED_AVAIL') {
                                                   const dateStr = toLocalDateKey(date);
                                                   window.location.href = `/tenant/appointments/book?doctorId=${selectedDoctor.id}&date=${dateStr}&time=${slotRow.time}`;
                                                 } else {
                                                   setSelectedDate(date);
                                                   setSelectedTime(slotRow.time);
                                                   setSelectedSlotState(state);
                                                   setShowActionDrawer(true);
                                                 }
                                               }}
                                               title={state.appointment ? `Patient: ${state.appointment.patient_name}\nMRN: ${state.appointment.patient_mrn || 'N/A'}` : state.label}
                                               style={{ 
                                                 ...slotInnerStyle(state),
                                                 border: matchesSearch ? '2px solid #f97316' : slotInnerStyle(state).border,
                                                 boxShadow: matchesSearch ? '0 0 12px rgba(249, 115, 22, 0.4)' : slotInnerStyle(state).boxShadow,
                                                 animation: matchesSearch ? 'pulse 1.5s infinite' : slotInnerStyle(state).animation,
                                                 position: 'relative'
                                               }}
                                             >
                                                {state.status === 'BOOKED' ? (
                                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }} className="slot-content">
                                                    <User size={12} />
                                                    <div className="custom-tooltip">
                                                      <div style={{ fontWeight: 800 }}>{state.appointment.patient_name}</div>
                                                      <div style={{ color: '#cbd5e1', fontSize: '9px' }}>MRN: {state.appointment.patient_mrn || 'N/A'}</div>
                                                    </div>
                                                    {matchesSearch && (
                                                      <div style={{ 
                                                        position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
                                                        background: '#0f172a', color: 'white', padding: '4px 8px', borderRadius: '4px',
                                                        fontSize: '10px', whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none'
                                                      }}>
                                                        {state.appointment.patient_name}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : state.label === 'AVAILABLE' ? <Plus size={12} /> : ''}
                                             </div>
                                        </div>
                                     );
                                  })}
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 'Weekly Rules' && <WeeklyScheduleTab doctor={selectedDoctor} schedules={schedules} onUpdate={fetchSchedulingData} />}
                {activeTab === 'Leave Master' && <LeaveTab doctor={selectedDoctor} leaves={leaves} onUpdate={fetchSchedulingData} />}
                {activeTab === 'Overrides' && <OverridesTab doctor={selectedDoctor} overrides={overrides} onUpdate={fetchSchedulingData} />}
                {activeTab === 'Analytics' && <AnalyticsPanel stats={stats} />}
             </div>
          </div>
        </div>

        <SlotActionDrawer 
          open={showActionDrawer} 
          onClose={() => setShowActionDrawer(false)}
          date={selectedDate}
          time={selectedTime}
          state={selectedSlotState}
          doctor={selectedDoctor}
          onSuccess={fetchSchedulingData}
          reschedulingAppt={reschedulingAppt}
          setReschedulingAppt={setReschedulingAppt}
        />
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const StatusBadge = ({ status, delay }: any) => {
  const isDelayed = status === 'DELAYED';
  const isEmergency = status === 'EMERGENCY';
  return (
    <div style={{
      padding: '12px',
      borderRadius: '12px',
      background: isEmergency ? '#fff1f2' : isDelayed ? '#fff7ed' : '#f0fdf4',
      border: `1px solid ${isEmergency ? '#fecaca' : isDelayed ? '#ffedd5' : '#dcfce7'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: isEmergency ? '#be123c' : isDelayed ? '#d97706' : '#059669',
        boxShadow: `0 0 10px ${isEmergency ? '#be123c' : isDelayed ? '#d97706' : '#059669'}`
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>LIVE STATUS</div>
        <div style={{ fontSize: '14px', fontWeight: 900, color: isEmergency ? '#be123c' : isDelayed ? '#d97706' : '#065f46' }}>
          {isEmergency ? 'EMERGENCY MODE' : isDelayed ? `DELAYED (${delay}m)` : 'ON SCHEDULE'}
        </div>
      </div>
    </div>
  );
};

const SlotActionDrawer = ({ open, onClose, date, time, state, doctor, onSuccess, reschedulingAppt, setReschedulingAppt }: any) => {

  // const [patientId, setPatientId] = useState("");
  // const [patientSearch, setPatientSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  // const [localPatients, setLocalPatients] = useState<any[]>([]);
  // const [isSearching, setIsSearching] = useState(false);

  /*
  useEffect(() => {
    if (patientSearch.length > 1) {
      const delayDebounceFn = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await axios.get(`${API_BASE}/api/patients?q=${patientSearch}`, { 
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" } 
          });
          setLocalPatients(res.data || []);
        } catch (e) { console.error(e); }
        finally { setIsSearching(false); }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setLocalPatients([]);
    }
  }, [patientSearch]);

  const filteredPatients = localPatients;
  */

  const createSlotOverride = async (available: boolean) => {
    // Calculate end time (30 mins duration for a single slot override)
    const [h, m] = time.split(':').map(Number);
    const endM = (m + 30) % 60;
    const endH = h + Math.floor((m + 30) / 60);
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    await axios.post(`${API_BASE}/api/doctors/overrides`, {
      doctor_id: doctor.id, 
      override_date: toLocalDateKey(date), 
      start_time: time, 
      end_time: endTime,
      is_available: available, 
      reason: reason || (available ? 'Manual Opening' : 'Manual Block')
    }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" } });
  };

  /*
  const handleBook = async () => {
    if (!patientId) return alert("Select patient");
    if (state.isPast) return alert("Historical slots cannot be booked.");
    setLoading(true);
    try {
      const dateStr = toLocalDateKey(date);
      const dt = new Date(`${dateStr} ${time}`);

      if (!state.isBookable) {
        if (state.status !== 'UNAVAILABLE') {
          return alert("This slot cannot be booked. Please choose an available slot.");
        }
        await createSlotOverride(true);
      }

      await axios.post(`${API_BASE}/api/appointments`, {
        patient_id: patientId, doctor_id: doctor.id, appointment_time: `${dateStr}T${time}:00`, status: 'Scheduled'
      }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" } });

      trackEvent('appointment_booked', {
        doctor_id: doctor.id,
        patient_id: patientId,
        slot_time: time,
        is_off_hours: state.status === 'UNAVAILABLE'
      });

      showToast("Appointment booked successfully!", "success");
      onSuccess(); 
      onClose();
    } catch (err: any) { 
      console.error(err); 
      showToast(err.response?.data?.error || "Appointment booking failed. Please try again.", "error");
    } finally { setLoading(false); }
  };
  */

  const handleReschedule = async () => {
    if (!reschedulingAppt) return;
    setLoading(true);
    try {
      const dateStr = toLocalDateKey(date);
      const appointmentTimeStr = `${dateStr}T${time}:00`;

      await axios.patch(`${API_BASE}/api/appointments/${reschedulingAppt.id}`, {
        appointment_time: appointmentTimeStr
      }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" } });

      trackEvent('appointment_rescheduled', {
        doctor_id: doctor.id,
        appointment_id: reschedulingAppt.id
      });

      setReschedulingAppt(null);
      onSuccess(); 
      onClose();
    } catch (err) { 
      console.error(err); 
      alert("Rescheduling failed. Slot might be taken.");
    } finally { setLoading(false); }
  };

  const applyOverride = async (available: boolean) => {
    setLoading(true);
    try {
      await createSlotOverride(available);
      onSuccess(); onClose();
    } catch (err: any) { 
      console.error(err); 
      alert(err.response?.data?.error || "Failed to update slot availability.");
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!state.appointment?.id) return;
    if (!confirm(`Cancel appointment for ${state.appointment.patient_name}?`)) return;
    
    setLoading(true);
    const authHeaders = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" };
    try {
      await axios.delete(`${API_BASE}/api/appointments/${state.appointment.id}`, { headers: authHeaders });
      
      trackEvent('appointment_cancelled', {
        doctor_id: doctor.id,
        appointment_id: state.appointment.id
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to cancel appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // const canQuickBook = !!patientId && !loading && (state.isBookable || (state.status === 'UNAVAILABLE' && !state.isPast));

  return (
    <div style={drawerOverlayStyle}>
       <div style={drawerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
             <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>Slot Actions</h2>
             <button onClick={onClose} style={closeBtnStyle}><X size={24} /></button>
          </div>

          <div style={{ background: 'var(--app-bg)', padding: '20px', borderRadius: '16px', marginBottom: '32px' }}>
             <div style={{ fontSize: '13px', fontWeight: 800, color: '#94a3b8' }}>{state.status}</div>
             <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{date?.toLocaleDateString()} @ {time}</div>
          </div>

          {state.status === 'BOOKED' ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={cardStyle}>
                   <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>PATIENT DETAILS</div>
                   <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px' }}>{state.appointment?.patient_name}</div>
                   <div style={{ fontSize: '13px', color: '#64748b' }}>MRN: {state.appointment?.patient_mrn || 'N/A'}</div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => { setReschedulingAppt(state.appointment); onClose(); }}
                    style={{ ...primaryBtnStyle, background: '#6366f1', flex: 1 }}
                  >
                    Move Appointment
                  </button>
                  <button 
                    onClick={handleCancel}
                    disabled={loading}
                    style={{ ...primaryBtnStyle, background: '#ef4444', flex: 1 }}
                  >
                    {loading ? '...' : 'Delete'}
                  </button>
                </div>
             </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                 <div>
                    <label style={labelStyle}>{reschedulingAppt ? 'RESCHEDULE TO THIS SLOT' : 'SCHEDULING ACTIONS'}</label>
                    {reschedulingAppt ? (
                      <div style={{ padding: '20px', background: '#eef2ff', borderRadius: '16px', border: '1px solid #4f46e5' }}>
                        <div style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 700 }}>RESCHEDULING:</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px' }}>{reschedulingAppt.patient_name}</div>
                        <button 
                          onClick={handleReschedule} 
                          disabled={loading || !state.isBookable} 
                          style={{ ...primaryBtnStyle, marginTop: '16px', width: '100%', background: '#4f46e5' }}
                        >
                           {loading ? 'Moving...' : 'Confirm Move to this Slot'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button 
                          onClick={() => {
                            const dateStr = toLocalDateKey(date);
                            window.location.href = `/tenant/appointments/book?doctorId=${doctor.id}&date=${dateStr}&time=${time}`;
                          }}
                          style={{
                            ...primaryBtnStyle,
                            width: '100%',
                            background: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            padding: '14px 20px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          Book Appointment
                        </button>
                      </div>
                    )}
                    {!state.isBookable && !reschedulingAppt && (
                      <div style={{ fontSize: '11px', color: '#e11d48', marginTop: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12}/> 
                        {state.isPast ? 'Historical slots cannot be modified.' : 'This slot is currently outside regular hours.'}
                      </div>
                    )}
                 </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                   <label style={labelStyle}>EDIT AVAILABILITY (OVERRIDE)</label>
                   <input type="text" placeholder="Reason (Optional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
                   <div style={{ display: 'flex', gap: '12px' }}>
                      {state.status === 'AVAILABLE' || state.status === 'DELAYED_AVAIL' ? (
                         <button onClick={() => applyOverride(false)} disabled={loading} style={{ ...quickBtnStyle('#e11d48'), flex: 1, padding: '14px' }}>Block Slot</button>
                      ) : (
                         <button onClick={() => applyOverride(true)} disabled={loading} style={{ ...quickBtnStyle('#10b981'), flex: 1, padding: '14px' }}>Open Slot</button>
                      )}
                   </div>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

// --- STYLES ---

const cardStyle: any = { background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #eef2f6' };
const avatarStyle = { width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' };
const doctorSelectStyle = { width: '100%', fontSize: '16px', fontWeight: 800, border: 'none', background: 'none', outline: 'none', cursor: 'pointer', color: '#1e293b' };
const dividerStyle = { height: '1px', background: '#f1f5f9', margin: '8px 0' };
const sectionTitleStyle = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 12px 0' };
const quickBtnStyle = (color: string) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: `1px solid ${color}30`, background: `${color}05`, color, fontSize: '11px', fontWeight: 800, cursor: 'pointer' });
const tabBtnStyle = (active: boolean) => ({ padding: '12px 0', border: 'none', background: 'none', fontSize: '14px', fontWeight: 700, color: active ? '#4f46e5' : '#64748b', borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' });
const calendarHeaderStyle = { padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const dayHeaderStyle = (isToday: boolean) => ({ 
  padding: '16px 8px', 
  textAlign: 'center' as const, 
  borderRight: '1px solid #f1f5f9', 
  borderBottom: isToday ? '3px solid #4f46e5' : '2px solid #f1f5f9', 
  background: isToday ? '#eef2ff' : 'white',
  position: 'relative' as const
});
const timeLabelStyle = { padding: '12px 8px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 700, color: '#94a3b8', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f8fafc' };

const slotCellWrapperStyle = { padding: '4px', borderRight: '1px solid #f8fafc', borderBottom: '1px solid #f8fafc' };
const slotInnerStyle = (state: any) => {
  const isAvailable = state.status === 'AVAILABLE';
  const isUnavailable = state.status === 'UNAVAILABLE';
  const isBookableFuture = state.isBookable && !state.isPast;
  
  return {
    height: '36px', 
    borderRadius: '10px', 
    background: state.color, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    cursor: state.isPast ? 'not-allowed' : 'pointer', 
    transition: 'all 0.2s', 
    color: isAvailable ? '#166534' : (isUnavailable ? '#64748b' : 'white'),
    opacity: state.isPast ? 0.4 : 1,
    boxShadow: (state.status === 'BOOKED' && !state.isPast) ? '0 6px 16px rgba(59, 130, 246, 0.3)' : 'none',
    transform: 'scale(1)',
    filter: state.isPast ? 'grayscale(0.8) contrast(0.8)' : 'none',
    pointerEvents: state.isPast ? 'none' as const : 'auto' as const,
    border: state.isCurrent ? '2px solid #4f46e5' : (
      isAvailable && isBookableFuture ? '1.5px solid #10b981' : 
      (isUnavailable ? '1px solid #e2e8f0' : 'none')
    ),
    animation: state.isCurrent ? 'pulse 2s infinite' : 'none'
  };
};

const SummaryItem = ({ label, value, icon }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
     <div style={{ color: '#94a3b8' }}>{icon}</div>
     <div style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: '#64748b' }}>{label}</div>
     <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>{value}</div>
  </div>
);

const navBtnStyle = { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const gridScrollStyle = { 
  flex: 1, 
  overflowY: 'auto' as const,
  maxHeight: 'calc(100vh - 350px)',
  scrollbarWidth: 'thin' as const,
  scrollbarColor: '#e2e8f0 transparent'
};
const calendarGridStyle = { display: 'grid', gridTemplateColumns: '100px repeat(7, 1fr)', background: 'white', alignContent: 'start' };
const drawerOverlayStyle: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', justifyContent: 'flex-end' };
const drawerStyle: any = { width: '450px', height: '100%', background: 'white', padding: '40px', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' };
const closeBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', fontWeight: 600 };
const primaryBtnStyle: any = { padding: '16px', borderRadius: '16px', background: '#4f46e5', color: 'white', border: 'none', fontSize: '16px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' };

// --- TAB PANELS ---

const WeeklyScheduleTab = ({ doctor, schedules, onUpdate }: any) => {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [showAdd, setShowAdd] = useState(false);
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);
  const [newSched, setNewSched] = useState({
    weekday: 1, session_name: 'Morning OPD', start_time: '09:00', end_time: '13:00', slot_duration: 30, consultation_type: 'OPD', is_active: true
  });

  const handleAddOrUpdate = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" };
      if (editingSchedId) {
        await axios.put(`${API_BASE}/api/doctors/schedules/${editingSchedId}`, { ...newSched, doctor_id: doctor.id }, { headers });
      } else {
        await axios.post(`${API_BASE}/api/doctors/schedules`, { ...newSched, doctor_id: doctor.id }, { headers });
      }
      setShowAdd(false);
      setEditingSchedId(null);
      setNewSched({ weekday: 1, session_name: 'Morning OPD', start_time: '09:00', end_time: '13:00', slot_duration: 30, consultation_type: 'OPD', is_active: true });
      onUpdate();
    } catch (err) { console.error(err); }
  };

  const handleEditClick = (s: any) => {
    setNewSched({
      weekday: s.weekday,
      session_name: s.session_name,
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration: s.slot_duration || 30,
      consultation_type: s.consultation_type || 'OPD',
      is_active: s.is_active ?? true
    });
    setEditingSchedId(s.id);
    setShowAdd(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recurring schedule session?")) return;
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" };
      await axios.delete(`${API_BASE}/api/doctors/schedules/${id}`, { headers });
      onUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <div style={cardStyle}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>Doctor Recurring Schedule</h3>
          <button 
            onClick={() => { 
              setEditingSchedId(null); 
              setNewSched({ weekday: 1, session_name: 'Morning OPD', start_time: '09:00', end_time: '13:00', slot_duration: 30, consultation_type: 'OPD', is_active: true });
              setShowAdd(true); 
            }} 
            style={quickBtnStyle('#0ea5e9')}
          >
            <Plus size={16} /> Add Session
          </button>
       </div>

       <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
             <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #f8fafc' }}>
                   <th style={thStyle}>Day</th>
                   <th style={thStyle}>Session</th>
                   <th style={thStyle}>Hours</th>
                   <th style={thStyle}>Type</th>
                   <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
             </thead>
             <tbody>
                {schedules.map((s: any) => (
                   <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={tdStyle}>{weekdays[s.weekday]}</td>
                      <td style={tdStyle}>{s.session_name}</td>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{s.start_time} - {s.end_time}</td>
                      <td style={tdStyle}><span style={badgeStyle}>{s.consultation_type}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                           <button 
                             onClick={() => handleEditClick(s)} 
                             style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #3b82f6', background: '#3b82f60d', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                           >
                             Edit
                           </button>
                           <button 
                             onClick={() => handleDeleteClick(s.id)} 
                             style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ef4444', background: '#ef44440d', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                           >
                             Delete
                           </button>
                        </div>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>

       {showAdd && (
          <div style={inlineFormStyle}>
             <h4 style={{ marginTop: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
               {editingSchedId ? 'Edit Timing Window' : 'Define Timing Window'}
             </h4>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Day of Week</label>
                  <select value={newSched.weekday} onChange={(e) => setNewSched({ ...newSched, weekday: parseInt(e.target.value) })} style={inputStyle}>
                     {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Session Name</label>
                  <input type="text" placeholder="Session Name" value={newSched.session_name} onChange={(e) => setNewSched({ ...newSched, session_name: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hours</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                     <input type="time" value={newSched.start_time} onChange={(e) => setNewSched({ ...newSched, start_time: e.target.value })} style={inputStyle} />
                     <input type="time" value={newSched.end_time} onChange={(e) => setNewSched({ ...newSched, end_time: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Slot Duration (Mins)</label>
                  <select value={newSched.slot_duration} onChange={(e) => setNewSched({ ...newSched, slot_duration: parseInt(e.target.value) })} style={inputStyle}>
                     <option value={15}>15 Mins</option>
                     <option value={30}>30 Mins</option>
                     <option value={45}>45 Mins</option>
                     <option value={60}>60 Mins</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Consultation Type</label>
                  <select value={newSched.consultation_type} onChange={(e) => setNewSched({ ...newSched, consultation_type: e.target.value })} style={inputStyle}>
                     <option value="OPD">OPD</option>
                     <option value="IPD">IPD</option>
                     <option value="Emergency">Emergency</option>
                     <option value="Teleconsultation">Teleconsultation</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={newSched.is_active ? "true" : "false"} onChange={(e) => setNewSched({ ...newSched, is_active: e.target.value === "true" })} style={inputStyle}>
                     <option value="true">Active</option>
                     <option value="false">Inactive</option>
                  </select>
                </div>
             </div>
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => { 
                    setShowAdd(false); 
                    setEditingSchedId(null); 
                    setNewSched({ weekday: 1, session_name: 'Morning OPD', start_time: '09:00', end_time: '13:00', slot_duration: 30, consultation_type: 'OPD', is_active: true }); 
                  }} 
                  style={{ ...quickBtnStyle('#64748b'), padding: '12px 20px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button onClick={handleAddOrUpdate} style={{ ...primaryBtnStyle, padding: '12px 24px', fontSize: '14px', borderRadius: '10px' }}>
                  {editingSchedId ? 'Update Session' : 'Save Window'}
                </button>
             </div>
          </div>
       )}
    </div>
  );
};

const LeaveTab = ({ doctor, leaves, onUpdate }: any) => {
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
  const { showToast } = useToast();

  const handleAdd = async () => {
    if (!newLeave.start_date || !newLeave.end_date) {
      showToast("Please select both start and end dates.", "info");
      return;
    }
    try {
      const payload = {
        ...newLeave,
        doctor_id: doctor.id,
        start_time: isPartialDay ? newLeave.start_time : null,
        end_time: isPartialDay ? newLeave.end_time : null,
      };
      await axios.post(`${API_BASE}/api/doctors/leaves`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" }
      });
      showToast("Leave recorded successfully!", "success");
      setShowAdd(false);
      setIsPartialDay(false);
      onUpdate();
    } catch (err) { 
      console.error(err); 
      showToast("Failed to record leave.", "error");
    }
  };

  return (
    <div style={cardStyle}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>Leave & Blocked Dates</h3>
          <button onClick={() => setShowAdd(true)} style={quickBtnStyle('#ef4444')}><Plus size={16} /> Record Leave</button>
       </div>
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {leaves.map((l: any) => (
             <div key={l.id} style={leaveCardStyle(l.is_emergency)}>
                <div style={{ fontWeight: 900 }}>
                  {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                  {l.start_time && l.end_time ? ` (${l.start_time} - ${l.end_time})` : ' (Full Day)'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{l.leave_type}: {l.reason}</div>
             </div>
          ))}
       </div>

       {showAdd && (
          <div style={{ ...inlineFormStyle, background: '#fef2f2' }}>
             <h4 style={{ marginTop: 0 }}>Block Availability</h4>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <input type="date" value={newLeave.start_date} onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })} style={inputStyle} />
                <input type="date" value={newLeave.end_date} onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })} style={inputStyle} />
                
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                  <input 
                    type="checkbox" 
                    id="partial_day_checkbox" 
                    checked={isPartialDay} 
                    onChange={(e) => setIsPartialDay(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="partial_day_checkbox" style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                    Partial Day Leave (Block Specific Hours)
                  </label>
                </div>

                {isPartialDay && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>Start Time</label>
                      <input type="time" value={newLeave.start_time} onChange={(e) => setNewLeave({ ...newLeave, start_time: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>End Time</label>
                      <input type="time" value={newLeave.end_time} onChange={(e) => setNewLeave({ ...newLeave, end_time: e.target.value })} style={inputStyle} />
                    </div>
                  </>
                )}

                <textarea placeholder="Reason..." value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} style={{ ...inputStyle, gridColumn: 'span 2' }} />
                <button onClick={handleAdd} style={{ ...primaryBtnStyle, background: '#ef4444' }}>Mark Unavailable</button>
             </div>
          </div>
       )}
    </div>
  );
};

const OverridesTab = ({ doctor, overrides, onUpdate }: any) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newOverride, setNewOverride] = useState({ override_date: '', start_time: '08:00', end_time: '12:00', is_available: true, reason: 'Consultant Visit' });

  const handleAdd = async () => {
    try {
      await axios.post(`${API_BASE}/api/doctors/overrides`, { ...newOverride, doctor_id: doctor.id }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-tenant-id": localStorage.getItem("tenant") || "" }
      });
      setShowAdd(false);
      onUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <div style={cardStyle}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>Specific Session Overrides</h3>
          <button onClick={() => setShowAdd(true)} style={quickBtnStyle('#f97316')}><Plus size={16} /> Add Exception</button>
       </div>
       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {overrides.map((o: any) => (
             <div key={o.id} style={overrideCardStyle(o.is_available)}>
                <div style={{ fontWeight: 800 }}>{new Date(o.override_date).toLocaleDateString()} | {o.start_time} - {o.end_time}</div>
                <div style={{ fontSize: '13px' }}>{o.is_available ? 'Extra Session' : 'Blocked Session'}: {o.reason}</div>
             </div>
          ))}
       </div>

       {showAdd && (
          <div style={{ ...inlineFormStyle, background: '#fff7ed' }}>
             <h4 style={{ marginTop: 0 }}>Add Exception</h4>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <input type="date" value={newOverride.override_date} onChange={(e) => setNewOverride({ ...newOverride, override_date: e.target.value })} style={inputStyle} />
                <div style={{ display: 'flex', gap: '8px' }}>
                   <input type="time" value={newOverride.start_time} onChange={(e) => setNewOverride({ ...newOverride, start_time: e.target.value })} style={inputStyle} />
                   <input type="time" value={newOverride.end_time} onChange={(e) => setNewOverride({ ...newOverride, end_time: e.target.value })} style={inputStyle} />
                </div>
                <button onClick={handleAdd} style={{ ...primaryBtnStyle, background: '#f97316', gridColumn: 'span 2' }}>Apply Exception</button>
             </div>
          </div>
       )}
    </div>
  );
};

const AnalyticsPanel = ({ stats }: any) => {
  const revenue = stats.business?.revenue || 0;
  const patientsSeen = stats.patientsSeen || 0;
  const repeatPatients = stats.repeatPatients || 0;
  const retention = patientsSeen > 0 ? (repeatPatients / patientsSeen) * 100 : 0;
  
  const utilization = stats.utilization || 0;
  const avgWait = stats.avgWait || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
      {[
        { label: 'Utilization', value: `${Math.round(utilization)}%`, color: '#0ea5e9', icon: <Zap size={20} /> },
        { label: 'Patient Retention', value: `${Math.round(retention)}%`, color: '#10b981', icon: <Activity size={20} /> },
        { label: 'Average Wait', value: `${Math.round(avgWait)}m`, color: '#f59e0b', icon: <Timer size={20} /> },
        { label: 'Revenue', value: `₹${(revenue / 100000).toFixed(1)}L`, color: '#8b5cf6', icon: <TrendingUp size={20} /> }
      ].map(s => (
        <div key={s.label} style={cardStyle}>
          <div style={{ color: s.color, marginBottom: '12px' }}>{s.icon}</div>
          <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          <div style={{ fontSize: '24px', fontWeight: 900, marginTop: '4px', color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
};

const LegendItem = ({ color, label, border }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: color, border }} />
    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{label}</span>
  </div>
);

const thStyle = { padding: '16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' as const };
const tdStyle = { padding: '16px', fontSize: '14px', color: '#1e293b' };
const badgeStyle = { padding: '4px 8px', borderRadius: '6px', background: '#f1f5f9', fontSize: '11px', fontWeight: 800, color: '#64748b' };
const inlineFormStyle: any = { marginTop: '24px', padding: '24px', background: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #eef2f6' };
const leaveCardStyle = (emergency: boolean) => ({ padding: '16px', borderRadius: '16px', background: emergency ? '#fff1f2' : '#f8fafc', border: `1px solid ${emergency ? '#fecaca' : '#eef2f6'}` });
const overrideCardStyle = (avail: boolean) => ({ padding: '16px', borderRadius: '12px', background: avail ? '#f0fdf4' : '#fff7ed', border: `1px solid ${avail ? '#dcfce7' : '#ffedd5'}`, color: avail ? '#166534' : '#9a3412' });
