'use strict';

const express = require('express');
const { si } = require('../../middleware/sanitize');
const router = express.Router();

function formatTimeField(val) {
  if (!val) return '00:00';
  if (val instanceof Date) {
    try {
      const iso = val.toISOString();
      const parts = iso.split('T');
      if (parts.length > 1) return parts[1].substring(0, 5);
    } catch (e) {}
    return `${String(val.getHours()).padStart(2,'0')}:${String(val.getMinutes()).padStart(2,'0')}`;
  }
  const str = String(val);
  return str.includes(':') ? str.substring(0, 5) : str;
}

function parseTimeToMinutes(val) {
  if (!val) return 0;
  const timeStr = formatTimeField(val);
  const parts = timeStr.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function isSlotOnLeave(dateStr, timeStr, leave) {
  if (!leave.start_date || !leave.end_date) return false;
  const getLocalDateString = (d) => {
    if (d instanceof Date) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return String(d).substring(0, 10);
  };
  const start = getLocalDateString(leave.start_date);
  const end   = getLocalDateString(leave.end_date);
  if (dateStr < start || dateStr > end) return false;
  if (dateStr > start && dateStr < end) return true;
  const isStartDay = dateStr === start;
  const isEndDay   = dateStr === end;
  const slotMins      = parseTimeToMinutes(timeStr);
  const leaveStartMins = leave.start_time ? parseTimeToMinutes(leave.start_time) : 0;
  const leaveEndMins   = leave.end_time   ? parseTimeToMinutes(leave.end_time)   : 24 * 60;
  if (isStartDay && isEndDay) return slotMins >= leaveStartMins && slotMins < leaveEndMins;
  if (isStartDay) return slotMins >= leaveStartMins;
  if (isEndDay)   return slotMins < leaveEndMins;
  return false;
}

async function validateDoctorAvailability(prisma, schemaName, doctor_id, appointment_time, appointment_id = null) {
  const schema  = si(schemaName);
  const dateStr = appointment_time.split('T')[0];
  const timeStr = appointment_time.split('T')[1].substring(0, 5);
  const weekday = new Date(`${dateStr}T${timeStr}:00`).getDay();

  // SECURITY: doctor_id, dateStr are user-controlled — positional params
  const schedules = await prisma.$queryRawUnsafe(
    `SELECT * FROM "${schema}".doctor_schedules WHERE doctor_id = $1::uuid AND weekday = $2 AND is_active = true`,
    String(doctor_id), weekday
  );
  const overrides = await prisma.$queryRawUnsafe(
    `SELECT * FROM "${schema}".doctor_overrides WHERE doctor_id = $1::uuid AND override_date = $2::date`,
    String(doctor_id), dateStr
  );
  const leaves = await prisma.$queryRawUnsafe(
    `SELECT * FROM "${schema}".doctor_leaves WHERE doctor_id = $1::uuid AND start_date <= $2::date AND end_date >= $2::date`,
    String(doctor_id), dateStr
  );

  let slotFound = false, slotIsAvailable = false;
  let slotReason = "Time slot is outside doctor's regular working hours. Please create an override first.";

  schedules.forEach((schedule) => {
    const duration   = schedule.slot_duration || 30;
    const startMins  = parseTimeToMinutes(schedule.start_time);
    const endMins    = parseTimeToMinutes(schedule.end_time);
    let currentMins  = startMins;
    while (currentMins + duration <= endMins) {
      const slotTime = `${Math.floor(currentMins/60).toString().padStart(2,'0')}:${(currentMins%60).toString().padStart(2,'0')}`;
      if (slotTime === timeStr) {
        slotFound = true;
        const leave    = leaves.find(l => isSlotOnLeave(dateStr, slotTime, l));
        const override = overrides.find(o => {
          const slotMins = parseTimeToMinutes(slotTime);
          return slotMins >= parseTimeToMinutes(o.start_time) && slotMins < parseTimeToMinutes(o.end_time);
        });
        if (leave) {
          slotIsAvailable = false;
          slotReason = `Doctor is on leave at this time: ${leave.leave_type || 'Leave'}.`;
        } else if (override) {
          slotIsAvailable = override.is_available;
          slotReason = override.is_available ? 'Available' : `Doctor is explicitly unavailable: ${override.reason || 'Blocked override'}.`;
        } else {
          slotIsAvailable = true;
          slotReason = 'Available';
        }
      }
      currentMins += duration;
    }
  });

  if (!slotFound) return { isValid: false, error: "Selected time does not align with any valid appointment slot boundaries." };
  if (!slotIsAvailable) return { isValid: false, error: slotReason };

  // SECURITY: Double-booking check — all user values as positional params
  let existingRows;
  if (appointment_id) {
    existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "${schema}".appointments WHERE doctor_id = $1::uuid AND appointment_time = $2::timestamptz AND status != 'Cancelled' AND id != $3::uuid`,
      String(doctor_id), appointment_time, String(appointment_id)
    );
  } else {
    existingRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "${schema}".appointments WHERE doctor_id = $1::uuid AND appointment_time = $2::timestamptz AND status != 'Cancelled'`,
      String(doctor_id), appointment_time
    );
  }
  if (existingRows.length > 0) return { isValid: false, error: 'This slot is already booked.' };
  return { isValid: true };
}

