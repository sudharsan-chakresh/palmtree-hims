import 'package:flutter/material.dart';

class RecordDetailsScreen extends StatelessWidget {
  final String patientName;
  final String date;
  final String reportTitle;

  const RecordDetailsScreen({
    super.key,
    this.patientName = 'MRS. RUKMINI RAUT',
    this.date = '12 Jan 2023',
    this.reportTitle = 'Blood Sample Report',
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Record Details',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Report Header Title
            Text(
              reportTitle,
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1E274F), // Dark blue
              ),
            ),
            const SizedBox(height: 12),
            // Date Banner
            Row(
              children: [
                const Icon(Icons.calendar_today_rounded, color: Color(0xFF64748B), size: 20),
                const SizedBox(width: 8),
                Text(
                  date,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Diagnostic Card Sheet (Resembling printed paper)
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 15,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // DIAGNOSTIC REPORT Label Pill
                  Container(
                    margin: const EdgeInsets.only(top: 16, left: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444), // Red pill
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'DIAGNOSTIC REPORT',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Demographics Section
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Details Column
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildDemoRow('Patient Name', patientName, isName: true),
                              _buildDemoRow('Referral', 'Elite Gastro & Liver Clinic'),
                              _buildDemoRow('Sample Date', 'May 23, 2023'),
                              _buildDemoRow('Age / Gender', '78 Years / Female'),
                            ],
                          ),
                        ),
                        // Barcode/QR Code section
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.qr_code_2_rounded,
                            size: 64,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Double black lines mimicking print separators
                  Container(
                    height: 2,
                    color: Colors.black87,
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                  ),
                  const SizedBox(height: 2),
                  Container(
                    height: 1,
                    color: Colors.black87,
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                  ),
                  const SizedBox(height: 16),

                  // CBC Table Headers
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          flex: 3,
                          child: Text(
                            'Test Description',
                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 13),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            'Value(s)',
                            textAlign: TextAlign.right,
                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 13),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            'Unit',
                            textAlign: TextAlign.right,
                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    height: 1,
                    color: const Color(0xFFE2E8F0),
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                  ),
                  const SizedBox(height: 12),

                  // Table Rows
                  _buildTableCell('WBC', '8890', '/cmm'),
                  _buildTableCell('Neu%', '67.9', '%'),
                  _buildTableCell('Lym%', '26.3', '%'),
                  _buildTableCell('Mon%', '4.7', '%'),
                  _buildTableCell('Eos%', '0.8', '%'),
                  _buildTableCell('Bas%', '0.3', '%'),
                  _buildTableCell('RBC', '4.51', 'x10^12/L'),
                  _buildTableCell('HGB', '12.5', 'g/dL', isBoldValue: true),
                  _buildTableCell('HCT', '38.7', '%'),
                  _buildTableCell('MCV', '86.0', 'fL'),
                  _buildTableCell('MCH', '27.6', 'pg'),
                  _buildTableCell('MCHC', '32.2', 'g/dL'),
                  _buildTableCell('RDW-SD', '44.9', 'fL', isWarning: true),
                  _buildTableCell('PLT', '217000', '/cmm'),
                  _buildTableCell('MPV', '10.6', 'fL'),
                  
                  const SizedBox(height: 24),
                  // End of report text
                  const Center(
                    child: Text(
                      '**END OF REPORT**',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDemoRow(String label, String value, {bool isName = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$label : ',
            style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isName ? FontWeight.w900 : FontWeight.bold,
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTableCell(String test, String value, String unit, {bool isBoldValue = false, bool isWarning = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            flex: 3,
            child: Text(
              test,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade800,
                fontWeight: isBoldValue ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                color: isWarning ? Colors.red : Colors.black87,
                fontWeight: (isBoldValue || isWarning) ? FontWeight.bold : FontWeight.bold,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              unit,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF64748B),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
