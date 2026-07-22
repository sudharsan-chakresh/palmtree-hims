export interface Doctor {
  id: string;
  name: string;
  specialization?: string;
  department?: string;
  is_active?: boolean;
}

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  phone?: string;
  age?: number;
  gender?: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  appointment?: Appointment;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_time: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';
  patient_name?: string;
  patient_mrn?: string;
  notes?: string;
}

export interface ScheduleRule {
  id: string;
  weekday: number;
  session_name: string;
  start_time: string;
  end_time: string;
  slot_duration: number;
  consultation_type: string;
  is_active: boolean;
}

export interface DoctorAvailability {
  doctor: Doctor;
  availableSlots: TimeSlot[];
  appointments: Appointment[];
  schedule: ScheduleRule[];
}

export type BookingStep = 'select-doctor' | 'select-patient' | 'select-date' | 'select-time' | 'confirm' | 'success';

