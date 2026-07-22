const express = require("express");
const { si } = require('../../middleware/sanitize');
const router = express.Router();

const billingTablesSynced = new Set();

async function ensureBillingTables(req) {
  const schema = req.schemaName;
  if (!schema) return;
  if (billingTablesSynced.has(schema)) return;
  try {
  await req.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      encounter_id UUID,
      bill_type VARCHAR(50),
      payment_mode VARCHAR(50),
      subtotal NUMERIC DEFAULT 0,
      tax_total NUMERIC DEFAULT 0,
      total NUMERIC DEFAULT 0,
      status VARCHAR(50) DEFAULT 'PAID',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "${req.schemaName}".invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL,
      description TEXT,
      quantity NUMERIC DEFAULT 1,
      unit_price NUMERIC DEFAULT 0,
      tax_percent NUMERIC DEFAULT 0,
      amount NUMERIC DEFAULT 0,
      discount_amount NUMERIC DEFAULT 0,
      source_queue_id UUID,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoices ADD COLUMN IF NOT EXISTS insurance_claim_amount NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoices ADD COLUMN IF NOT EXISTS patient_copay_amount NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS description TEXT`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS source_queue_id UUID`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoice_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await req.prisma.$executeRawUnsafe(`ALTER TABLE "${req.schemaName}".invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  } catch (e) {
    console.error(`[BILLING_TABLES] DDL failed for ${schema}:`, e.message);
  }
  billingTablesSynced.add(schema);
}


/**
 * Professional Billing Engine (Hybrid Model)
 * Supports Fixed (Lab/Pharmacy) and Flexible (Consultation/Ward) billing.
 */

// 1. Fetch all pending items from the Clinical Queue for a specific patient
router.get("/queue/:patientId", async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".billing_queue 
      WHERE patient_id = '${patientId}' AND status = 'PENDING'
      ORDER BY created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

// 2. Fetch Billing History (Invoices)
router.get("/history", async (req, res, next) => {
  try {
    await ensureBillingTables(req);
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT i.*, i.total as total_amount, p.name as patient_name, p.mrn as patient_mrn
      FROM "${req.schemaName}".invoices i
      JOIN "${req.schemaName}".patients p ON i.patient_id = p.id
      ORDER BY i.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

// 2. Fetch existing invoices
router.get("/", async (req, res, next) => {
  try {
    await ensureBillingTables(req);
    const { type } = req.query;
    const filter = type ? `WHERE i.bill_type = '${type}'` : '';
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT i.*, p.name as patient_name 
      FROM "${req.schemaName}".invoices i
      JOIN "${req.schemaName}".patients p ON i.patient_id = p.id
      ${filter}
      ORDER BY i.created_at DESC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

// 3. Create Final Invoice (Consumes Queue Items)
router.post("/", async (req, res, next) => {
  try {
    await ensureBillingTables(req);
    const { patientId, encounterId, billType, items, totalAmount, paymentMode, status } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: "Patient selection required." });
    }

    // Ensure dummy walk-in patient exists in the target schema's patients table to satisfy constraints and joins
    if (patientId === '00000000-0000-0000-0000-000000000000') {
      try {
        const patientExists = await req.prisma.$queryRawUnsafe(`
          SELECT id FROM "${req.schemaName}".patients WHERE id = '00000000-0000-0000-0000-000000000000'
        `);
        if (patientExists.length === 0) {
          await req.prisma.$executeRawUnsafe(`
            INSERT INTO "${req.schemaName}".patients (id, mrn, name, phone, gender, age)
            VALUES ('00000000-0000-0000-0000-000000000000', 'GENERAL', 'Walk-in Customer', '', 'N/A', 0)
          `);
        }
      } catch (err) {
        console.error("[BILLING_WALKIN_SEED_ERROR]", err.message);
      }
    }

    // A. Calculate Totals and Tax
    const normalizedItems = (items || []).map((it) => {
      const unitPrice = Number(it.unit_price ?? it.price ?? 0);
      const quantity = Number(it.quantity || 1);
      const taxPercent = Number(it.tax_percent ?? it.tax ?? 0);
      return {
        ...it,
        unit_price: unitPrice,
        quantity,
        tax_percent: taxPercent,
        amount: Number(it.amount ?? unitPrice * quantity)
      };
    });

    const subtotal = normalizedItems.reduce((acc, it) => acc + (it.unit_price * it.quantity), 0);
    const taxTotal = normalizedItems.reduce((acc, it) => acc + (it.unit_price * it.quantity * (it.tax_percent / 100)), 0);
    const totalDiscount = normalizedItems.reduce((acc, it) => acc + (parseFloat(it.discount_amount) || 0), 0);
    const finalTotal = subtotal + taxTotal - totalDiscount;

    // B. Check for Insurance Co-pay
    let copayPercent = 0;
    try {
      const mappings = await req.prisma.$queryRawUnsafe(`
        SELECT copay_percent 
        FROM "${req.schemaName}".insurance_patient_mapping 
        WHERE patient_id = '${patientId}' AND status = 'active'
      `);
      if (mappings.length > 0) {
        copayPercent = mappings[0].copay_percent || 0;
      }
    } catch (e) {
      console.log("[BILLING] No insurance mapping table or error:", e.message);
    }

    const patientCopayAmount = finalTotal * (copayPercent / 100);
    const insuranceClaimAmount = finalTotal - patientCopayAmount;

    // C. Create Invoice Header
    const invHeader = await req.prisma.$queryRawUnsafe(`
      INSERT INTO "${req.schemaName}".invoices (patient_id, encounter_id, bill_type, payment_mode, subtotal, tax_total, total, status, insurance_claim_amount, patient_copay_amount)
      VALUES ('${patientId}', ${encounterId ? `'${encounterId}'` : 'NULL'}, '${billType}', '${paymentMode}', ${subtotal}, ${taxTotal}, ${finalTotal}, '${status || 'PAID'}', ${insuranceClaimAmount}, ${patientCopayAmount})
      RETURNING id
    `);
    
    const invId = invHeader[0].id;

    // C. Batch Insert Line Items
    if (normalizedItems.length > 0) {
      const values = normalizedItems.map(item => {
        const desc = item.description ? item.description.replace(/'/g, "''") : '';
        const sourceQueueId = item.id ? `'${item.id}'` : 'NULL';
        return `('${invId}', '${desc}', ${item.quantity}, ${item.unit_price}, ${item.tax_percent || 0}, ${item.amount}, ${item.discount_amount || 0}, ${sourceQueueId})`;
      }).join(',');
      
      await req.prisma.$executeRawUnsafe(`
        INSERT INTO "${req.schemaName}".invoice_items (invoice_id, description, quantity, unit_price, tax_percent, amount, discount_amount, source_queue_id)
        VALUES ${values}
      `);
    }

    // D. Fetch queue details & perform batch status/source updates
    const itemIds = normalizedItems.map(it => it.id).filter(Boolean);
    if (itemIds.length > 0) {
      const idList = itemIds.map(id => `'${id}'`).join(',');
      
      // 1. Fetch queue items to determine source modules/IDs
      const queueDetails = await req.prisma.$queryRawUnsafe(`
        SELECT id, source_module, source_id 
        FROM "${req.schemaName}".billing_queue 
        WHERE id IN (${idList})
      `);

      // 2. Mark queue items as BILLED in batch
      await req.prisma.$executeRawUnsafe(`
        UPDATE "${req.schemaName}".billing_queue 
        SET status = 'BILLED' 
        WHERE id IN (${idList})
      `);

      // 3. Collect source IDs for LAB and PHARMACY batch updates
      const labIdsToUpdate = [];
      const prescriptionIdsToUpdate = [];
      
      for (const item of queueDetails) {
        if (item.source_id) {
          if (item.source_module === 'LAB') {
            labIdsToUpdate.push(item.source_id);
          } else if (item.source_module === 'PHARMACY') {
            prescriptionIdsToUpdate.push(item.source_id);
          }
        }
      }

      if (labIdsToUpdate.length > 0) {
        const labIdList = labIdsToUpdate.map(id => `'${id}'`).join(',');
        await req.prisma.$executeRawUnsafe(`
          UPDATE "${req.schemaName}".lab_orders 
          SET is_paid = true 
          WHERE diagnostic_id IN (${labIdList}) OR id IN (${labIdList})
        `);
      }

      if (prescriptionIdsToUpdate.length > 0) {
        const rxIdList = prescriptionIdsToUpdate.map(id => `'${id}'`).join(',');
        await req.prisma.$executeRawUnsafe(`
          UPDATE "${req.schemaName}".prescriptions 
          SET is_paid = true 
          WHERE id IN (${rxIdList})
        `);
      }
    }

    res.status(201).json({ id: invId, message: "Professional Invoice finalized and ledger updated." });
  } catch (error) { 
    console.error("[BILLING_ERROR]", error.message);
    next(error); 
  }
});
router.get("/invoices/:id/items", async (req, res, next) => {
  try {
    await ensureBillingTables(req);
    const { id } = req.params;
    const data = await req.prisma.$queryRawUnsafe(`
      SELECT * FROM "${req.schemaName}".invoice_items 
      WHERE invoice_id = '${id}'
      ORDER BY created_at ASC
    `);
    res.json(data);
  } catch (error) { next(error); }
});

module.exports = router;
// Trigger reload for nodemon
