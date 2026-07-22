
export type DoctorSchedule = {
  id: string;
  doctor_id: string;
  weekday: number; // 0-6
  session_name: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  slot_duration: number; // minutes
  consultation_type: 'OPD' | 'VIDEO' | 'SURGERY';
  location?: string;
  is_active: boolean;
};

export type DoctorLeave = {
  id: string;
  doctor_id: string;
  leave_type:
    | 'VACATION'
    | 'SICK'
    | 'SURGERY'
    | 'CONFERENCE'
    | 'ADMIN'
    | 'EMERGENCY';

  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD

  start_time?: string;
  end_time?: string;

  reason?: string;
  is_emergency?: boolean;
};

export type ScheduleOverride = {
  id: string;
  doctor_id: string;
  override_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  is_available: boolean;
  reason?: string;
};
