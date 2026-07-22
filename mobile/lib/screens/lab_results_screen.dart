import 'package:flutter/material.dart';
import '../widgets/breadcrumb.dart';
import 'record_details_screen.dart';

class LabResultsScreen extends StatelessWidget {
  const LabResultsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Diagnostic Center'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Breadcrumb(paths: ['Dashboard', 'Services', 'Laboratory']),
            const SizedBox(height: 24),
            const Text(
              'Recent Lab Reports',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Tap on any report card below to view full clinical details.',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 20),
            _buildReportItem(context, 'Complete Blood Count (CBC)', 'Yesterday', 'Normal', Colors.green),
            _buildReportItem(context, 'Lipid Profile', '3 days ago', 'High Risk', Colors.red),
            _buildReportItem(context, 'Liver Function Test', '1 week ago', 'Pending', Colors.orange),
          ],
        ),
      ),
    );
  }

  Widget _buildReportItem(
      BuildContext context, String title, String date, String status, Color statusColor) {
    Color badgeBgColor;
    Color badgeTextColor;

    switch (status.toLowerCase()) {
      case 'normal':
        badgeBgColor = const Color(0xFFD1FAE5);
        badgeTextColor = const Color(0xFF065F46);
        break;
      case 'pending':
        badgeBgColor = const Color(0xFFFEF3C7);
        badgeTextColor = const Color(0xFFD97706);
        break;
      default: // High Risk / Urgent
        badgeBgColor = const Color(0xFFFEF2F2);
        badgeTextColor = const Color(0xFF991B1B);
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.01),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => RecordDetailsScreen(
                patientName: 'MRS. RUKMINI RAUT',
                date: date == 'Yesterday' ? '10 Jun 2026' : (date == '3 days ago' ? '08 Jun 2026' : '04 Jun 2026'),
                reportTitle: title,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: badgeBgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.biotech_rounded, color: badgeTextColor, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1E293B), fontSize: 14),
                    ),
                    const SizedBox(height: 4),
                    Text(date, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: badgeBgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badgeTextColor),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
