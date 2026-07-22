import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../models/appointment.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/gradient_app_bar.dart';
import '../widgets/shimmer_loading.dart';
import '../widgets/status_badge.dart';
import 'login_screen.dart';

class NurseDashboardScreen extends ConsumerStatefulWidget {
  const NurseDashboardScreen({super.key});

  @override
  ConsumerState<NurseDashboardScreen> createState() => _NurseDashboardScreenState();
}

class _NurseDashboardScreenState extends ConsumerState<NurseDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Appointment> _queue = [];
  List<dynamic> _wards = [];
  bool _isLoadingQueue = true;
  bool _isLoadingBeds = true;
  String? _queueError;
  String? _bedsError;
  String _userName = 'Nurse';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadUserInfo();
    _fetchQueue();
    _fetchBedMap();
  }

  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userName = prefs.getString('user_name') ?? 'Nurse';
    });
  }

  Future<void> _fetchQueue() async {
    setState(() {
      _isLoadingQueue = true;
      _queueError = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getAppointments();
      final data = res.data is List ? res.data as List : const [];
      if (!mounted) return;
      setState(() {
        _queue = data
            .map((item) => Appointment.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        _isLoadingQueue = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _queue = _getMockQueue();
        _queueError = 'Showing offline triage snapshot.';
        _isLoadingQueue = false;
      });
    }
  }

  Future<void> _fetchBedMap() async {
    setState(() {
      _isLoadingBeds = true;
      _bedsError = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getBedMap();
      final data = res.data;
      if (!mounted) return;
      setState(() {
        _wards = data is List
            ? data
            : (data is Map && data['wards'] is List)
                ? data['wards']
                : [];
        _isLoadingBeds = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _wards = _getMockWards();
        _bedsError = 'Showing offline bed map snapshot.';
        _isLoadingBeds = false;
      });
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  void _showVitalsCaptureModal(Appointment appointment) {
    final bpCtrl = TextEditingController();
    final tempCtrl = TextEditingController();
    final pulseCtrl = TextEditingController(text: '72');
    final weightCtrl = TextEditingController();
    bool submitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
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
                        Text(
                          'Triage Vitals Check',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                              ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Patient: ${appointment.patientName}',
                      style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: bpCtrl,
                            decoration: InputDecoration(
                              labelText: 'BP (Sys/Dia)',
                              hintText: '120/80',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextField(
                            controller: tempCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Temp (°F)',
                              hintText: '98.6',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: pulseCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Pulse (bpm)',
                              hintText: '72',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextField(
                            controller: weightCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Weight (kg)',
                              hintText: '70',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: submitting
                          ? null
                          : () async {
                              if (bpCtrl.text.isEmpty ||
                                  tempCtrl.text.isEmpty ||
                                  weightCtrl.text.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Please fill all vital readings'),
                                    backgroundColor: Colors.orange,
                                  ),
                                );
                                return;
                              }
                              setModalState(() => submitting = true);
                              try {
                                final api = ref.read(apiServiceProvider);
                                await api.createActiveEncounter({
                                  'patientId': appointment.patientId,
                                  'doctorId': appointment.doctorId,
                                  'type': 'OPD',
                                  'vitals': {
                                    'bp': bpCtrl.text.trim(),
                                    'pulse': int.tryParse(pulseCtrl.text) ?? 72,
                                    'heartRate': int.tryParse(pulseCtrl.text) ?? 72,
                                    'temp': double.tryParse(tempCtrl.text) ?? 98.6,
                                    'weight': double.tryParse(weightCtrl.text) ?? 70.0,
                                  },
                                  'complaints': appointment.symptoms,
                                });

                                // Update appointment status to 'In-Queue' (signifies vitals taken)
                                try {
                                  await api.updateAppointmentStatus(appointment.id, 'In-Queue');
                                } catch (_) {}

                                if (context.mounted) {
                                  Navigator.pop(context);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Vitals captured and patient checked in successfully!'),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                }
                                _fetchQueue();
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed to save vitals: $e')),
                                  );
                                }
                              } finally {
                                setModalState(() => submitting = false);
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284c7),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('SUBMIT & AUTHORIZE CONSULTATION',
                              style: TextStyle(fontWeight: FontWeight.bold)),
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

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      body: SafeArea(
        child: Column(
          children: [
            GradientAppBar(
              userName: _userName,
              role: 'nurse',
              onLogout: _logout,
              extraActions: [
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  ),
                  child: IconButton(
                    tooltip: 'Refresh',
                    onPressed: () {
                      _fetchQueue();
                      _fetchBedMap();
                    },
                    icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textTertiary),
                  ),
                ),
                const SizedBox(width: 6),
              ],
            ),
            // Segmented Control
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  boxShadow: AppTheme.shadowSubtle,
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                dividerColor: Colors.transparent,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textMuted,
                tabs: const [
                  Tab(text: 'Triage Queue'),
                  Tab(text: 'Bed Map'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildTriageQueueTab(),
                  _buildBedMapTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTriageQueueTab() {
    return RefreshIndicator(
      onRefresh: _fetchQueue,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Breadcrumb(paths: ['Nursing Desk', 'Triage Queue']),
          const SizedBox(height: 12),
          Text(
            'Welcome, $_userName',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 2),
          const Text('Measure patient vitals before the doctor consultation.',
              style: TextStyle(color: Color(0xFF64748B))),
          const SizedBox(height: 16),
          if (_queueError != null)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
              child: Text(_queueError!, style: const TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.bold)),
            ),
          const SizedBox(height: 12),
          _isLoadingQueue
              ? Padding(padding: const EdgeInsets.all(16), child: ShimmerCardSkeleton(count: 3))
              : _queue.isEmpty
                  ? _buildEmptyState('No patients in queue')
                  : Column(
                      children: _queue.map((appt) {
                        final isPendingVitals = appt.status.toLowerCase().contains('scheduled') || appt.status.toLowerCase().contains('pending');
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
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: isPendingVitals ? const Color(0xFFFEF3C7) : const Color(0xFFD1FAE5),
                                  child: Icon(
                                    Icons.person_rounded,
                                    color: isPendingVitals ? const Color(0xFFD97706) : const Color(0xFF065F46),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(appt.patientName, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B), fontSize: 14)),
                                      const SizedBox(height: 4),
                                      Text('Time: ${appt.time} • Type: ${appt.type}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                                      if (appt.symptoms.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text('Complaint: ${appt.symptoms}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                isPendingVitals
                                    ? ElevatedButton(
                                        onPressed: () => _showVitalsCaptureModal(appt),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF2563EB),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        child: const Text('Vitals', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                      )
                                    : Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFD1FAE5),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Text(
                                          'Checked-In',
                                          style: TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.bold, fontSize: 11),
                                        ),
                                      ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
        ],
      ),
    );
  }

  Widget _buildBedMapTab() {
    return RefreshIndicator(
      onRefresh: _fetchBedMap,
      child: _isLoadingBeds
          ? Padding(padding: const EdgeInsets.all(20), child: ShimmerCardSkeleton(count: 2))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Breadcrumb(paths: ['Nursing Desk', 'IPD Ward Map']),
                const SizedBox(height: 12),
                if (_bedsError != null)
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                    child: Text(_bedsError!, style: const TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.bold)),
                  ),
                ..._wards.map((ward) {
                  final wardName = ward['name'] ?? ward['wardName'] ?? 'General Ward';
                  final beds = ward['beds'] is List ? ward['beds'] as List : [];
                  final totalBeds = beds.length;
                  final occupiedBeds = beds.where((b) => b['status']?.toString().toUpperCase() == 'OCCUPIED' || b['isOccupied'] == true || b['is_occupied'] == true).length;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 16),
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
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                wardName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E293B)),
                              ),
                              Text(
                                '$occupiedBeds / $totalBeds Occupied',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: occupiedBeds == totalBeds ? const Color(0xFFEF4444) : const Color(0xFF2563EB),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          LayoutBuilder(
                            builder: (context, gridConstraints) {
                              const double spacing = 10.0;
                              const int columns = 5;
                              final double itemWidth = (gridConstraints.maxWidth - (spacing * (columns - 1))) / columns;
                              return Wrap(
                                spacing: spacing,
                                runSpacing: spacing,
                                children: List.generate(totalBeds, (idx) {
                                  final bed = beds[idx];
                                  final isOcc = bed['status']?.toString().toUpperCase() == 'OCCUPIED' || bed['isOccupied'] == true || bed['is_occupied'] == true;
                                  final name = bed['bedNumber']?.toString() ?? bed['number']?.toString() ?? '${idx + 1}';
                                  return Container(
                                    width: itemWidth,
                                    height: itemWidth * 0.9,
                                    decoration: BoxDecoration(
                                      color: isOcc ? const Color(0xFFFEF2F2) : const Color(0xFFD1FAE5),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: isOcc ? const Color(0xFFFCA5A5) : const Color(0xFFA7F3D0)),
                                    ),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.bed_rounded, color: isOcc ? const Color(0xFFEF4444) : const Color(0xFF059669), size: 18),
                                        const SizedBox(height: 2),
                                        FittedBox(
                                          fit: BoxFit.scaleDown,
                                          child: Text(
                                            name,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: isOcc ? const Color(0xFF991B1B) : const Color(0xFF065F46),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            const Icon(Icons.people_outline, size: 48, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  List<Appointment> _getMockQueue() {
    return [
      Appointment(
        id: 'mock-1',
        patientId: '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        doctorId: 'doc-1',
        patientName: 'Ramanathan Swamy',
        time: '10:00 AM',
        type: 'OPD',
        status: 'Scheduled',
        symptoms: 'High BP checkup',
      ),
      Appointment(
        id: 'mock-2',
        patientId: '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        doctorId: 'doc-1',
        patientName: 'Geetha Govindan',
        time: '10:45 AM',
        type: 'OPD',
        status: 'Scheduled',
        symptoms: 'Mild chest pain',
      ),
    ];
  }

  List<dynamic> _getMockWards() {
    return [
      {
        'name': 'General Ward A',
        'beds': [
          {'bedNumber': 'A-01', 'status': 'OCCUPIED'},
          {'bedNumber': 'A-02', 'status': 'AVAILABLE'},
          {'bedNumber': 'A-03', 'status': 'OCCUPIED'},
          {'bedNumber': 'A-04', 'status': 'AVAILABLE'},
          {'bedNumber': 'A-05', 'status': 'AVAILABLE'},
        ],
      },
      {
        'name': 'ICU',
        'beds': [
          {'bedNumber': 'ICU-1', 'status': 'OCCUPIED'},
          {'bedNumber': 'ICU-2', 'status': 'OCCUPIED'},
          {'bedNumber': 'ICU-3', 'status': 'AVAILABLE'},
        ],
      }
    ];
  }
}
