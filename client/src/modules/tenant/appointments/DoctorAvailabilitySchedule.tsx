import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { User, ChevronLeft, ChevronRight, Filter, CheckCircle, X, Calendar, AlertCircle } from 'lucide-react';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { API_BASE_URL as API_BASE } from '../../../config/api';
import { Doctor, Appointment, ScheduleRule } from '../../../types/appointment';
import { getWeekDates, isToday, formatTime, isPastDate } from '../../../utils/appointmentUtils';
import { toLocalDateKey, getAvailableSlotsForDate } from '../../../utils/schedulingEngine';

export default function DoctorAvailabilitySchedule() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRule[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'available' | 'booked'>('all');

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      fetchDoctorData();
    }
  }, [selectedDoctor, currentWeek]);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/hospital/doctors`, { headers });
      const doctorsList = response.data || [];
      setDoctors(doctorsList);
      if (doctorsList.length > 0) {
        setSelectedDoctor(doctorsList[0]);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorData = async () => {
    if (!selectedDoctor) return;

    try {
      const start = getWeekDates(currentWeek)[0];
      const end = getWeekDates(currentWeek)[6];
      
      const response = await axios.get(
        `${API_BASE}/api/doctors/${selectedDoctor.id}/availability-rules?startDate=${toLocalDateKey(start)}&endDate=${toLocalDateKey(end)}`,
        { headers }
      );

      setAppointments(response.data.appointments || []);
      setSchedules(response.data.schedules || []);
      setLeaves(response.data.leaves || []);
      setOverrides(response.data.overrides || []);
    } catch (error) {
      console.error('Error fetching doctor data:', error);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const getSlotsForDay = (date: Date): any[] => {
    const dateStr = toLocalDateKey(date);
    return getAvailableSlotsForDate({
      dateStr,
      schedules,
      leaves,
      overrides,
      appointments
    });
  };

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  const weeklySlotMap = useMemo(() => {
    const map: Record<string, Map<string, any>> = {};
    weekDates.forEach((date) => {
      const dateStr = toLocalDateKey(date);
      const slots = getSlotsForDay(date);
      const timeMap = new Map<string, any>();
      slots.forEach((slot) => timeMap.set(slot.time, slot));
      map[dateStr] = timeMap;
    });
    return map;
  }, [weekDates, schedules, leaves, overrides, appointments]);

  const allTimeSlots = useMemo(() => {
    const set = new Set<string>();
    Object.values(weeklySlotMap).forEach((timeMap) => {
      timeMap.forEach((_, time) => set.add(time));
    });
    return Array.from(set).sort();
  }, [weeklySlotMap]);

  if (loading) {
    return (
      <div className="dashboard-layout" style={{ background: 'var(--app-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748b' }}>Loading doctor availability...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" style={{ background: 'var(--app-bg)', minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px' }}>
        <Header title="Doctor Availability Schedule" />

        {/* Controls Section */}
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '24px', 
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            {/* Doctor Selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <User size={20} style={{ color: '#64748b' }} />
              <select
                value={selectedDoctor?.id || ''}
                onChange={(e) => setSelectedDoctor(doctors.find(d => d.id === e.target.value) || null)}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  minWidth: '200px',
                  cursor: 'pointer'
                }}
              >
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name} {doctor.specialization && ` - ${doctor.specialization}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Week Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => navigateWeek('prev')}
                style={{
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                  {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Week {Math.ceil((weekDates[0].getDate() + new Date(weekDates[0].getFullYear(), weekDates[0].getMonth(), 1).getDay()) / 7)}
                </div>
              </div>
              
              <button
                onClick={() => navigateWeek('next')}
                style={{
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: '#64748b' }} />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Slots</option>
                <option value="available">Available Only</option>
                <option value="booked">Booked Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', background: 'var(--app-bg)', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Time</div>
            {weekDates.map((date, index) => (
              <div key={index} style={{ 
                padding: '16px', 
                textAlign: 'center',
                background: isToday(date) ? '#eef2ff' : 'transparent',
                borderLeft: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: isToday(date) ? '#4f46e5' : '#64748b' }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 700, 
                  color: isToday(date) ? '#4f46e5' : '#1e293b',
                  marginTop: '4px'
                }}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {allTimeSlots.map(time => (
              <div key={time} style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ 
                  padding: '12px 16px', 
                  fontSize: '12px', 
                  fontWeight: 500, 
                  color: '#64748b',
                  background: '#fafbfc'
                }}>
                  {formatTime(time)}
                </div>

                {weekDates.map((date, dayIndex) => {
                  const dateStr = toLocalDateKey(date);
                  const slot = weeklySlotMap[dateStr]?.get(time);
                  const isPast = isPastDate(date);

                  return (
                    <div key={dayIndex} style={{ 
                      padding: '8px',
                      borderLeft: '1px solid #f1f5f9',
                      background: isPast ? '#f8fafc' : 'white'
                    }}>
                      {slot && (selectedFilter === 'all' || 
                        (selectedFilter === 'available' && slot.available) || 
                        (selectedFilter === 'booked' && slot.isBooked)) && (() => {
                          let bg = '#dcfce7'; 
                          let color = '#166534';
                          let icon = <CheckCircle size={12} />;
                          let label = 'Available';
                          let tooltip = 'Available for booking';
                          
                          if (isPast) {
                            bg = '#e2e8f0';
                            color = '#64748b';
                            label = 'Past';
                            tooltip = 'This slot has passed';
                          } else if (slot.isBooked) {
                            bg = '#fee2e2'; 
                            color = '#991b1b';
                            icon = <Calendar size={12} />;
                            label = 'Booked';
                            tooltip = `Booked: ${slot.appointment?.patient_name || 'Patient'}`;
                          } else if (slot.isLeave) {
                            bg = '#f1f5f9'; 
                            color = '#475569'; 
                            icon = <AlertCircle size={12} />;
                            label = slot.leave?.leave_type || 'On Leave';
                            tooltip = `On Leave: ${slot.leave?.reason || 'Doctor is on leave'}`;
                          } else if (slot.isOverride && !slot.override?.is_available) {
                            bg = '#fff7ed'; 
                            color = '#c2410c'; 
                            icon = <X size={12} />;
                            label = 'Blocked';
                            tooltip = `Blocked: ${slot.override?.reason || 'Unavailable override'}`;
                          }

                          return (
                            <div 
                              title={tooltip}
                              style={{
                                padding: '8px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 500,
                                textAlign: 'center',
                                cursor: isPast ? 'not-allowed' : 'pointer',
                                background: bg,
                                color: color,
                                opacity: isPast ? 0.5 : 1,
                                transition: 'all 0.2s'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  {icon}
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                                    {label}
                                  </span>
                                </div>
                                {slot.isBooked && slot.appointment?.patient_name && (
                                  <div style={{ fontSize: '10px', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>
                                    {slot.appointment.patient_name}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                      })()}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          marginTop: '16px', 
          padding: '16px',
          background: 'white',
          borderRadius: '12px',
          fontSize: '12px',
          color: '#64748b',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#dcfce7', borderRadius: '4px' }}></div>
            Available
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#fee2e2', borderRadius: '4px' }}></div>
            Booked (Hover for Patient Name)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
            On Leave / Absence
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#fff7ed', borderRadius: '4px' }}></div>
            Blocked / Override
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#e2e8f0', borderRadius: '4px' }}></div>
            Past
          </div>
        </div>
      </main>
    </div>
  );
}
