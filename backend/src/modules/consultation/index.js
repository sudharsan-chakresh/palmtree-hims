'use strict';

const express = require('express');
const { si } = require('../../middleware/sanitize');
const router = express.Router();
const aiService = require('../../services/aiService');

// ─── AI CONSULTATION ADVISOR ─────────────────────────────────────────────────
router.post('/ai-suggest', async (req, res, next) => {
  const { patientId, complaints } = req.body;
  try {
    const schema = si(req.schemaName);
    // SECURITY: patientId from body — positional param
    const patients = await req.prisma.$queryRawUnsafe(
      `SELECT * FROM "${schema}".patients WHERE id = $1::uuid`,
      String(patientId)
    );
    if (!patients.length) return res.status(404).json({ error: 'Patient not found' });

    const medicines   = await req.prisma.$queryRawUnsafe(`SELECT name FROM "${schema}".medicines WHERE COALESCE(is_active, true) = true`);
    const diagnostics = await req.prisma.$queryRawUnsafe(`SELECT name FROM "${schema}".diagnostics`);

    const advice = await aiService.generateClinicalAdvice(patients[0], complaints, { medicines, diagnostics });
    if (advice && advice.error === 'RATE_LIMIT_EXCEEDED') return res.status(429).json(advice);
    res.json(advice);
  } catch (error) {
    console.error('[AI-SUGGEST] Error:', error);
    res.status(500).json({ error: 'AI Suggestion failed' });
  }
});

// ─── AI NOTE SUMMARIZER ───────────────────────────────────────────────────────
router.post('/summarize-note', async (req, res, next) => {
  const { note } = req.body;
  try {
    const result = await aiService.summarizeClinicalNote(note || '');
    res.json(result);
  } catch (error) {
    console.error('[AI-SUMMARIZE] Error:', error);
    res.status(500).json({ error: 'Summary failed' });
  }
});

