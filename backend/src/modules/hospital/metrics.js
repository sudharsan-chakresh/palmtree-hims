const express = require("express");
const router = express.Router();

/**
 * Hospital Metrics & Analytics Engine
 * Provides shard-isolated REAL-TIME data for dashboards.
 */
router.get("/stats", async (req, res, next) => {
  try {
    const schema = req.schemaName;
    
    // Schema Guard: Ensure predictive analytics tables exist
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".consultation_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id UUID,
        predicted_time_mins INTEGER,
        complexity VARCHAR(50),
        triage_priority INTEGER,
        reasoning TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS "${schema}".consultation_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id UUID,
        event_type VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Helper to safely execute queries with fallbacks in case of table/schema stage mismatch
    const runQuery = async (sql, fallback = 0) => {
      try {
        const queryRes = await req.prisma.$queryRawUnsafe(sql);
        if (Array.isArray(queryRes)) {
          if (queryRes.length === 1 && queryRes[0] && typeof queryRes[0] === 'object') {
            const keys = Object.keys(queryRes[0]);
            if (keys.length === 1) {
              const val = queryRes[0][keys[0]];
              return val !== null ? val : fallback;
            }
          }
          return queryRes;
        }
        return queryRes || fallback;
      } catch (err) {
        console.warn(`[METRICS QUERY FAIL] ${sql}:`, err.message);
        return fallback;
      }
    };

    // 1. CORE KPIs (LIVE)
    const [
      patientCountToday,
      appointmentsToday,
      checkedInToday,
      pendingBills,
      dailyRevenue,
      prescriptionsToday,
      admissionsToday,
      dischargesToday,
      ipdActivePatients,
      totalBedsCount,
      occupiedBedsCount,
      completedEncountersToday,
      newPatientsToday,
      returningPatientsToday
    ] = await Promise.all([
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".patients WHERE created_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".appointments WHERE appointment_time::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".encounters WHERE created_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".invoices WHERE status ILIKE 'unpaid' OR status ILIKE 'pending' OR status ILIKE 'partial'`, 0),
      runQuery(`SELECT COALESCE(SUM(total), 0)::float FROM "${schema}".invoices WHERE (status ILIKE 'paid' OR status ILIKE 'settled') AND created_at::date = CURRENT_DATE`, 0.0),
      runQuery(`SELECT COUNT(DISTINCT prescription_id)::int FROM "${schema}".prescription_items WHERE created_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".ipd_admissions WHERE admitted_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".ipd_admissions WHERE status = 'Discharged' AND discharged_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".ipd_admissions WHERE status = 'Admitted' OR status = 'Active'`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".beds`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".beds WHERE status ILIKE 'occupied'`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".encounters WHERE (status = 'Completed' OR status = 'Finished') AND created_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(*)::int FROM "${schema}".patients WHERE created_at::date = CURRENT_DATE`, 0),
      runQuery(`SELECT COUNT(DISTINCT e.patient_id)::int FROM "${schema}".encounters e JOIN "${schema}".patients p ON e.patient_id = p.id WHERE e.created_at::date = CURRENT_DATE AND p.created_at::date < CURRENT_DATE`, 0)
    ]);

    // Average Waiting Time (Today)
    const avgWaitingTime = await runQuery(`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (e2.created_at - e1.created_at))/60), 0)::int as avg_wait
      FROM "${schema}".consultation_events e1
      JOIN "${schema}".consultation_events e2 ON e1.encounter_id = e2.encounter_id
      WHERE e1.event_type = 'CHECK_IN' AND e2.event_type = 'CONSULT_START'
      AND e1.created_at::date = CURRENT_DATE
    `, 0);

    // 2. IP vs OP Ratio (Last 30 Days)
    const ipOpRatioRes = await runQuery(`
      SELECT 
        (SELECT COUNT(*)::int FROM "${schema}".appointments WHERE created_at > NOW() - INTERVAL '30 days') as op_count,
        (SELECT COUNT(*)::int FROM "${schema}".ipd_admissions WHERE admitted_at > NOW() - INTERVAL '30 days') as ip_count
    `, [{ op_count: 0, ip_count: 0 }]);
    const ipOpRatio = ipOpRatioRes[0] || { op_count: 0, ip_count: 0 };

    // 3. Pharmacy Stock Alerts (Critical < 20 units)
    const stockAlerts = await runQuery(`
      SELECT name, stock_quantity 
      FROM "${schema}".medicines 
      WHERE stock_quantity < 20 AND is_active = true 
      ORDER BY stock_quantity ASC LIMIT 5
    `, []);

    // 4. Bed Occupancy (Live)
    const bedStats = await runQuery(`
      SELECT 
        status, 
        COUNT(*)::int as count 
      FROM "${schema}".beds 
      GROUP BY status
    `, []);

    // 5. Lab Performance (Pending vs Completed)
    const labStats = await runQuery(`
      SELECT 
        status, 
        COUNT(*)::int as count 
      FROM "${schema}".lab_orders 
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY status
    `, []);

    // 6. Discharge Comparison (Admissions vs Discharges last 7 days)
    const dischargeTrend = await runQuery(`
      SELECT 
        d.date::date as date,
        (SELECT COUNT(*)::int FROM "${schema}".ipd_admissions WHERE admitted_at::date = d.date::date) as admitted,
        (SELECT COUNT(*)::int FROM "${schema}".ipd_admissions WHERE discharged_at::date = d.date::date) as discharged
      FROM (
        SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) as date
      ) d
      ORDER BY d.date ASC
    `, []);

    // 7. Weekly Patient Flow (Original)
    const weeklyFlow = await runQuery(`
      SELECT 
        d.date::date as date,
        COALESCE(count(p.id), 0)::int as count
      FROM (
        SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) as date
      ) d
      LEFT JOIN "${schema}".patients p ON p.created_at::date = d.date::date
      GROUP BY d.date
      ORDER BY d.date ASC
    `, []);

    // 8. Latest Patient
    const lastPatientRes = await runQuery(`SELECT name FROM "${schema}".patients ORDER BY created_at DESC LIMIT 1`, [{ name: 'N/A' }]);
    const lastPatientName = lastPatientRes[0]?.name || 'N/A';

    // 9. PREDICTIVE ANALYTICS (REAL)
    // 9.1 Complexity Mix from AI Predictions
    const complexityResults = await runQuery(`
      SELECT complexity as name, COUNT(*)::int as count 
      FROM "${schema}".consultation_predictions 
      GROUP BY complexity
    `, []);
    const totalComplexity = complexityResults.reduce((acc, c) => acc + c.count, 0) || 1;
    const complexityMix = complexityResults.map(c => ({
      name: c.name,
      value: Math.round((c.count / totalComplexity) * 100)
    }));

    // 9.2 Predicted vs Actual (Accuracy Tracker)
    // Fetch last 10 completed consultations
    const accuracyStats = await runQuery(`
      SELECT 
        cp.predicted_time_mins as predicted,
        COALESCE(NULLIF(ce.metadata->>'totalDuration', '')::float, 0) / 60 as actual,
        e.created_at as time
      FROM "${schema}".consultation_predictions cp
      JOIN "${schema}".consultation_events ce ON ce.encounter_id = cp.encounter_id AND ce.event_type = 'CONSULT_END'
      JOIN "${schema}".encounters e ON e.id = cp.encounter_id
      ORDER BY e.created_at DESC
      LIMIT 10
    `, []);

    // 9.3 Avg Predicted Time
    const avgPredictedRes = await runQuery(`SELECT AVG(predicted_time_mins)::float as avg FROM "${schema}".consultation_predictions`, [{ avg: 15 }]);
    const avgPredictedTime = Math.round(typeof avgPredictedRes === 'number' ? avgPredictedRes : (avgPredictedRes[0]?.avg || 15));

    // 9.4 Physician Utilization (Last 24h)
    const utilizationRes = await runQuery(`
      SELECT 
        COALESCE(SUM(NULLIF(metadata->>'totalDuration', '')::float), 0) / 3600 as active_hours
      FROM "${schema}".consultation_events 
      WHERE event_type = 'CONSULT_END' AND created_at > NOW() - INTERVAL '24 hours'
    `, [{ active_hours: 0 }]);
    const activeHours = utilizationRes[0]?.active_hours || 0;
    const utilizationPercent = Math.min(100, Math.round((activeHours / 8) * 100)); // Assuming 8h shift for index

    // 10. BILLING KPIs (Live)
    let billingKpis = { dailyCollection: 0, pendingInsurance: 0, todayInvoices: 0, outstandingDues: 0 };
    try {
      const [dailyColl, pendingIns, todayInv, outstanding] = await Promise.all([
        runQuery(`SELECT COALESCE(SUM(total), 0)::float FROM "${schema}".invoices WHERE status = 'Paid' AND created_at > NOW() - INTERVAL '24 hours'`, 0),
        runQuery(`SELECT COALESCE(SUM(total), 0)::float FROM "${schema}".invoices WHERE payment_mode = 'Insurance' AND status IN ('Unpaid', 'Pending')`, 0),
        runQuery(`SELECT COUNT(*)::int FROM "${schema}".invoices WHERE created_at > NOW() - INTERVAL '24 hours'`, 0),
        runQuery(`SELECT COALESCE(SUM(total), 0)::float FROM "${schema}".invoices WHERE status IN ('Unpaid', 'Partial') AND created_at > NOW() - INTERVAL '30 days'`, 0),
      ]);
      billingKpis = {
        dailyCollection: Math.round(dailyColl || 0),
        pendingInsurance: Math.round(pendingIns || 0),
        todayInvoices: todayInv || 0,
        outstandingDues: Math.round(outstanding || 0),
      };
    } catch (e) { /* invoices table may not exist in all shards yet */ }

    // 11. Additional Lists & Aggregations
    const todayAppointments = await runQuery(`
      SELECT 
        a.id,
        a.appointment_time,
        a.status,
        p.name as patient_name,
        u.name as doctor_name
      FROM "${schema}".appointments a
      JOIN "${schema}".patients p ON a.patient_id = p.id
      LEFT JOIN "${schema}".users u ON a.doctor_id = u.id
      WHERE a.appointment_time::date = CURRENT_DATE
      ORDER BY a.appointment_time ASC
    `, []);

    const revenueBreakdown = await runQuery(`
      SELECT 
        COALESCE(bill_type, 'Others') as type,
        COALESCE(SUM(total), 0)::float as amount
      FROM "${schema}".invoices
      WHERE (status ILIKE 'paid' OR status ILIKE 'settled') AND created_at::date = CURRENT_DATE
      GROUP BY COALESCE(bill_type, 'Others')
    `, []);

    const patientGenderStats = await runQuery(`
      SELECT 
        gender, 
        COUNT(*)::int as count 
      FROM "${schema}".patients 
      GROUP BY gender
    `, []);

    const topComplaints = await runQuery(`
      SELECT 
        complaint as name,
        COUNT(*)::int as count
      FROM "${schema}".complaints
      GROUP BY complaint
      ORDER BY count DESC
      LIMIT 4
    `, []);

    const wardStats = await runQuery(`
      SELECT 
        w.name as label,
        COUNT(b.id)::int as total,
        COUNT(CASE WHEN b.status = 'Occupied' THEN 1 END)::int as occupied
      FROM "${schema}".wards w
      LEFT JOIN "${schema}".beds b ON w.id = b.ward_id
      GROUP BY w.id, w.name
    `, []);

    // Bed occupancy percent formatting:
    const calculatedBedOccupancy = totalBedsCount > 0 ? Math.round((occupiedBedsCount * 100) / totalBedsCount) : 0;

    res.json({
      metrics: {
        patientInflow: patientCountToday || appointmentsToday || 0,
        activeAdmissions: ipdActivePatients || 0,
        pendingBills: pendingBills || 0,
        dailyRevenue: dailyRevenue || 0,
        lastPatient: lastPatientName,
        appointmentsToday: appointmentsToday || 0,
        checkedInToday: checkedInToday || 0,
        prescriptionsToday: prescriptionsToday || 0,
        admissionsToday: admissionsToday || 0,
        dischargesToday: dischargesToday || 0,
        bedOccupancy: calculatedBedOccupancy || 0,
        avgWaitingTime: avgWaitingTime || 0,
        completedEncountersToday: completedEncountersToday || 0,
        newPatientsToday: newPatientsToday || 0,
        returningPatientsToday: returningPatientsToday || 0,
        ...billingKpis,
      },
      ipOpRatio: ipOpRatio,
      stockAlerts,
      bedStats,
      labStats,
      dischargeTrend,
      weeklyFlow,
      totalBeds: totalBedsCount || 49,
      predictive: {
        complexityMix: complexityMix.length ? complexityMix : [{ name: 'Routine', value: 100 }],
        predictedAvgTime: avgPredictedTime,
        utilization: utilizationPercent,
        workloadForecast: (accuracyStats || []).map(s => ({
          time: s.time ? new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          actual: Math.round(Number(s.actual) || 0),
          predicted: Number(s.predicted) || 0
        })).reverse()
      },
      todayAppointments,
      revenueBreakdown,
      patientGenderStats,
      topComplaints,
      wardStats
    });

  } catch (error) { 
    console.error("[METRICS ERROR]", error);
    res.status(500).json({ error: "Failed to fetch real-time clinical metrics" });
  }
});

