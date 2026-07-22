import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/appointment.dart';
import '../services/api_service.dart';
import 'telehealth_screen.dart';
import 'voice_note_screen.dart';

class PatientRecordScreen extends ConsumerStatefulWidget {
  final Appointment? appointment;
  final String patientName;
  final String? fallbackDoctorId;
  final bool? isPatientView;

  PatientRecordScreen({
    super.key,
    this.appointment,
    String? patientName,
    this.fallbackDoctorId,
    this.isPatientView,
  }) : patientName = patientName ?? appointment?.patientName ?? 'Patient';

  @override
  ConsumerState<PatientRecordScreen> createState() => _PatientRecordScreenState();
}

class _PatientRecordScreenState extends ConsumerState<PatientRecordScreen> {
  bool _isLoading = true;
  String? _error;
  dynamic _patientDetails;
  List<dynamic> _timeline = [];
  bool _isPatient = false;
  String? _activeEncounterId;

  // Vitals State
  String _bp = '120/80';
  String _temp = '98.6';
  String _weight = '72';
  String _spo2 = '98';
  bool _hasCustomVitals = false;

  @override
  void initState() {
    super.initState();
    _checkRoleAndData();
  }

  Future<void> _checkRoleAndData() async {
    if (widget.isPatientView != null) {
      _isPatient = widget.isPatientView!;
    } else {
      try {
        final prefs = await SharedPreferences.getInstance();
        final role = prefs.getString('user_role')?.toLowerCase();
        _isPatient = role == null || role.contains('patient');
      } catch (e) {
        _isPatient = true;
      }
    }
    await _loadPatientData();
  }

