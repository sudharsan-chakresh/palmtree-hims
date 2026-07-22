'use strict';

const express = require('express');
const router = express.Router();
const { si } = require('../../middleware/sanitize');

/**
 * Public endpoint: Accept patient complaints/voice notes without doctor auth.
 * Requires `x-tenant-id` header and `patientId` in body or path.
 */
router.post('/patients/:id/complaints', async (req, res, next) => {
  const patientId = req.params.id || req.body.patientId;
  const { complaint, notes } = req.body;

  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  if (!complaint && !notes) return res.status(400).json({ error: 'complaint or notes required' });

  try {
    const schema = si(req.schemaName);

    // SECURITY: patientId from URL/body — positional param
    const patients = await req.prisma.$queryRawUnsafe(
      `SELECT id FROM "${schema}".patients WHERE id = $1::uuid`,
      String(patientId)
    );
    if (!patients || patients.length === 0) return res.status(404).json({ error: 'Patient not found' });

    // SECURITY: notes and complaint text values — positional params
    const encounter = await req.prisma.$queryRawUnsafe(
      `INSERT INTO "${schema}".encounters (patient_id, doctor_id, diagnosis, notes, status, type)
       VALUES ($1::uuid, NULL, '', $2, 'Pending', 'SELF_SERVICE') RETURNING id`,
      String(patientId),
      String(notes || '')
    );

    const encounterId = encounter[0].id;

    await req.prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}".complaints (encounter_id, complaint) VALUES ($1::uuid, $2)`,
      String(encounterId),
      String(complaint || '')
    );

    return res.status(201).json({ message: 'Complaint recorded', encounterId });
  } catch (err) {
    console.error('[PUBLIC COMPLAINT] Error:', err.message);
    return res.status(500).json({ error: 'Failed to record complaint' });
  }
});

module.exports = router;