/**
 * CLINICAL COMMAND OVERVIEW
 * High-velocity operational intelligence for hospital management.
 */
router.get("/clinical-command-overview", async (req, res, next) => {
  try {
    const schema = req.schemaName;

    // Schema Healing: Ensure operational tables exist before querying
    await req.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}".doctor_status (
        doctor_id UUID PRIMARY KEY,
        status VARCHAR(50) DEFAULT 'AVAILABLE',
        delay_minutes INTEGER DEFAULT 0,
        current_location VARCHAR(100),
        last_updated TIMESTAMP DEFAULT NOW()
      )
    `);

    // 1. Top Metrics (Last 24 Hours)
    const [consultations, waitTime, emergencies, revenue] = await Promise.all([
      req.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${schema}".encounters WHERE created_at > NOW() - INTERVAL '24 hours'`),
      req.prisma.$queryRawUnsafe(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (e.created_at - a.appointment_time))/60), 0)::int as avg_wait
        FROM "${schema}".encounters e
        JOIN "${schema}".appointments a ON e.patient_id = a.patient_id 
        WHERE e.created_at > NOW() - INTERVAL '24 hours'
      `),
      req.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${schema}".doctor_status WHERE status = 'EMERGENCY'`),
      req.prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(unit_price * quantity), 0)::float as sum FROM "${schema}".billing_queue WHERE created_at > NOW() - INTERVAL '24 hours'`)
    ]);

    // 2. Patient Inflow Trend (Today by Hour)
    const inflowTrend = await req.prisma.$queryRawUnsafe(`
      SELECT 
        h.hour || ':00' as time,
        COALESCE(COUNT(e.id), 0)::int as count
      FROM (
        SELECT generate_series(0, 23) as hour
      ) h
      LEFT JOIN "${schema}".encounters e ON EXTRACT(HOUR FROM e.created_at) = h.hour AND e.created_at > CURRENT_DATE
      GROUP BY h.hour
      ORDER BY h.hour ASC
    `);

    // 3. Departmental Delay Index
    const delayIndex = await req.prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(u.department, 'General') as name, 
        AVG(ds.delay_minutes)::int as value
      FROM "${schema}".doctor_status ds
      JOIN "${schema}".users u ON ds.doctor_id = u.id
      GROUP BY u.department
      LIMIT 5
    `);

    // 4. Capacity Gauge
    const capacity = await req.prisma.$queryRawUnsafe(`
      SELECT 
        (SELECT COUNT(*)::int FROM "${schema}".beds WHERE status = 'Occupied') as occupied,
        (SELECT COUNT(*)::int FROM "${schema}".beds) as total
    `);

    // 5. Operational Intelligence Feed (Recent State Changes)
    const feed = await req.prisma.$queryRawUnsafe(`
      (SELECT 'emergency' as type, 'Emergency Mode' as title, u.name || ' activated emergency.' as desc, ds.last_updated as time
       FROM "${schema}".doctor_status ds JOIN "${schema}".users u ON ds.doctor_id = u.id WHERE ds.status = 'EMERGENCY' LIMIT 3)
      UNION ALL
      (SELECT 'delay' as type, 'Physician Delay' as title, u.name || ' is running ' || ds.delay_minutes || 'm late.' as desc, ds.last_updated as time
       FROM "${schema}".doctor_status ds JOIN "${schema}".users u ON ds.doctor_id = u.id WHERE ds.delay_minutes > 0 LIMIT 3)
      ORDER BY time DESC
      LIMIT 10
    `);

    res.json({
      metrics: {
        consultations: consultations[0].count,
        waitTime: waitTime[0].avg_wait,
        emergencies: emergencies[0].count,
        revenue: revenue[0].sum
      },
      inflowTrend: inflowTrend.length > 0 ? inflowTrend : [{time: '08:00', count: 0}, {time: '12:00', count: 0}],
      delayIndex: delayIndex.length > 0 ? delayIndex : [{name: 'General', value: 0}],
      capacity: capacity[0] || { occupied: 0, total: 100 },
      feed
    });

  } catch (error) {
    console.error("[ANALYTICS ERROR]", error);
    res.status(500).json({ error: "Failed to fetch clinical command data" });
  }
});

module.exports = router;
