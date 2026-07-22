const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const os = require('os');

const isVercel = !!process.env.VERCEL;
const isAzure = !!process.env.WEBSITE_INSTANCE_ID;

let pdfDir;
if (process.env.STORAGE_PATH) {
  pdfDir = path.join(process.env.STORAGE_PATH, 'patients');
} else if (isAzure) {
  pdfDir = path.join(process.env.HOME || '/home', 'site_uploads', 'patients');
} else if (isVercel) {
  pdfDir = path.join(os.tmpdir(), 'patients');
} else {
  pdfDir = path.join(__dirname, '../../uploads/patients');
}

if (!fs.existsSync(pdfDir)) {
  try {
    fs.mkdirSync(pdfDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create pdf directory:", err);
  }
}

/**
 * Generates a professional Discharge Summary PDF.
 * Saves it to local drive: /patients/<patientId>-<ddmmyy>.pdf
 */
function createDischargeSummaryPDF(patient, admission, summaryText) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '');
      const filename = `${patient.id}-${dateStr}.pdf`;
      const filePath = path.join(pdfDir, filename);
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- HEADER ---
      doc.fontSize(24).font('Helvetica-Bold').text('HOSPITAL DISCHARGE SUMMARY', { align: 'center' });
      doc.moveDown(1);
      
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // --- PATIENT INFO ---
      doc.fontSize(12).font('Helvetica-Bold').text('Patient Information', { underline: true });
      doc.moveDown(0.5);
      
      doc.font('Helvetica').fontSize(10);
      doc.text(`Name: ${patient.name}       MRN: ${patient.mrn}`);
      doc.text(`Age/Gender: ${patient.age} / ${patient.gender}`);
      doc.text(`Phone: ${patient.phone}`);
      doc.moveDown(1);

      // --- ADMISSION INFO ---
      doc.fontSize(12).font('Helvetica-Bold').text('Admission Details', { underline: true });
      doc.moveDown(0.5);
      
      doc.font('Helvetica').fontSize(10);
      doc.text(`Date of Admission: ${new Date(admission.admitted_at).toLocaleDateString()}`);
      doc.text(`Date of Discharge: ${new Date().toLocaleDateString()}`);
      doc.text(`Admitting Ward: ${admission.ward_name} (Bed: ${admission.bed_number})`);
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // --- AI CLINICAL SUMMARY ---
      doc.fontSize(12).font('Helvetica-Bold').text('Clinical Summary', { underline: true });
      doc.moveDown(0.5);
      
      doc.font('Helvetica').fontSize(10);
      // Render the AI text (handles basic newlines)
      doc.text(summaryText, {
        align: 'justify',
        lineGap: 4
      });

      doc.moveDown(3);

      // --- SIGNATURE BLOCK ---
      const bottomY = doc.page.height - 150;
      if (doc.y > bottomY) {
        doc.addPage();
      } else {
        doc.y = bottomY;
      }
      
      doc.font('Helvetica').fontSize(10);
      doc.text('_________________________________', 50, doc.y);
      doc.text('Attending Physician Signature', 50, doc.y + 15);
      
      doc.text('_________________________________', 350, doc.y - 15);
      doc.text('Patient / Guardian Signature', 350, doc.y);

      doc.end();

      stream.on('finish', () => {
        resolve({
          success: true,
          filePath: filePath,
          filename: filename
        });
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

function createPrescriptionPDF(tenantName, prescription, patient, encounter, items) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- HEADER ---
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(tenantName || 'JIOPLIX CLINICS', { align: 'left' });
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Integrated Digital Healthcare Network', { align: 'left' });
      
      doc.y = 50; // align to top right for doctor info
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(`Dr. ${encounter?.doctor_name || 'Consultant Doctor'}`, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Attending Physician', { align: 'right' });
      doc.moveDown(1.5);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(1.5);

      // --- PATIENT INFO CARD ---
      const infoY = doc.y;
      doc.rect(50, infoY, 495, 60).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a');
      
      const dateStr = new Date(prescription.created_at || encounter?.created_at || new Date()).toLocaleDateString('en-GB');
      
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('PATIENT NAME', 65, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(patient?.name || 'Unknown Patient', 65, infoY + 25);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('MRN / ID', 200, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(patient?.mrn || 'N/A', 200, infoY + 25);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('AGE / GENDER', 330, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`${patient?.age || '-'} Yrs / ${patient?.gender || '-'}`, 330, infoY + 25);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('DATE', 460, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(dateStr, 460, infoY + 25);

      doc.y = infoY + 80;

      // Rx Symbol
      doc.fontSize(28).font('Times-BoldItalic').fillColor('#3b82f6').text('Rx', 50, doc.y);
      doc.moveDown(0.5);

      // --- MEDICINES TABLE ---
      const tableTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
      doc.text('MEDICINE NAME', 50, tableTop);
      doc.text('DOSAGE', 230, tableTop);
      doc.text('FREQUENCY', 300, tableTop);
      doc.text('DURATION', 380, tableTop);
      doc.text('INSTRUCTIONS', 450, tableTop);
      
      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#cbd5e1').stroke();
      
      let currentY = tableTop + 25;
      doc.fontSize(10).font('Helvetica').fillColor('#334155');

      if (items.length === 0) {
        doc.text('No medications recorded', 50, currentY, { align: 'center', width: 495 });
      } else {
        items.forEach((m, idx) => {
          doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${idx + 1}. ${m.drug_name}`, 50, currentY);
          doc.font('Helvetica').fillColor('#334155');
          doc.text(m.dosage || '-', 230, currentY);
          doc.text(m.frequency || '-', 300, currentY);
          doc.text(`${m.duration || '-'} Days`, 380, currentY);
          doc.text(m.instructions || '-', 450, currentY, { width: 95 });
          
          doc.moveTo(50, doc.y + 10).lineTo(545, doc.y + 10).strokeColor('#f1f5f9').stroke();
          currentY = doc.y + 20;
        });
      }

      // --- FOOTER ---
      doc.y = doc.page.height - 120;
      doc.moveTo(350, doc.y).lineTo(500, doc.y).strokeColor('#64748b').stroke();
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Authorized Signature', 350, doc.y + 5, { align: 'center', width: 150 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function createLabReportPDF(tenantName, labOrder, patient, results) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- HEADER ---
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(tenantName || 'JIOPLIX DIAGNOSTICS', { align: 'left' });
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Clinical Reference Laboratories', { align: 'left' });
      
      doc.y = 50;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#3b82f6').text('DIAGNOSTIC REPORT', { align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`ID: #${labOrder.id.substring(0, 8).toUpperCase()}`, { align: 'right' });
      doc.moveDown(1.5);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(1.5);

      // --- PATIENT INFO CARD ---
      const infoY = doc.y;
      doc.rect(50, infoY, 495, 60).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a');
      
      const dateStr = new Date(labOrder.created_at || new Date()).toLocaleDateString('en-GB');
      
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('PATIENT NAME', 65, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(patient?.name || 'Unknown Patient', 65, infoY + 25);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('MRN / ID', 200, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(patient?.mrn || 'N/A', 200, infoY + 25);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('AGE / GENDER', 330, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`${patient?.age || '-'} Yrs / ${patient?.gender || '-'}`, 330, infoY + 25);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text('REPORT DATE', 460, infoY + 12);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(dateStr, 460, infoY + 25);

      doc.y = infoY + 80;

      // Investigation title
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(`Investigation: ${labOrder.test_name}`, 50, doc.y);
      doc.moveDown(0.8);

      // --- RESULTS TABLE ---
      const tableTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
      doc.text('TEST PARAMETER', 50, tableTop);
      doc.text('OBSERVED VALUE', 220, tableTop);
      doc.text('NORMAL RANGE', 350, tableTop);
      doc.text('UNIT', 480, tableTop);
      
      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#cbd5e1').stroke();
      
      let currentY = tableTop + 25;
      doc.fontSize(10).font('Helvetica').fillColor('#334155');

      if (results.length === 0) {
        doc.text('Awaiting test authorization / results.', 50, currentY, { align: 'center', width: 495 });
      } else {
        results.forEach((r) => {
          doc.font('Helvetica-Bold').fillColor('#0f172a').text(r.param || 'N/A', 50, currentY);
          doc.text(r.value || 'N/A', 220, currentY);
          doc.font('Helvetica').fillColor('#334155');
          doc.text(r.normalRange || 'N/A', 350, currentY);
          doc.text(r.unit || 'N/A', 480, currentY);
          
          doc.moveTo(50, doc.y + 10).lineTo(545, doc.y + 10).strokeColor('#f1f5f9').stroke();
          currentY = doc.y + 20;
        });
      }

      // --- Remarks Section ---
      if (labOrder.technician_notes) {
        doc.y = currentY + 15;
        doc.rect(50, doc.y, 495, 50).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('TECHNICIAN REMARKS', 65, doc.y + 10);
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#334155').text(`"${labOrder.technician_notes}"`, 65, doc.y + 22, { width: 465 });
        currentY = doc.y + 60;
      }

      // --- FOOTER ---
      doc.y = doc.page.height - 120;
      
      doc.moveTo(50, doc.y).lineTo(180, doc.y).strokeColor('#cbd5e1').stroke();
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Prepared By', 50, doc.y + 5, { align: 'center', width: 130 });

      doc.moveTo(415, doc.y).lineTo(545, doc.y).strokeColor('#cbd5e1').stroke();
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Authorized Signatory', 415, doc.y + 5, { align: 'center', width: 130 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  createDischargeSummaryPDF,
  createPrescriptionPDF,
  createLabReportPDF
};