// ─── PREDICTIVE ANALYSIS ──────────────────────────────────────────────────────
router.post('/predict', async (req, res, next) => {
  const { patientId, complaints, doctorId } = req.body;
  try {
    const schema = si(req.schemaName);
    // SECURITY: patientId, doctorId from body — positional params
    const patients = await req.prisma.$queryRawUnsafe(
      `SELECT * FROM "${schema}".patients WHERE id = $1::uuid`,
      String(patientId)
    );
    if (!patients.length) return res.status(404).json({ error: 'Patient not found' });

    const doctorData = await req.prisma.$queryRawUnsafe(
      `SELECT name, specialization FROM "${schema}".users WHERE id = $1::uuid`,
      String(doctorId)
    );

    const prediction = await aiService.predictConsultationMetrics(patients[0], complaints, doctorData[0] || {});

    try {
      const encounterId = req.body.encounterId || null;
      if (encounterId) {
        await req.prisma.$executeRawUnsafe(
          `INSERT INTO "${schema}".consultation_predictions (encounter_id, predicted_time_mins, complexity, triage_priority, reasoning)
           VALUES ($1::uuid, $2, $3, $4, $5)`,
          String(encounterId),
          prediction.predictedTimeMins,
          String(prediction.complexity || ''),
          prediction.triagePriority,
          String(prediction.reasoning || '')
        );
      }
    } catch (e) { console.warn('[PREDICT] Persistence failed:', e.message); }

    res.json(prediction);
  } catch (error) {
    console.error('[PREDICT] Error:', error);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

// ─── CONSULTATION EVENT TRACKER ───────────────────────────────────────────────
router.post('/events', async (req, res, next) => {
  const { encounterId, eventType, metadata } = req.body;
  try {
    const schema = si(req.schemaName);
    // SECURITY: encounterId, eventType from body — positional params
    await req.prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}".consultation_events (encounter_id, event_type, metadata)
       VALUES ($1::uuid, $2, $3::jsonb)`,
      String(encounterId),
      String(eventType),
      JSON.stringify(metadata || {})
    );
    res.json({ success: true, message: `Event ${eventType} recorded.` });
  } catch (error) {
    console.error('[EVENT] Error:', error.message);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// ─── ATOMIC OPD CONSULTATION SYNC ────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const { patientId, doctorId, diagnosis, notes, vitals, complaints, prescriptions, followUpDate } = req.body;
  try {
    console.log(`[OPD] Starting consultation sync for Patient: ${patientId}`);
    const schema = si(req.schemaName);

    // 1. Create Main Encounter — SECURITY: all values as positional params
    const encounter = await req.prisma.$queryRawUnsafe(
      `INSERT INTO "${schema}".encounters (patient_id, doctor_id, diagnosis, notes, status, type, vitals)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'Completed', 'OPD', $5::jsonb)
       RETURNING id`,
      String(patientId),
      String(doctorId),
      String(diagnosis || ''),
      String(notes || ''),
      vitals ? JSON.stringify(vitals) : null
    );
    const encounterId = encounter[0].id;

    // 2. Save Complaints
    if (Array.isArray(complaints)) {
      for (const msg of complaints) {
        await req.prisma.$executeRawUnsafe(
          `INSERT INTO "${schema}".complaints (encounter_id, complaint) VALUES ($1::uuid, $2)`,
          String(encounterId), String(msg || '')
        );
      }
    }

    // 3. Save Prescriptions
    let createdPrescriptionId = null;
    if (Array.isArray(prescriptions) && prescriptions.length) {
      const presHeader = await req.prisma.$queryRawUnsafe(
        `INSERT INTO "${schema}".prescriptions (encounter_id, status) VALUES ($1::uuid, 'Pending') RETURNING id`,
        String(encounterId)
      );
      createdPrescriptionId = presHeader[0]?.id;

      for (const p of prescriptions) {
        const drugName  = String(p.drugName  || '');
        const dosage    = String(p.dosage    || '');
        const frequency = String(p.frequency || '');
        const duration  = String(p.duration  || '');

        // SECURITY: drug name in ILIKE search — positional param
        const med = await req.prisma.$queryRawUnsafe(
          `SELECT id FROM "${schema}".medicines WHERE name ILIKE $1 LIMIT 1`,
          `%${drugName}%`
        );
        const medicineId = med[0]?.id || null;

        await req.prisma.$executeRawUnsafe(
          `INSERT INTO "${schema}".prescription_items (prescription_id, medicine_id, drug_name, dosage, frequency, duration)
           VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
          String(createdPrescriptionId),
          medicineId ? String(medicineId) : null,
          drugName, dosage, frequency, duration
        );
      }
    }

    // 4. Schedule Follow-up
    if (followUpDate) {
      await req.prisma.$executeRawUnsafe(
        `INSERT INTO "${schema}".follow_ups (patient_id, encounter_id, scheduled_date)
         VALUES ($1::uuid, $2::uuid, $3::date)`,
        String(patientId), String(encounterId), String(followUpDate)
      );
      try {
        const patientRow = await req.prisma.$queryRawUnsafe(
          `SELECT phone FROM "${schema}".patients WHERE id = $1::uuid`, String(patientId)
        );
        let doctorPhone = null;
        try {
          const docRow = await req.prisma.$queryRawUnsafe(
            `SELECT phone FROM "${schema}".users WHERE id = $1::uuid LIMIT 1`, String(doctorId)
          );
          doctorPhone = docRow[0]?.phone || null;
        } catch {}

        await req.prisma.$executeRawUnsafe(
          `INSERT INTO "${schema}".reminder_tracker
             (follow_up_id, patient_id, doctor_id, patient_phone, doctor_phone, scheduled_date, reminder_type, channel, follow_up_status)
           VALUES (
             (SELECT id FROM "${schema}".follow_ups WHERE encounter_id = $1::uuid ORDER BY created_at DESC LIMIT 1),
             $2::uuid, $3::uuid, $4, $5, $6::date, 'BOTH', 'SMS', 'PENDING'
           )`,
          String(encounterId), String(patientId), String(doctorId),
          patientRow[0]?.phone || null, doctorPhone,
          String(followUpDate)
        );
      } catch (e) {
        console.warn('[OPD] Reminder tracker creation skipped:', e.message);
      }
    }

    // 5. Push to Billing Queue
    const doctorData = await req.prisma.$queryRawUnsafe(
      `SELECT u.name, s.base_consultation_fee as fee
       FROM "${schema}".users u
       LEFT JOIN "${schema}".specialities s ON u.specialization = s.name
       WHERE u.id = $1::uuid`,
      String(doctorId)
    );
    const fee = doctorData[0]?.fee || 500;
    const billingDesc = `Consultation: ${doctorData[0]?.name || 'Doctor'}`;

    await req.prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}".billing_queue (patient_id, encounter_id, source_module, source_id, description, unit_price, is_discountable)
       VALUES ($1::uuid, $2::uuid, 'CONSULTATION', $3::uuid, $4, $5, TRUE)`,
      String(patientId), String(encounterId), String(doctorId), billingDesc, fee
    );

    if (Array.isArray(prescriptions)) {
      for (const p of prescriptions) {
        const drugSearch = `%${p.drugName || ''}%`;
        const medData = await req.prisma.$queryRawUnsafe(
          `SELECT unit_price FROM "${schema}".medicines WHERE name ILIKE $1 LIMIT 1`, drugSearch
        );
        const price = medData[0]?.unit_price || 0;
        const medicineDesc = `Medicine: ${p.drugName || ''}`;
        await req.prisma.$executeRawUnsafe(
          `INSERT INTO "${schema}".billing_queue (patient_id, encounter_id, source_module, source_id, description, unit_price, is_discountable)
           VALUES ($1::uuid, $2::uuid, 'PHARMACY', $3, $4, $5, FALSE)`,
          String(patientId), String(encounterId),
          createdPrescriptionId ? String(createdPrescriptionId) : null,
          medicineDesc, price
        );
      }
    }

    res.status(201).json({ message: 'Consultation finalized and pushed to Billing Queue', encounterId });
  } catch (error) {
    console.error('[OPD] Sync Failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET CONSULTATIONS ────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const schema = si(req.schemaName);
    const encounters = await req.prisma.$queryRawUnsafe(
      `SELECT e.*, p.name as patient_name
       FROM "${schema}".encounters e
       JOIN "${schema}".patients p ON e.patient_id = p.id
       ORDER BY e.created_at DESC`
    );
    res.json(encounters);
  } catch (error) { next(error); }
});

module.exports = router;