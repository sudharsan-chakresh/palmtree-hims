import { TimeSlot, Appointment } from '../types/appointment';
import { isSlotOnLeave, parseTimeToMinutes, parseApptTime } from './schedulingEngine';

/**
 * Returns true if the given time string (HH:MM) falls within a leave or block override.
 */
export const isTimeBlocked = (
  timeString: string,
  dateStr: string,
  leaves: any[],
  overrides: any[]
): boolean => {
  // Check leaves (supporting partial-day leaves)
  const onLeave = leaves.some(l => isSlotOnLeave(dateStr, timeString, l));
  if (onLeave) return true;

  // Check overrides — a manual block override takes priority over schedule
  const blockedByOverride = overrides.some(o => {
    if (o.override_date?.substring(0, 10) !== dateStr) return false;
    if (o.is_available) return false; // it's an "open" override, not a block
    const slotMins = parseTimeToMinutes(timeString);
    const startMins = parseTimeToMinutes(o.start_time);
    const endMins = parseTimeToMinutes(o.end_time);
    return slotMins >= startMins && slotMins < endMins;
  });
  return blockedByOverride;
};

export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  duration: number,
  appointments: Appointment[],
  dateStr: string = '',
  leaves: any[] = [],
  overrides: any[] = []
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes + duration <= endMinutes) {
    const timeString = `${Math.floor(currentMinutes / 60).toString().padStart(2, '0')}:${(currentMinutes % 60).toString().padStart(2, '0')}`;
    
    const hasAppointment = appointments.some(apt => {
      const { dateStr: aptDateStr, timeStr: aptTimeString } = parseApptTime(apt.appointment_time);
      return aptDateStr === dateStr && aptTimeString === timeString;
    });

    const blocked = isTimeBlocked(timeString, dateStr, leaves, overrides);
    
    slots.push({
      time: timeString,
      available: !hasAppointment && !blocked,
      appointment: hasAppointment ? appointments.find(apt => {
        const { dateStr: aptDateStr, timeStr: aptTimeString } = parseApptTime(apt.appointment_time);
        return aptDateStr === dateStr && aptTimeString === timeString;
      }) : undefined
    });
    
    currentMinutes += duration;
  }
  
  return slots;
};

export const getWeekDates = (date: Date = new Date()) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDates.push(d);
  }
  
  return weekDates;
};

export const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

export const getScheduleForDay = (schedules: any[], weekday: number) => {
  return schedules.filter(schedule => schedule.weekday === weekday && schedule.is_active);
};

export const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isPastDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};
