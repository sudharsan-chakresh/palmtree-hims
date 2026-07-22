import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Calendar, Clock, User, Plus, Users } from "lucide-react";

const formatApptDateTime = (apptTimeStr: string) => {
  if (!apptTimeStr) return { month: '---', date: '--', time: '--:--' };
  try {
    const str = typeof apptTimeStr === 'string' ? apptTimeStr : new Date(apptTimeStr).toISOString();
    const parts = str.split('T');
    if (parts.length >= 2) {
      const datePart = parts[0];
      const timePart = parts[1].substring(0, 5); // "10:00"
      
      const [y, mo, d] = datePart.split('-').map(Number);
      const tempDate = new Date(y, mo - 1, d);
      const monthShort = tempDate.toLocaleString('en-US', { month: 'short' });
      const dayNum = tempDate.getDate();
      
      const [hStr, mStr] = timePart.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHour = h % 12 === 0 ? 12 : h % 12;
      const timeFormatted = `${formattedHour}:${mStr} ${ampm}`;
      
      return { month: monthShort, date: String(dayNum), time: timeFormatted };
    }
  } catch (e) {
    console.error("Format error:", e);
  }
  return { month: '---', date: '--', time: '--:--' };
};

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showActionMenu, setShowActionMenu] = useState<number | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchAppointments = async () => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    const currentRole = (localStorage.getItem("role") || "").toLowerCase();
    const currentUserId = localStorage.getItem("userId") || "";
    const isDoctorView = currentRole === "doctor";
    const appointmentsUrl = isDoctorView && currentUserId
      ? `${API_BASE}/api/appointments?doctorId=${encodeURIComponent(currentUserId)}`
      : `${API_BASE}/api/appointments`;

    try {
      const [apptRes, docRes] = await Promise.all([
        axios.get(appointmentsUrl, { headers }),
        axios.get(`${API_BASE}/api/hospital/doctors`, { headers })
      ]);
      setAppointments(apptRes.data || []);
      const allDocs = docRes.data || [];
      const doctorList = allDocs.filter((s: any) => !s.role || s.role.toLowerCase() === 'doctor');
      setDoctors(isDoctorView && currentUserId ? doctorList.filter((d: any) => d.id === currentUserId) : doctorList);
      if (isDoctorView && currentUserId) {
        setSelectedDoctorId(currentUserId);
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    const headers = { 
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-tenant-id": localStorage.getItem("tenant") || ""
    };
    try {
      await axios.patch(`${API_BASE}/api/appointments/${appointmentId}`, { status }, { headers });
      fetchAppointments();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to update appointment status");
    }
  };

  useEffect(() => { 
    fetchAppointments(); 
  }, []);

  // Debounce search input to reduce re-renders and heavy filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const currentRole = (localStorage.getItem("role") || "").toLowerCase();
  const currentUserId = localStorage.getItem("userId") || "";
  const isDoctorView = currentRole === "doctor";
  const scopedDoctorId = isDoctorView ? currentUserId : selectedDoctorId;

  const formatDoctorName = (name = "") => name.toLowerCase().startsWith("dr") ? name : `Dr. ${name}`;

  const filteredAppointments = useMemo(() => {
    const query = debouncedSearch;
    return appointments
      .filter(appt => !scopedDoctorId || appt.doctor_id === scopedDoctorId)
      .filter(appt => activeCategory === "All" || appt.status === activeCategory)
      .filter(appt => {
        if (!query) return true;
        return (
          appt.patient_name?.toLowerCase().includes(query) ||
          appt.doctor_name?.toLowerCase().includes(query) ||
          appt.status?.toLowerCase().includes(query)
        );
      })
      .map(appt => ({ ...appt, __formatted: formatApptDateTime(appt.appointment_time) }));
  }, [appointments, scopedDoctorId, activeCategory, debouncedSearch]);

  // Category counts memoized to avoid repeated filtering on render
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: appointments.length, Scheduled: 0, Completed: 0, Cancelled: 0 };
    for (const a of appointments) {
      if (a.status === 'Scheduled') counts.Scheduled++;
      if (a.status === 'Completed') counts.Completed++;
      if (a.status === 'Cancelled') counts.Cancelled++;
    }
    return counts;
  }, [appointments]);

  // Pagination: slice visible items
  const visibleAppointments = useMemo(() => {
    setTimeout(() => {}, 0); // hint to avoid blocking synchronous UI
    return filteredAppointments.slice(0, page * pageSize);
  }, [filteredAppointments, page]);

  // Reset pagination when filters/search/doctor selection change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeCategory, selectedDoctorId, viewMode]);



  return (
    <div className="dashboard-layout" style={{ background: 'var(--app-bg)', minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: isMobile ? '16px' : '32px', width: '100%' }}>
        <Header title="Patient Scheduling" />

        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          marginBottom: '32px', 
          marginTop: '16px',
          gap: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Appointments Management</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Check doctor availability and book patient appointments.</p>
          </div>
          <button 
            onClick={() => navigate('/tenant/appointments/book')}
            className="button-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '14px 28px', 
              borderRadius: '16px',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
              width: isMobile ? '100%' : 'auto',
              justifyContent: 'center'
            }}
          >
            <Plus size={20} />
            Book New Appointment
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ 
              background: 'white', 
              borderRadius: '24px', 
              border: '1px solid #e2e8f0', 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              overflow: 'hidden'
            }}>
              {/* Vertical/Horizontal Category Panel */}
              <div style={{ 
                width: isMobile ? '100%' : '200px', 
                background: 'var(--app-bg)', 
                borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
                borderBottom: isMobile ? '1px solid #e2e8f0' : 'none',
                padding: isMobile ? '16px' : '24px 16px',
                display: 'flex',
                flexDirection: isMobile ? 'row' : 'column',
                gap: '8px',
                overflowX: isMobile ? 'auto' : 'visible'
              }}>
                {!isMobile && <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', paddingLeft: '12px' }}>Categories</div>}
                  {["All", "Scheduled", "Completed", "Cancelled"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: isMobile ? '8px 16px' : '12px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeCategory === cat ? '#3b82f6' : 'transparent',
                      color: activeCategory === cat ? 'white' : '#64748b',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      whiteSpace: 'nowrap',
                      gap: '8px'
                    }}
                  >
                    {cat}
                    <span style={{ 
                      fontSize: '10px', 
                      background: activeCategory === cat ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '100px'
                    }}>
                      {categoryCounts[cat] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, padding: isMobile ? '20px' : '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={20} color="#3b82f6" />
                    Upcoming Appointments
                  </h3>
                
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                      <input 
                        type="text" 
                        placeholder="Search appointments..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          padding: '8px 12px 8px 36px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '13px',
                          width: isMobile ? '100%' : '220px',
                          outline: 'none',
                          background: 'var(--app-bg)'
                        }}
                      />
                      <User size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>

                    {!isDoctorView && <select 
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      style={{ 
                        padding: '8px 16px', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0', 
                        background: 'var(--app-bg)', 
                        fontSize: '13px', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        outline: 'none',
                        cursor: 'pointer',
                        width: isMobile ? '100%' : 'auto'
                      }}
                    >
                      <option value="">All Doctors</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{formatDoctorName(d.name)}</option>)}
                    </select>
                    }

                    {/* View Toggle */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                      <button 
                        onClick={() => setViewMode('list')}
                        style={{ 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          border: 'none', 
                          background: viewMode === 'list' ? 'white' : 'transparent',
                          boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <Users size={14} color={viewMode === 'list' ? '#3b82f6' : '#64748b'} />
                      </button>
                      <button 
                        onClick={() => setViewMode('grid')}
                        style={{ 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          border: 'none', 
                          background: viewMode === 'grid' ? 'white' : 'transparent',
                          boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <Calendar size={14} color={viewMode === 'grid' ? '#3b82f6' : '#64748b'} />
                      </button>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>Loading schedules...</div>
                  </div>
                ) : viewMode === 'list' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {visibleAppointments.map((appt: any, i: number) => {
                      const formatted = appt.__formatted || formatApptDateTime(appt.appointment_time);
                      return (
                        <div key={i} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '24px', 
                          borderRadius: '20px', 
                          border: '1px solid #f1f5f9', 
                          background: 'var(--app-bg)',
                          position: 'relative'
                        }}>
                          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                              {formatted.month}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>
                              {formatted.date}
                            </div>
                          </div>
                          <div style={{ marginLeft: isMobile ? '12px' : '20px', flex: 1 }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: isMobile ? '14px' : '16px' }}>{appt.patient_name}</div>
                            <div style={{ fontSize: isMobile ? '11px' : '13px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} /> {formatDoctorName(appt.doctor_name)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontWeight: 800, color: '#3b82f6', fontSize: isMobile ? '13px' : '16px' }}>
                                <Clock size={isMobile ? 12 : 16} />
                                {formatted.time}
                              </div>
                              <div style={{ fontSize: '10px', color: appt.status === 'Completed' ? '#10b981' : '#f59e0b', fontWeight: 800, background: appt.status === 'Completed' ? '#f0fdf4' : '#fffbeb', padding: '2px 8px', borderRadius: '100px', marginTop: '4px', display: 'inline-block' }}>
                                {appt.status}
                              </div>
                            </div>
                          
                          <div style={{ position: 'relative' }}>
                            <button 
                              onClick={() => setShowActionMenu(showActionMenu === i ? null : i)}
                              style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
                            >
                              <Plus size={16} color="#64748b" style={{ transform: 'rotate(45deg)' }} />
                            </button>
                            
                            {showActionMenu === i && (
                              <div style={{ 
                                position: 'absolute', 
                                right: 0, 
                                top: '100%', 
                                background: 'white', 
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                                borderRadius: '12px', 
                                padding: '8px', 
                                zIndex: 10,
                                minWidth: '160px',
                                border: '1px solid #f1f5f9',
                                marginTop: '8px'
                              }}>
                                {["View Details", "Edit Schedule", "Cancel Visit", "Mark Completed"].map(action => (
                                  <div 
                                    key={action}
                                    onClick={() => {
                                      setShowActionMenu(null);
                                      if (action === "Mark Completed") {
                                        updateAppointmentStatus(appt.id, "Completed");
                                      } else if (action === "Cancel Visit") {
                                        updateAppointmentStatus(appt.id, "Cancelled");
                                      } else {
                                        alert(`${action} feature is coming soon.`);
                                      }
                                    }}
                                    style={{ 
                                      padding: '10px 12px', 
                                      fontSize: '12px', 
                                      fontWeight: 700, 
                                      color: action === "Cancel Visit" ? '#ef4444' : '#1e293b',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    {action}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                    {visibleAppointments.map((appt: any, i: number) => (
                      <div key={i} style={{ 
                        padding: '20px', 
                        borderRadius: '24px', 
                        border: '1px solid #f1f5f9', 
                        background: 'var(--app-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {(() => {
                          const formatted = formatApptDateTime(appt.appointment_time);
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ background: 'white', padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>{formatted.month}</div>
                                <div style={{ fontSize: '16px', fontWeight: 900 }}>{formatted.date}</div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 800, background: '#eff6ff', padding: '4px 10px', borderRadius: '100px' }}>
                                {formatted.time}
                              </div>
                            </div>
                          );
                        })()}
                        <div>
                          <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>{appt.patient_name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{formatDoctorName(appt.doctor_name)}</div>
                        </div>
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontSize: '10px', fontWeight: 800, color: appt.status === 'Completed' ? '#10b981' : '#f59e0b' }}>{appt.status.toUpperCase()}</span>
                           <button style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Details</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredAppointments.length > visibleAppointments.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      className="button-secondary"
                      style={{ padding: '8px 16px', borderRadius: '12px' }}
                    >
                      Load more
                    </button>
                  </div>
                )}

                {!loading && filteredAppointments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', background: 'var(--app-bg)', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
                    <Calendar size={40} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#94a3b8', margin: 0, fontWeight: 600 }}>No matching appointments found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ 
              background: 'white', 
              padding: '32px', 
              borderRadius: '24px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={20} color="#10b981" />
                Medical Staff
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {doctors.map((doc: any, i: number) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px',
                    borderRadius: '16px',
                    background: 'var(--app-bg)',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '14px', 
                      background: '#fff', 
                      border: '2px solid #3b82f6', 
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.name}`} 
                        alt="Doc" 
                        style={{ width: '100%', height: '100%' }} 
                      />
                    </div>
                    <div style={{ marginLeft: '12px' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>{formatDoctorName(doc.name)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                        <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></div>
                        Consulting Now
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ 
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
              padding: '24px', 
              borderRadius: '24px', 
              color: 'white'
            }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Need Help?</h4>
              <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '8px', lineHeight: 1.5 }}>
                Use the Doctor Availability view for a detailed calendar perspective.
              </p>
              <button 
                onClick={() => window.location.href = '/tenant/appointments/doctor-calendar'}
                style={{ 
                  marginTop: '16px', 
                  width: '100%', 
                  padding: '10px', 
                  borderRadius: '12px', 
                  border: 'none', 
                  background: 'rgba(255,255,255,0.2)', 
                  color: 'white', 
                  fontWeight: 700, 
                  cursor: 'pointer' 
                }}
              >
                Go to Calendar View
              </button>
            </div>
          </aside>
        </div>


      </main>
    </div>
  );
}