  Future<void> _loadPatientData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiServiceProvider);

      // Determine patientId
      String? id = widget.appointment?.patientId;

      // If we don't have patientId from appointment, search for patients list
      if (id == null || id.isEmpty) {
        final patientsRes = await api.getPatients();
        if (patientsRes.statusCode == 200 && patientsRes.data is List && (patientsRes.data as List).isNotEmpty) {
          final list = patientsRes.data as List;
          final match = list.firstWhere(
            (p) => p['name']?.toString().toLowerCase() == widget.patientName.toLowerCase(),
            orElse: () => list.first,
          );
          id = match['id']?.toString();
        }
      }

      // If still null, use the hardcoded seeded patient ID
      id ??= '71820db3-f8f1-4294-8c11-1dc66ab1056e';

      // 1. Fetch patient profile details
      try {
        final profileRes = await api.getPatientDetails(id);
        if (profileRes.statusCode == 200) {
          _patientDetails = profileRes.data;
        }
      } catch (e) {
        debugPrint('Profile fetch error: $e');
      }

      // 2. Fetch timeline
      final timelineRes = await api.getPatientTimeline(id);
      if (timelineRes.statusCode == 200 && timelineRes.data is List) {
        _timeline = timelineRes.data as List;
        _extractLatestVitals(_timeline);
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('General fetch error: $e');
      if (mounted) {
        setState(() {
          _error = 'Live data stream unavailable. Offline snapshot active.';
          _isLoading = false;
          _timeline = _getMockTimeline();
          _extractLatestVitals(_timeline);
        });
      }
    }
  }

  void _extractLatestVitals(List<dynamic> timelineItems) {
    _activeEncounterId = null;
    for (final item in timelineItems) {
      if (item['type'] == 'OPD Consultation' && item['details'] != null) {
        final details = item['details'];
        if (details['status'] == 'Active' && _activeEncounterId == null) {
          _activeEncounterId = item['id']?.toString();
        }
        final vitals = details['vitals'];
        if (vitals != null && vitals is Map && !_hasCustomVitals) {
          setState(() {
            _bp = vitals['bp']?.toString() ?? '120/80';
            final tempVal = vitals['temp'] ?? vitals['temperature'];
            _temp = tempVal?.toString() ?? '98.6';
            final weightVal = vitals['weight'] ?? vitals['wt'];
            _weight = weightVal?.toString() ?? '72';
            _spo2 = vitals['spo2']?.toString() ?? '98';
            _hasCustomVitals = true;
          });
        }
      }
    }
  }

  List<dynamic> _getMockTimeline() {
    return [
      {
        'type': 'OPD Consultation',
        'date': '2026-05-12T10:30:00Z',
        'author': 'Dr. Selva',
        'note': 'Patient complained of mild fever and dry cough. Prescribed Paracetamol and rest.',
        'details': {
          'diagnosis': 'Mild viral fever',
          'vitals': {
            'bp': '120/80',
            'temp': '98.6',
            'weight': '72',
            'spo2': '98'
          }
        }
      },
      {
        'type': 'Lab Report',
        'date': '2026-05-10T09:00:00Z',
        'author': 'Diagnostic Lab',
        'note': 'Complete Blood Count (CBC) - All parameters within normal range.',
        'details': {
          'testName': 'Complete Blood Count (CBC)',
          'status': 'Published',
          'priority': 'Normal'
        }
      },
      {
        'type': 'Admission',
        'date': '2026-01-15T18:45:00Z',
        'author': 'Emergency',
        'note': 'Admitted for acute gastroenteritis. Discharged after 2 days.',
        'details': {
          'wardName': 'General Ward',
          'bedNumber': 'G-12',
          'reason': 'Acute gastroenteritis',
          'status': 'Discharged'
        }
      }
    ];
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return 'N/A';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    final pName = _patientDetails != null
        ? (_patientDetails['name']?.toString() ?? widget.patientName)
        : widget.patientName;
    final mrn = _patientDetails != null
        ? (_patientDetails['mrn']?.toString() ?? 'MRN-2405-001243')
        : 'MRN-2405-001243';
    final gender = _patientDetails != null
        ? (_patientDetails['gender']?.toString() ?? 'Male')
        : 'Male';
    final age = _patientDetails != null
        ? (_patientDetails['age']?.toString() ?? '38')
        : '38';
    final abhaVerified = _patientDetails != null &&
        (_patientDetails['abha_verified'] == true || _patientDetails['abha_verified'] == 1);

    return Scaffold(
      backgroundColor: const Color(0xFFf8fafc),
      appBar: AppBar(
        title: const Text('Patient Record'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1e293b),
        actions: [
          IconButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => TelehealthScreen(
                    patientName: pName,
                    appointmentId: widget.appointment?.id,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.video_call, color: Color(0xFF0284c7)),
            tooltip: 'Start tele-health',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadPatientData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFCD34D)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, color: Color(0xFFD97706), size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: Color(0xFF92400E),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Patient Header
                    Row(
                      children: [
                        const CircleAvatar(
                          radius: 30,
                          backgroundColor: Color(0xFFe0f2fe),
                          child: Icon(Icons.person, size: 35, color: Color(0xFF0284c7)),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      pName,
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF1e293b),
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (abhaVerified) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFeff6ff),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: const Color(0xFFbfdbfe), width: 0.5),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.verified, size: 10, color: Color(0xFF1d4ed8)),
                                          SizedBox(width: 3),
                                          Text(
                                            'ABHA',
                                            style: TextStyle(
                                              fontSize: 8,
                                              fontWeight: FontWeight.w900,
                                              color: Color(0xFF1d4ed8),
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ]
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$mrn • $gender • ${age}y',
                                style: const TextStyle(
                                  color: Color(0xFF64748b),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // Vitals Section
                    const Text(
                      'LATEST VITALS',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                        color: Color(0xFF64748b),
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildVitalCard('BP', _bp, 'mmHg', Colors.red, _hasCustomVitals),
                          _buildVitalCard('Temp', _temp, '°F', Colors.orange, _hasCustomVitals),
                          _buildVitalCard('Weight', _weight, 'kg', Colors.green, _hasCustomVitals),
                          _buildVitalCard('SPO2', _spo2, '%', Colors.blue, _hasCustomVitals),
                        ],
                      ),
                    ),

                    // Medical Advisories Section (Dynamic)
                    if (_patientDetails != null &&
                        ((_patientDetails['allergies']?.toString().isNotEmpty ?? false) ||
                            (_patientDetails['medical_history']?.toString().isNotEmpty ?? false))) ...[
                      const SizedBox(height: 32),
                      const Text(
                        'CLINICAL ADVISORIES',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          color: Color(0xFF64748b),
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFFFE4E6)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_patientDetails['allergies']?.toString().isNotEmpty ?? false) ...[
                              Row(
                                children: [
                                  const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFE11D48)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Allergies: ${_patientDetails['allergies']}',
                                      style: const TextStyle(
                                        color: Color(0xFF9F1239),
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (_patientDetails['medical_history']?.toString().isNotEmpty ?? false)
                                const SizedBox(height: 8),
                            ],
                            if (_patientDetails['medical_history']?.toString().isNotEmpty ?? false) ...[
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.history_edu_outlined, size: 18, color: Color(0xFF475569)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Medical History: ${_patientDetails['medical_history']}',
                                      style: const TextStyle(
                                        color: Color(0xFF334155),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],

                    if (!_isPatient) ...[
                      const SizedBox(height: 32),
                      const Text(
                        'CLINICAL ORDER DESK',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          color: Color(0xFF64748b),
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: _buildOrderButton(
                              icon: Icons.local_hospital_outlined,
                              label: 'Prescribe',
                              color: const Color(0xFF10b981),
                              onPressed: _showPrescribeModal,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildOrderButton(
                              icon: Icons.biotech_outlined,
                              label: 'Order Lab',
                              color: const Color(0xFF6366f1),
                              onPressed: _showOrderLabModal,
                            ),
                          ),
                        ],
                      ),
                    ],

                    const SizedBox(height: 32),
                    const Text(
                      'CLINICAL TIMELINE',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                        color: Color(0xFF64748b),
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Timeline Items (Dynamic)
                    if (_timeline.isEmpty) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Center(
                          child: Text(
                            'No clinical events recorded.',
                            style: TextStyle(color: Color(0xFF64748b), fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ] else ...[
                      Column(
                        children: _timeline
                            .map((item) => _buildTimelineCard(item))
                            .toList(),
                      ),
                    ],
                    const SizedBox(height: 60),
                  ],
                ),
              ),
            ),
      // Floating AI Action
      floatingActionButton: _isPatient
          ? null
          : FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => VoiceNoteScreen(
                      patientName: pName,
                      patientId: widget.appointment?.patientId ?? _patientDetails?['id']?.toString(),
                      doctorId: widget.appointment?.doctorId ?? widget.fallbackDoctorId,
                      appointmentId: widget.appointment?.id.startsWith('demo-') == true
                          ? null
                          : widget.appointment?.id,
                      encounterId: _activeEncounterId,
                    ),
                  ),
                );
              },
              backgroundColor: const Color(0xFF0284c7),
              icon: const Icon(Icons.mic, color: Colors.white),
              label: const Text(
                'AI VOICE NOTE',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
    );
  }

  bool _isBPAbnormal(String bp) {
    final parts = bp.split('/');
    if (parts.length == 2) {
      final sys = int.tryParse(parts[0].trim());
      final dia = int.tryParse(parts[1].trim());
      if (sys != null && dia != null) {
        return sys > 130 || sys < 90 || dia > 85 || dia < 60;
      }
    }
    return false;
  }

  bool _isTempAbnormal(String temp) {
    final val = double.tryParse(temp.trim());
    if (val != null) {
      return val > 99.0 || val < 96.0;
    }
    return false;
  }

  bool _isSpo2Abnormal(String spo2) {
    final val = int.tryParse(spo2.trim());
    if (val != null) {
      return val < 95;
    }
    return false;
  }

  Widget _buildVitalCard(String label, String value, String unit, Color baseColor, bool isDynamic) {
    bool isAbnormal = false;
    if (label.toLowerCase() == 'bp') {
      isAbnormal = _isBPAbnormal(value);
    } else if (label.toLowerCase().contains('temp')) {
      isAbnormal = _isTempAbnormal(value);
    } else if (label.toLowerCase() == 'spo2') {
      isAbnormal = _isSpo2Abnormal(value);
    }

    Color color = isAbnormal ? const Color(0xFFEF4444) : baseColor;

    return Container(
      width: 104,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isAbnormal ? const Color(0xFFFEF2F2) : color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isAbnormal ? const Color(0xFFFCA5A5) : color.withValues(alpha: isDynamic ? 0.3 : 0.1),
          width: isAbnormal ? 1.5 : (isDynamic ? 1.5 : 1.0),
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isAbnormal ? const Color(0xFFB91C1C) : color,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                ),
              ),
              if (isAbnormal) ...[
                const SizedBox(width: 4),
                const Icon(Icons.warning_amber_rounded, size: 10, color: Color(0xFFB91C1C)),
              ] else if (isDynamic) ...[
                const SizedBox(width: 4),
                Icon(Icons.bolt, size: 10, color: color),
              ]
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 18,
              color: isAbnormal ? const Color(0xFF991B1B) : const Color(0xFF1E293B),
            ),
          ),
          Text(
            unit,
            style: TextStyle(
              fontSize: 10,
              color: isAbnormal ? const Color(0xFFEF4444) : const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineCard(dynamic item) {
    final type = item['type'] ?? 'OPD Consultation';
    final dateStr = _formatDate(item['date']);
    final author = item['author'] ?? 'Dr. Practitioner';
    final note = item['note'] ?? '';

    Color typeColor = const Color(0xFF0284c7);
    IconData typeIcon = Icons.medical_services_outlined;

    if (type == 'Lab Report') {
      typeColor = const Color(0xFF6366f1);
      typeIcon = Icons.biotech_outlined;
    } else if (type == 'Admission') {
      typeColor = const Color(0xFF10b981);
      typeIcon = Icons.hotel_outlined;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: typeColor.withValues(alpha: 0.3), width: 1),
                ),
                child: Icon(typeIcon, size: 16, color: typeColor),
              ),
              Container(width: 2, height: 90, color: const Color(0xFFe2e8f0)),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFe2e8f0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        type,
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          color: typeColor,
                        ),
                      ),
                      Text(
                        dateStr,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF94a3b8),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'By $author',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF1e293b),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    note,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF475569),
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return ElevatedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, color: Colors.white, size: 16),
      label: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 0,
      ),
    );
  }

  Future<void> _ensureActiveEncounter() async {
    if (_activeEncounterId == null || _activeEncounterId!.isEmpty) {
      try {
        final api = ref.read(apiServiceProvider);
        final pId = widget.appointment?.patientId ?? _patientDetails?['id']?.toString() ?? '71820db3-f8f1-4294-8c11-1dc66ab1056e';
        final dId = widget.appointment?.doctorId ?? widget.fallbackDoctorId ?? 'doc-1';
        final encRes = await api.createActiveEncounter({
          'patientId': pId,
          'doctorId': dId,
          'type': 'OPD',
          'vitals': {
            'bp': _bp,
            'temp': double.tryParse(_temp) ?? 98.6,
            'weight': double.tryParse(_weight) ?? 70.0,
            'pulse': 72
          },
          'complaints': widget.appointment?.symptoms ?? 'Clinical evaluation'
        });
        if (encRes.statusCode == 200 || encRes.statusCode == 201) {
          final data = encRes.data;
          _activeEncounterId = data is Map ? data['id']?.toString() : null;
        }
      } catch (e) {
        debugPrint('Self-healing encounter failed: $e');
      }
    }
  }

  void _showPrescribeModal() async {
    await _ensureActiveEncounter();
    if (!mounted) return;
    if (_activeEncounterId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot create active encounter. Checkout offline.'), backgroundColor: Colors.orange),
      );
      return;
    }

    final List<Map<String, dynamic>> localItems = [];
    final nameCtrl = TextEditingController();
    String dosage = '1-0-1';
    String duration = '5 Days';
    String frequency = 'Twice daily';
    final instCtrl = TextEditingController(text: 'After food');
    bool submitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                left: 24,
                right: 24,
                top: 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Prescribe Medications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Medicine list
                    if (localItems.isNotEmpty) ...[
                      const Text('Medicines Added:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Column(
                        children: localItems.asMap().entries.map((entry) {
                          final idx = entry.key;
                          final it = entry.value;
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            title: Text(it['medicine_name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text('${it['dosage']} • ${it['duration']} • ${it['frequency']} (${it['instructions']})'),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete, size: 16, color: Colors.red),
                              onPressed: () {
                                setModalState(() {
                                  localItems.removeAt(idx);
                                });
                              },
                            ),
                          );
                        }).toList(),
                      ),
                      const Divider(),
                    ],
                    // Input fields for one medicine
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Medicine / Drug Name', hintText: 'e.g. Paracetamol 650mg'),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: dosage,
                            decoration: const InputDecoration(labelText: 'Dosage'),
                            items: const [
                              DropdownMenuItem(value: '1-0-1', child: Text('1-0-1')),
                              DropdownMenuItem(value: '1-1-1', child: Text('1-1-1')),
                              DropdownMenuItem(value: '1-0-0', child: Text('1-0-0')),
                              DropdownMenuItem(value: '0-0-1', child: Text('0-0-1')),
                            ],
                            onChanged: (v) => setModalState(() => dosage = v!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: duration,
                            decoration: const InputDecoration(labelText: 'Duration'),
                            items: const [
                              DropdownMenuItem(value: '3 Days', child: Text('3 Days')),
                              DropdownMenuItem(value: '5 Days', child: Text('5 Days')),
                              DropdownMenuItem(value: '7 Days', child: Text('7 Days')),
                              DropdownMenuItem(value: '10 Days', child: Text('10 Days')),
                              DropdownMenuItem(value: '1 Month', child: Text('1 Month')),
                            ],
                            onChanged: (v) => setModalState(() => duration = v!),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: frequency,
                            decoration: const InputDecoration(labelText: 'Frequency'),
                            items: const [
                              DropdownMenuItem(value: 'Twice daily', child: Text('Twice daily')),
                              DropdownMenuItem(value: 'Thrice daily', child: Text('Thrice daily')),
                              DropdownMenuItem(value: 'Once daily', child: Text('Once daily')),
                              DropdownMenuItem(value: 'Every 8 hours', child: Text('Every 8 hours')),
                            ],
                            onChanged: (v) => setModalState(() => frequency = v!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: instCtrl,
                            decoration: const InputDecoration(labelText: 'Instructions'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: () {
                        if (nameCtrl.text.trim().isEmpty) return;
                        setModalState(() {
                          localItems.add({
                            'medicine_name': nameCtrl.text.trim(),
                            'dosage': dosage,
                            'duration': duration,
                            'frequency': frequency,
                            'instructions': instCtrl.text.trim(),
                            'unit_price': 15.0
                          });
                          nameCtrl.clear();
                        });
                      },
                      icon: const Icon(Icons.add),
                      label: const Text('Add to Prescription'),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: submitting || localItems.isEmpty
                          ? null
                          : () async {
                              setModalState(() => submitting = true);
                              try {
                                final api = ref.read(apiServiceProvider);
                                final res = await api.createPrescription(_activeEncounterId!, localItems);
                                if (res.statusCode == 200 || res.statusCode == 201) {
                                  if (context.mounted) {
                                    Navigator.pop(context);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Prescription dispatch complete! Billed to pharmacy desk.'), backgroundColor: Colors.green),
                                    );
                                  }
                                  _loadPatientData();
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Prescription failed: $e')));
                                }
                              } finally {
                                setModalState(() => submitting = false);
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10b981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: submitting
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('DISPATCH PRESCRIPTION', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showOrderLabModal() async {
    await _ensureActiveEncounter();
    if (!mounted) return;
    if (_activeEncounterId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot create active encounter. Checkout offline.'), backgroundColor: Colors.orange),
      );
      return;
    }

    String selectedTest = 'Complete Blood Count (CBC)';
    String priority = 'Normal';
    bool submitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                left: 24,
                right: 24,
                top: 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Order Diagnostic Lab Test', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                      IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: selectedTest,
                    decoration: const InputDecoration(labelText: 'Select Investigation'),
                    items: const [
                      DropdownMenuItem(value: 'Complete Blood Count (CBC)', child: Text('Complete Blood Count (CBC)')),
                      DropdownMenuItem(value: 'Random Blood Sugar (RBS)', child: Text('Random Blood Sugar (RBS)')),
                      DropdownMenuItem(value: 'Liver Function Test (LFT)', child: Text('Liver Function Test (LFT)')),
                      DropdownMenuItem(value: 'Thyroid Profile (T3, T4, TSH)', child: Text('Thyroid Profile (T3, T4, TSH)')),
                      DropdownMenuItem(value: 'Urinalysis', child: Text('Urinalysis')),
                      DropdownMenuItem(value: 'Lipid Profile', child: Text('Lipid Profile')),
                    ],
                    onChanged: (v) => setModalState(() => selectedTest = v!),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: priority,
                    decoration: const InputDecoration(labelText: 'Priority Level'),
                    items: const [
                      DropdownMenuItem(value: 'Normal', child: Text('Normal (Routine)')),
                      DropdownMenuItem(value: 'High', child: Text('High (Urgent)')),
                      DropdownMenuItem(value: 'Emergency', child: Text('Emergency (STAT)')),
                    ],
                    onChanged: (v) => setModalState(() => priority = v!),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: submitting
                        ? null
                        : () async {
                            setModalState(() => submitting = true);
                            try {
                              final api = ref.read(apiServiceProvider);
                              final res = await api.createLabOrders(_activeEncounterId!, [selectedTest], priority: priority);
                              if (res.statusCode == 200 || res.statusCode == 201) {
                                if (context.mounted) {
                                  Navigator.pop(context);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Lab investigation order dispatch complete! Billed to diagnostic queue.'), backgroundColor: Colors.green),
                                  );
                                }
                                _loadPatientData();
                              }
                            } catch (e) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lab order failed: $e')));
                              }
                            } finally {
                              setModalState(() => submitting = false);
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366f1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: submitting
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('DISPATCH LAB ORDER', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