router.get('/', async (req, res, next) => {
  try {
    const schema = si(req.schemaName);
    const { doctorId } = req.query;
    let appointments;
    if (doctorId) {
      // SECURITY: doctorId from query param — positional param
      appointments = await req.prisma.$queryRawUnsafe(
        `SELECT a.*, p.name as patient_name, u.name as doctor_name
         FROM "${schema}".appointments a
         JOIN "${schema}".patients p ON a.patient_id = p.id
         JOIN "${schema}".users u ON a.doctor_id = u.id
         WHERE a.doctor_id = $1::uuid
         ORDER BY a.appointment_time ASC`,
        String(doctorId)
      );
    } else {
      appointments = await req.prisma.$queryRawUnsafe(
        `SELECT a.*, p.name as patient_name, u.name as doctor_name
         FROM "${schema}".appointments a
         JOIN "${schema}".patients p ON a.patient_id = p.id
         JOIN "${schema}".users u ON a.doctor_id = u.id
         ORDER BY a.appointment_time ASC`
      );
    }
    res.json(appointments);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { patient_id, doctor_id, appointment_time, status } = req.body;
    const schema = si(req.schemaName);
    const validation = await validateDoctorAvailability(req.prisma, schema, doctor_id, appointment_time);
    if (!validation.isValid) return res.status(400).json({ error: validation.error });

    // SECURITY: All body values as positional params
    const result = await req.prisma.$queryRawUnsafe(
      `INSERT INTO "${schema}".appointments (patient_id, doctor_id, appointment_time, status)
       VALUES ($1::uuid, $2::uuid, $3::timestamptz, $4)
       RETURNING *`,
      String(patient_id), String(doctor_id), appointment_time, String(status || 'Scheduled')
    );
    res.status(201).json(result[0]);
  } catch (error) { next(error); }
});

router.get('/validate', async (req, res, next) => {
  try {
    const { doctorId, appointmentTime } = req.query;
    if (!doctorId || !appointmentTime) return res.status(400).json({ error: 'doctorId and appointmentTime are required' });
    const schema = si(req.schemaName);
    const validation = await validateDoctorAvailability(req.prisma, schema, String(doctorId), String(appointmentTime));
    if (!validation.isValid) return res.status(200).json({ isValid: false, error: validation.error });
    return res.status(200).json({ isValid: true, message: 'Selected slot is available' });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { appointment_time, status } = req.body;
    const schema = si(req.schemaName);
    const apptId = String(req.params.id);

    if (appointment_time) {
      // SECURITY: apptId from URL param — positional param
      const existing = await req.prisma.$queryRawUnsafe(
        `SELECT * FROM "${schema}".appointments WHERE id = $1::uuid`,
        apptId
      );
      if (existing.length === 0) return res.status(404).json({ error: 'Appointment not found.' });
      const validation = await validateDoctorAvailability(req.prisma, schema, existing[0].doctor_id, appointment_time, apptId);
      if (!validation.isValid) return res.status(400).json({ error: validation.error });
    }

    // Build parameterized update
    const params = [];
    const setClauses = [];
    if (appointment_time) { params.push(appointment_time); setClauses.push(`appointment_time = $${params.length}::timestamptz`); }
    if (status)           { params.push(String(status));   setClauses.push(`status = $${params.length}`); }
    if (setClauses.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(apptId);
    const result = await req.prisma.$queryRawUnsafe(
      `UPDATE "${schema}".appointments SET ${setClauses.join(', ')} WHERE id = $${params.length}::uuid RETURNING *`,
      ...params
    );
    res.json(result[0]);
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const schema = si(req.schemaName);
    // SECURITY: id from URL param — positional param
    await req.prisma.$executeRawUnsafe(
      `DELETE FROM "${schema}".appointments WHERE id = $1::uuid`,
      String(req.params.id)
    );
    res.sendStatus(204);
  } catch (error) { next(error); }
});

module.exports = router;
