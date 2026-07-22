/**
 * Safely parses a "YYYY-MM-DD" date string into a local Date object representing midnight of that day.
 */
export const parseLocalDate = (dateStr: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d);
};

/**
 * Formats a Date object to "YYYY-MM-DD" string in local time.
 */
export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Safely extracts local YYYY-MM-DD and HH:MM components from database timestamps
 * without timezone shift.
 */
export const parseApptTime = (appointmentTime: string | Date): { dateStr: string; timeStr: string } => {
  const str = typeof appointmentTime === 'string' ? appointmentTime : new Date(appointmentTime).toISOString();
  const parts = str.split('T');
  if (parts.length >= 2) {
    const dateStr = parts[0];
    const timeStr = parts[1].substring(0, 5); // "HH:MM"
    return { dateStr, timeStr };
  }
  const d = new Date(str);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const date = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${date}`,
    timeStr: `${hours}:${minutes}`
  };
};

/**
 * Returns the weekday (0-6) of a "YYYY-MM-DD" date string in local time.
 */
export const getWeekdayFromDateStr = (dateStr: string): number => {
  return parseLocalDate(dateStr).getDay();
};

/**
 * Converts "HH:MM" time string to total minutes since midnight.
 */
export const parseTimeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Checks if a time slot on a specific date falls within a leave/OOO window, supporting partial-day leaves.
 */
export const isSlotOnLeave = (dateStr: string, timeStr: string, leave: any): boolean => {
  if (!leave.start_date || !leave.end_date) return false;
  
  if (!leave._parsed) {
    leave._parsed = {
      start: leave.start_date.substring(0, 10),
      end: leave.end_date.substring(0, 10),
      startMins: leave.start_time ? parseTimeToMinutes(leave.start_time) : 0,
      endMins: leave.end_time ? parseTimeToMinutes(leave.end_time) : 24 * 60
    };
  }
  
  const { start, end, startMins, endMins } = leave._parsed;
  
  if (dateStr < start || dateStr > end) {
    return false;
  }
  
  if (dateStr > start && dateStr < end) {
    return true;
  }
  
  const isStartDay = dateStr === start;
  const isEndDay = dateStr === end;
  
  const slotMins = parseTimeToMinutes(timeStr);
  
  if (isStartDay && isEndDay) {
    return slotMins >= startMins && slotMins < endMins;
  } else if (isStartDay) {
    return slotMins >= startMins;
  } else if (isEndDay) {
    return slotMins < endMins;
  }
  
  return false;
};

/**
 * Evaluates the status of a specific time slot for the clinical calendar view.
 */
export const getSlotState = ({
  date,
  time,
  appointments,
  leaves,
  schedules,
  overrides,
  doctorStatus,
}: any) => {
  const now = new Date();
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const slotDate = new Date(y, mo - 1, d, h, mi);
  
  // Buffer of 30 mins to allow editing/booking current/very recent slots
  const isPast = slotDate.getTime() < (now.getTime() - 30 * 60 * 1000);
  const isCurrent = Math.abs(slotDate.getTime() - now.getTime()) < 30 * 60 * 1000;
  
  const weekday = getWeekdayFromDateStr(date);

  // 1. Doctor Global Status Check (Emergency) - Highest priority
  if (doctorStatus?.status === 'EMERGENCY') {
    return { status: 'EMERGENCY', color: '#be123c', label: 'EMERGENCY', isBookable: false, isPast, isCurrent };
  }

  // 2. Appointment Check
  let appointment = null;
  if (Array.isArray(appointments)) {
    if (!(appointments as any)._lookupMap) {
      const map = new Map();
      appointments.forEach((a: any) => {
        const { dateStr: apptDateStr, timeStr: apptTime } = parseApptTime(a.appointment_time);
        map.set(`${apptDateStr}_${apptTime}`, a);
      });
      Object.defineProperty(appointments, '_lookupMap', {
        value: map,
        writable: true,
        configurable: true,
        enumerable: false
      });
    }
    appointment = (appointments as any)._lookupMap.get(`${date}_${time}`);
  }

  if (appointment) {
    const isDelayed = doctorStatus?.delay_minutes > 0;
    return { 
      status: 'BOOKED', 
      color: isDelayed ? '#7e22ce' : '#3b82f6',
      label: isDelayed ? `${appointment.patient_name} (DELAYED)` : appointment.patient_name, 
      isBookable: false, 
      appointment, 
      isPast, 
      isCurrent 
    };
  }

  // 3. Leave Check (supporting partial-day leaves)
  const leave = leaves.find((l: any) => isSlotOnLeave(date, time, l));
  if (leave) {
    return { 
      status: 'LEAVE', 
      color: '#94a3b8', 
      label: leave.leave_type || 'LEAVE', 
      isBookable: false, 
      isPast, 
      isCurrent 
    };
  }

  // 4. Master Schedule
  let schedule = null;
  if (Array.isArray(schedules)) {
    if (!(schedules as any)._lookupMap) {
      const map = new Map();
      schedules.forEach((s: any) => {
        if (!map.has(s.weekday)) {
          map.set(s.weekday, []);
        }
        map.get(s.weekday).push({
          ...s,
          startMins: parseTimeToMinutes(s.start_time),
          endMins: parseTimeToMinutes(s.end_time)
        });
      });
      Object.defineProperty(schedules, '_lookupMap', {
        value: map,
        writable: true,
        configurable: true,
        enumerable: false
      });
    }
    const slotMins = parseTimeToMinutes(time);
    const weekdaySchedules = (schedules as any)._lookupMap.get(weekday) || [];
    schedule = weekdaySchedules.find((s: any) => s.is_active && slotMins >= s.startMins && slotMins < s.endMins);
  } else {
    schedule = schedules.find((s: any) => s.weekday === weekday && time >= s.start_time && time < s.end_time && s.is_active);
  }

  // 5. Override
  let override = null;
  if (Array.isArray(overrides)) {
    if (!(overrides as any)._lookupMap) {
      const map = new Map();
      overrides.forEach((o: any) => {
        if (!map.has(o.override_date)) {
          map.set(o.override_date, []);
        }
        map.get(o.override_date).push({
          ...o,
          startMins: parseTimeToMinutes(o.start_time),
          endMins: parseTimeToMinutes(o.end_time)
        });
      });
      Object.defineProperty(overrides, '_lookupMap', {
        value: map,
        writable: true,
        configurable: true,
        enumerable: false
      });
    }
    const slotMins = parseTimeToMinutes(time);
    const dayOverrides = (overrides as any)._lookupMap.get(date) || [];
    override = dayOverrides.find((o: any) => slotMins >= o.startMins && slotMins < o.endMins);
  } else {
    override = overrides.find((o: any) => o.override_date === date && time >= o.start_time && time < o.end_time);
  }

  // 6. Availability Logic
  let isAvailable = !!schedule;
  let reason = schedule ? schedule.session_name : 'OFF HOURS';

  if (override) {
    isAvailable = override.is_available;
    reason = override.reason || (isAvailable ? 'OVERRIDE AVAIL' : 'BLOCKED');
  }

  if (!isAvailable) {
    return { status: 'UNAVAILABLE', color: '#f8fafc', label: reason, isBookable: false, isPast, isCurrent };
  }

  // 7. Handle Delay Indication
  if (doctorStatus?.delay_minutes > 0) {
    return { 
      status: 'DELAYED_AVAIL', 
      color: '#d97706',
      label: `AVAIL (+${doctorStatus.delay_minutes}m)`, 
      isBookable: !isPast, 
      isPast,
      isCurrent
    };
  }

  return {
    status: 'AVAILABLE',
    color: '#dcfce7',
    label: 'AVAILABLE',
    isBookable: !isPast,
    isPast,
    isCurrent
  };
};

/**
 * Generates all time slots for a doctor on a specific date, evaluating schedules, leaves, overrides, and appointments.
 */
export const getAvailableSlotsForDate = ({
  dateStr,
  schedules = [],
  leaves = [],
  overrides = [],
  appointments = [],
  slotDurationFallback = 30,
}: {
  dateStr: string;
  schedules: any[];
  leaves: any[];
  overrides: any[];
  appointments: any[];
  slotDurationFallback?: number;
}): any[] => {
  const weekday = getWeekdayFromDateStr(dateStr);
  const daySchedules = schedules.filter((s: any) => s.weekday === weekday && s.is_active);
  
  if (daySchedules.length === 0) {
    return [];
  }
  
  // Set up lookup map for appointments on the array if not already present
  if (Array.isArray(appointments) && !(appointments as any)._lookupMap) {
    const map = new Map();
    appointments.forEach((a: any) => {
      const { dateStr: apptDateStr, timeStr: apptTime } = parseApptTime(a.appointment_time);
      map.set(`${apptDateStr}_${apptTime}`, a);
    });
    Object.defineProperty(appointments, '_lookupMap', {
      value: map,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  // Set up lookup map for overrides on the array if not already present
  if (Array.isArray(overrides) && !(overrides as any)._lookupMap) {
    const map = new Map();
    overrides.forEach((o: any) => {
      if (!map.has(o.override_date)) {
        map.set(o.override_date, []);
      }
      map.get(o.override_date).push({
        ...o,
        startMins: parseTimeToMinutes(o.start_time),
        endMins: parseTimeToMinutes(o.end_time)
      });
    });
    Object.defineProperty(overrides, '_lookupMap', {
      value: map,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  const slots: any[] = [];
  
  daySchedules.forEach((schedule: any) => {
    const duration = schedule.slot_duration || slotDurationFallback;
    const startMins = parseTimeToMinutes(schedule.start_time);
    const endMins = parseTimeToMinutes(schedule.end_time);
    
    let currentMins = startMins;
    while (currentMins + duration <= endMins) {
      const timeStr = `${Math.floor(currentMins / 60).toString().padStart(2, '0')}:${(currentMins % 60).toString().padStart(2, '0')}`;
      
      // O(1) Appointment Check
      const appt = (appointments as any)._lookupMap 
        ? (appointments as any)._lookupMap.get(`${dateStr}_${timeStr}`)
        : appointments.find((a: any) => {
            const { dateStr: apptDateStr, timeStr: apptTime } = parseApptTime(a.appointment_time);
            return apptDateStr === dateStr && apptTime === timeStr;
          });
      
      // Check for leaves (including partial day)
      const leave = leaves.find((l: any) => isSlotOnLeave(dateStr, timeStr, l));
      
      // Check overrides (using pre-parsed values if available)
      let override = null;
      if ((overrides as any)._lookupMap) {
        const dayOverrides = (overrides as any)._lookupMap.get(dateStr) || [];
        const slotMins = parseTimeToMinutes(timeStr);
        override = dayOverrides.find((o: any) => slotMins >= o.startMins && slotMins < o.endMins);
      } else {
        override = overrides.find((o: any) => {
          if (o.override_date !== dateStr) return false;
          const slotMins = parseTimeToMinutes(timeStr);
          const oStart = parseTimeToMinutes(o.start_time);
          const oEnd = parseTimeToMinutes(o.end_time);
          return slotMins >= oStart && slotMins < oEnd;
        });
      }
      
      // Calculate availability
      let available = true;
      if (leave) {
        available = false;
      } else if (override) {
        available = override.is_available;
      }
      
      // Past slot check
      const now = new Date();
      const [y, mo, d] = dateStr.split('-').map(Number);
      const [h, mi] = timeStr.split(':').map(Number);
      const slotDate = new Date(y, mo - 1, d, h, mi);
      // Allow booking slots up to 30 mins in the past
      const isPast = slotDate.getTime() < (now.getTime() - 30 * 60 * 1000);
      
      slots.push({
        time: timeStr,
        available: available && !appt && !isPast,
        appointment: appt,
        isBooked: !!appt,
        isLeave: !!leave,
        isOverride: !!override,
        leave,
        override,
        isPast
      });
      
      currentMins += duration;
    }
  });
  
  // De-duplicate slots by time, and sort them
  const uniqueSlots = slots.filter((slot, index, self) =>
    index === self.findIndex((s) => s.time === slot.time)
  ).sort((a, b) => a.time.localeCompare(b.time));
  
  return uniqueSlots;
};
