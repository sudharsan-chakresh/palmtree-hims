import { useState, useEffect } from 'react';
import { API_BASE_URL as API_BASE } from '../../../config/api';
import axios from 'axios';
import { User, Calendar, Clock, CheckCircle, ArrowLeft, Search, Plus, Phone, Loader2 } from 'lucide-react';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { Doctor, Patient, TimeSlot, BookingStep } from '../../../types/appointment';
import { formatTime, isToday, isPastDate } from '../../../utils/appointmentUtils';
import { toLocalDateKey, parseLocalDate, getAvailableSlotsForDate } from '../../../utils/schedulingEngine';

export default function BookAppointment() {
  const [currentStep, setCurrentStep] = useState<BookingStep>('select-doctor');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [doctorOnLeave, setDoctorOnLeave] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const token = localStorage.getItem("token");
  const tenantId = localStorage.getItem("tenant");

  // Guard: Redirect to login if session is missing
  if (!token || !tenantId) {
    window.location.href = '/login';
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-tenant-id": tenantId || ""
  };

  const fetchPatientById = async (patientId: string) => {
    try {
      const response = await axios.get(`${API_BASE}/api/patients/${patientId}`, { headers });
      return response.data;
    } catch (error) {
      console.warn(`Unable to fetch preselected patient ${patientId}`, error);
      return null;
    }
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
      setDoctors(docRes.data || []);
      const pats = patRes.data || [];
      setPatients(pats);

      const params = new URLSearchParams(window.location.search);
      const preselectedPatientId = params.get('patientId');
      let foundPatient: Patient | null = null;
      if (preselectedPatientId) {
        foundPatient = pats.find((p: any) => p.id === preselectedPatientId) || null;
        if (!foundPatient) {
          foundPatient = await fetchPatientById(preselectedPatientId);
          if (foundPatient) {
            const newPat = foundPatient;
            setPatients((prev) => {
              if (prev.some((p) => p.id === newPat.id)) return prev;
              return [...prev, newPat];
            });
          }
        }
        if (foundPatient) {
          setSelectedPatient(foundPatient);
        }
      }

      const preselectedDoctorId = params.get('doctorId');
      const preselectedDateStr = params.get('date');
      const preselectedTimeStr = params.get('time');

      if (preselectedDoctorId && docRes.data) {
        const docFound = docRes.data.find((d: any) => d.id === preselectedDoctorId);
        if (docFound) {
          setSelectedDoctor(docFound);
          if (preselectedDateStr) {
            const dateObj = parseLocalDate(preselectedDateStr);
            setSelectedDate(dateObj);
            fetchDoctorAvailability(docFound, dateObj);

            if (preselectedTimeStr) {
              setSelectedTime(preselectedTimeStr);
              if (foundPatient) {
                setCurrentStep('confirm');
              } else {
                setCurrentStep('select-patient');
              }
            } else {
              if (foundPatient) {
                setCurrentStep('select-time');
              } else {
                setCurrentStep('select-patient');
              }
            }
          } else {
            if (foundPatient) {
              setCurrentStep('select-date');
            } else {
              setCurrentStep('select-patient');
            }
          }
        }
      } else if (foundPatient) {
        setCurrentStep('select-doctor');
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchDoctorAvailability = async (doctor: Doctor, date: Date) => {
    setLoadingSlots(true);
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const response = await axios.get(
        `${API_BASE}/api/doctors/${doctor.id}/availability-rules?startDate=${dateStr}&endDate=${dateStr}`,
        { headers }
      );
      
      const leaves = response.data.leaves || [];
      const overrides = response.data.overrides || [];
      const dayAppointments = response.data.appointments || [];

      // Check if doctor is on full-day leave for this date
      const hasFullDayLeave = leaves.some((l: any) => {
        const start = l.start_date?.substring(0, 10);
        const end = l.end_date?.substring(0, 10);
        const isWithinRange = dateStr >= start && dateStr <= end;
        return isWithinRange && (!l.start_time && !l.end_time);
      });
      setDoctorOnLeave(hasFullDayLeave);
      
      if (hasFullDayLeave) {
        setAvailableSlots([]);
        return;
      }

      const slots = getAvailableSlotsForDate({
        dateStr,
        schedules: response.data.schedules || [],
        leaves,
        overrides,
        appointments: dayAppointments,
      });
      
      setAvailableSlots(slots.filter(slot => slot.available));
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate(null);
    setSelectedTime('');
    setAvailableSlots([]);
    if (selectedPatient) {
      setCurrentStep('select-date');
    } else {
      setCurrentStep('select-patient');
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    if (selectedDoctor && selectedDate && selectedTime) {
      setCurrentStep('confirm');
    } else if (selectedDoctor && selectedDate) {
      setCurrentStep('select-time');
    } else if (selectedDoctor) {
      setCurrentStep('select-date');
    } else {
      setCurrentStep('select-doctor');
    }
  };

  const handleDateSelect = (date: Date) => {
    if (isPastDate(date)) return;
    
    setSelectedDate(date);
    setDoctorOnLeave(false);
    setAvailableSlots([]);
    if (selectedDoctor) {
      fetchDoctorAvailability(selectedDoctor, date);
    }
    if (selectedPatient) {
      setCurrentStep('select-time');
    } else {
      setCurrentStep('select-patient');
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    if (selectedPatient) {
      setCurrentStep('confirm');
    } else {
      setCurrentStep('select-patient');
    }
  };

  const confirmBooking = async () => {
    if (!selectedDoctor || !selectedPatient || !selectedDate || !selectedTime) return;

    setLoading(true);
    try {
      const dateStr = toLocalDateKey(selectedDate);
      const appointmentTimeStr = `${dateStr}T${selectedTime}:00`;
      
      await axios.post(`${API_BASE}/api/appointments`, {
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctor.id,
        appointment_time: appointmentTimeStr,
        status: 'Scheduled'
      }, { headers });

      setCurrentStep('success');
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      const errMsg = error.response?.data?.error || 'Failed to book appointment. Please try again.';
      alert(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetBooking = () => {
    setCurrentStep('select-doctor');
    setSelectedDoctor(null);
    setSelectedPatient(null);
    setSelectedDate(null);
    setSelectedTime('');
    setAvailableSlots([]);
    setSearchQuery('');
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (patient.phone && patient.phone.includes(searchQuery))
  );

  const renderStepIndicator = () => {
    const steps = [
      { key: 'select-doctor', label: 'Select Doctor' },
      { key: 'select-patient', label: 'Select Patient' },
      { key: 'select-date', label: 'Choose Date' },
      { key: 'select-time', label: 'Choose Time' },
      { key: 'confirm', label: 'Confirm' }
    ];

    const handleStepClick = (stepKey: string) => {
      const stepOrder = ['select-doctor', 'select-patient', 'select-date', 'select-time', 'confirm'];
      const currentIndex = stepOrder.indexOf(currentStep);
      const targetIndex = stepOrder.indexOf(stepKey);

      // Only allow going back to a step before the current step, and not if we are at success step
      if (targetIndex < currentIndex && currentStep !== 'success') {
        // Clear dependent state when going back
        if (targetIndex <= 0) {
          setSelectedDoctor(null);
          setSelectedPatient(null);
          setSelectedDate(null);
          setSelectedTime('');
        } else if (targetIndex <= 1) {
          setSelectedPatient(null);
          setSelectedDate(null);
          setSelectedTime('');
        } else if (targetIndex <= 2) {
          setSelectedDate(null);
          setSelectedTime('');
        } else if (targetIndex <= 3) {
          setSelectedTime('');
        }
        setCurrentStep(stepKey as BookingStep);
      }
    };

    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        {steps.map((step, index) => {
          const isCurrent = currentStep === step.key;
          const isCompleted = steps.slice(0, steps.findIndex(s => s.key === currentStep)).some(s => s.key === step.key);
          const isClickable = isCompleted && currentStep !== 'success';

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div 
                onClick={() => handleStepClick(step.key)}
                title={isClickable ? `Go back to ${step.label}` : ''}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCurrent ? '#4f46e5' : (isCompleted ? '#10b981' : '#e2e8f0'),
                  color: isCurrent || isCompleted ? 'white' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(79, 70, 229, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (isClickable) {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isClickable) {
                    e.currentTarget.style.background = '#10b981';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div style={{
                  width: '40px',
                  height: '2px',
                  background: isCompleted ? '#10b981' : '#e2e8f0',
                  margin: '0 8px'
                }}></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDoctorSelection = () => (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
        Select a Doctor
      </h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Choose the doctor you want to book an appointment with
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {doctors.map(doctor => (
          <div
            key={doctor.id}
            onClick={() => handleDoctorSelect(doctor)}
            style={{
              padding: '20px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4f46e5';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                  Dr. {doctor.name}
                </div>
                {doctor.specialization && (
                  <div style={{ fontSize: '14px', color: '#64748b' }}>
                    {doctor.specialization}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPatientSelection = () => (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
        Select Patient
      </h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Search and select the patient for this appointment
      </p>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '12px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by name, MRN, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {filteredPatients.map(patient => (
          <div
            key={patient.id}
            onClick={() => handlePatientSelect(patient)}
            style={{
              padding: '20px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4f46e5';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  {patient.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b' }}>
                    <span style={{ fontWeight: 600 }}>MRN:</span> {patient.mrn}
                  </div>
                  {patient.age && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b' }}>
                      <span style={{ fontWeight: 600 }}>Age:</span> {patient.age} {patient.gender && `(${patient.gender})`}
                    </div>
                  )}
                  {patient.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#64748b' }}>
                      <Phone size={14} />
                      {patient.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '16px', color: '#64748b', marginBottom: '16px' }}>
            No patients found matching your search.
          </div>
          <button
            type="button"
            onClick={() => window.location.href = '/tenant/clinical/patient-register'}
            style={{
              padding: '12px 24px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto'
            }}
          >
            <Plus size={16} />
            Register New Patient
          </button>
        </div>
      )}
    </div>
  );

  const renderDateSelection = () => {
    const today = new Date();
    const dates = [];
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return (
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          Select Date
        </h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>
          Choose a date for the appointment with Dr. {selectedDoctor?.name}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
          {dates.map(date => {
            const isPast = isPastDate(date);
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => !isPast && handleDateSelect(date)}
                disabled={isPast}
                style={{
                  padding: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  background: isSelected ? '#4f46e5' : (isPast ? '#f8fafc' : 'white'),
                  color: isSelected ? 'white' : (isPast ? '#94a3b8' : '#1e293b'),
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>
                  {date.getDate()}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
                {isToday(date) && (
                  <div style={{ fontSize: '10px', marginTop: '4px', fontStyle: 'italic' }}>
                    Today
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeSelection = () => (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
        Select Time
      </h2>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Available time slots for {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {loadingSlots ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Loader2 className="animate-spin" size={40} style={{ color: '#4f46e5', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '16px', color: '#64748b' }}>
            Loading available slots...
          </div>
        </div>
      ) : availableSlots.length > 0 ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {availableSlots.map(slot => (
              <button
                key={slot.time}
                onClick={() => handleTimeSelect(slot.time)}
                style={{
                  padding: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  background: selectedTime === slot.time ? '#4f46e5' : 'white',
                  color: selectedTime === slot.time ? 'white' : '#1e293b',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  fontSize: '16px',
                  fontWeight: 600
                }}
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => setCurrentStep('select-date')}
              style={{
                padding: '12px 24px',
                border: '2px solid #e2e8f0',
                background: 'white',
                color: '#64748b',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Clock size={48} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
          {doctorOnLeave ? (
            <>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#be123c', marginBottom: '8px' }}>
                Dr. {selectedDoctor?.name} is on leave this day
              </div>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                Please choose a different date or contact the doctor's schedule admin.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '16px', color: '#64748b', marginBottom: '16px' }}>
              No available slots — all slots are booked or blocked for this date.
            </div>
          )}
          <button
            onClick={() => setCurrentStep('select-date')}
            style={{
              padding: '12px 24px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Choose Different Date
          </button>
        </div>
      )}
    </div>
  );

  const renderConfirmation = () => (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
        Confirm Appointment
      </h2>
      <p style={{ color: '#64748b', marginBottom: '32px' }}>
        Please review the appointment details before confirming
      </p>

      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={20} style={{ color: '#4f46e5' }} />
            <div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Doctor</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                Dr. {selectedDoctor?.name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={20} style={{ color: '#4f46e5' }} />
            <div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Patient</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {selectedPatient?.name} ({selectedPatient?.mrn})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar size={20} style={{ color: '#4f46e5' }} />
            <div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Date</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} style={{ color: '#4f46e5' }} />
            <div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Time</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {formatTime(selectedTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setCurrentStep('select-time')}
          style={{
            padding: '12px 24px',
            border: '2px solid #e2e8f0',
            background: 'white',
            color: '#64748b',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        
        <button
          onClick={confirmBooking}
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Booking...' : (
            <>
              <CheckCircle size={16} />
              Confirm Booking
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: '#10b981',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px'
      }}>
        <CheckCircle size={40} style={{ color: 'white' }} />
      </div>
      
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
        Appointment Booked Successfully!
      </h2>
      
      <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '16px' }}>
        Appointment confirmed for {selectedPatient?.name} with Dr. {selectedDoctor?.name} on {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {formatTime(selectedTime)}.
      </p>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <button
          onClick={resetBooking}
          style={{
            padding: '12px 24px',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} />
          Book Another Appointment
        </button>
        
        <button
          onClick={() => window.location.href = '/tenant/appointments'}
          style={{
            padding: '12px 24px',
            border: '2px solid #e2e8f0',
            background: 'white',
            color: '#64748b',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          View All Appointments
        </button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select-doctor':
        return renderDoctorSelection();
      case 'select-patient':
        return renderPatientSelection();
      case 'select-date':
        return renderDateSelection();
      case 'select-time':
        return renderTimeSelection();
      case 'confirm':
        return renderConfirmation();
      case 'success':
        return renderSuccess();
      default:
        return renderDoctorSelection();
    }
  };

  return (
    <div className="dashboard-layout" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <Header title="Book Appointment" />
        
        {renderStepIndicator()}
        
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Active Selections Summary Banner */}
          {(selectedDoctor || selectedPatient || selectedDate || selectedTime) && currentStep !== 'success' && currentStep !== 'confirm' && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '16px 20px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '24px',
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569'
            }}>
              <span style={{ fontWeight: 800, textTransform: 'uppercase', color: '#4f46e5', fontSize: '11px', letterSpacing: '0.05em' }}>Selected Context:</span>
              {selectedDoctor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Doctor:</span>
                  <span style={{ color: '#1e293b', fontWeight: 700 }}>Dr. {selectedDoctor.name}</span>
                </div>
              )}
              {selectedPatient && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Patient:</span>
                  <span style={{ color: '#1e293b', fontWeight: 700 }}>{selectedPatient.name}</span>
                </div>
              )}
              {selectedDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Date:</span>
                  <span style={{ color: '#1e293b', fontWeight: 700 }}>{selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {selectedTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Time:</span>
                  <span style={{ color: '#1e293b', fontWeight: 700 }}>{formatTime(selectedTime)}</span>
                </div>
              )}
            </div>
          )}
          {renderCurrentStep()}
        </div>
      </main>
    </div>
  );
}
