import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/appointment.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_app_bar.dart';
import '../widgets/status_badge.dart';
import '../widgets/shimmer_loading.dart';
import 'login_screen.dart';
import 'patient_record_screen.dart';
import 'opd_registration_screen.dart';
import 'lab_results_screen.dart';
import 'telehealth_screen.dart';
import 'voice_note_screen.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with SingleTickerProviderStateMixin {
  List<Appointment> _appointments = [];
  bool _isLoadingQueue = true;
  String? _queueError;
  String? _doctorId;
  String _userName = 'Doctor';

  late AnimationController _staggerController;

  @override
  void initState() {
    super.initState();
    _staggerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _loadQueue();
  }

  @override
  void dispose() {
    _staggerController.dispose();
    super.dispose();
  }

  Future<void> _loadQueue() async {
    setState(() {
      _isLoadingQueue = true;
      _queueError = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final role = prefs.getString('user_role')?.toLowerCase();
      final userId = prefs.getString('user_id');
      _userName = prefs.getString('user_name') ?? 'Doctor';
      final api = ref.read(apiServiceProvider);
      final res = await api.getAppointments(
        doctorId: role == 'doctor' ? userId : null,
      );
      final data = res.data is List ? res.data as List : const [];
      if (!mounted) return;
      setState(() {
        _doctorId = userId;
        _appointments = data
            .map((item) => Appointment.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        _isLoadingQueue = false;
      });
      _staggerController.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      _userName = prefs.getString('user_name') ?? 'Doctor';
      String? fallbackPatientId;
      try {
        final api = ref.read(apiServiceProvider);
        final patientsRes = await api.getPatients();
        if (patientsRes.statusCode == 200 &&
            patientsRes.data is List &&
            (patientsRes.data as List).isNotEmpty) {
          fallbackPatientId = patientsRes.data[0]['id']?.toString();
        }
      } catch (_) {}

      setState(() {
        _doctorId = userId;
        _appointments = _demoAppointments(
          fallbackPatientId: fallbackPatientId,
          fallbackDoctorId: userId,
        );
        _queueError = 'Showing offline triage queue snapshot.';
        _isLoadingQueue = false;
      });
      _staggerController.forward(from: 0);
    }
  }

  Future<void> _logout(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (context.mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadQueue,
          color: AppColors.primary,
          child: CustomScrollView(
            slivers: [
              // ── Premium App Bar ─────────────────────────────────────
              SliverToBoxAdapter(
                child: GradientAppBar(
                  userName: _userName,
                  role: 'doctor',
                  onLogout: () => _logout(context),
                ),
              ),

              // ── Stats Row ───────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: _AnimatedStatCard(
                          label: 'In Queue',
                          value: _appointments.where((a) =>
                              a.status.toLowerCase().contains('queue')).length.toString(),
                          icon: Icons.schedule_rounded,
                          color: AppColors.primary,
                          delay: 0,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _AnimatedStatCard(
                          label: 'Today',
                          value: _appointments.length.toString(),
                          icon: Icons.calendar_today_rounded,
                          color: AppColors.secondary,
                          delay: 100,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Queue Section Header ────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'PATIENT QUEUE',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                          color: AppColors.textMuted,
                          letterSpacing: 1.2,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${_appointments.length} patients',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Offline warning ─────────────────────────────────────
              if (_queueError != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.amberSurface,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(color: AppColors.amber.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.cloud_off_rounded, color: AppColors.amberDark, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _queueError!,
                              style: const TextStyle(
                                color: AppColors.amberDark,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

              // ── Queue List ──────────────────────────────────────────
              if (_isLoadingQueue)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: ShimmerCardSkeleton(count: 3),
                  ),
                )
              else if (_appointments.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: _buildEmptyQueue(),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      return TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0.0, end: 1.0),
                        duration: Duration(milliseconds: 400 + (index * 80)),
                        curve: Curves.easeOutCubic,
                        builder: (context, value, child) {
                          return Transform.translate(
                            offset: Offset(0, (1 - value) * 30),
                            child: Opacity(
                              opacity: value.clamp(0.0, 1.0),
                              child: child,
                            ),
                          );
                        },
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(
                            20, index == 0 ? 8 : 0, 20, 10,
                          ),
                          child: _buildAppointmentCard(
                            context, _appointments[index], ref,
                          ),
                        ),
                      );
                    },
                    childCount: _appointments.length,
                  ),
                ),

              // ── Quick Actions ───────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                  child: const Text(
                    'QUICK ACTIONS',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      color: AppColors.textMuted,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(child: _buildActionCard(
                            Icons.person_add_alt_1_rounded,
                            'Add Patient',
                            AppColors.secondary,
                            () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => const OPDRegistrationScreen())),
                          )),
                          const SizedBox(width: 12),
                          Expanded(child: _buildActionCard(
                            Icons.mic_rounded,
                            'Voice Note',
                            AppColors.purple,
                            () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => VoiceNoteScreen(doctorId: _doctorId))),
                          )),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(child: _buildActionCard(
                            Icons.video_call_rounded,
                            'Tele-Health',
                            AppColors.error,
                            () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => const TelehealthScreen())),
                          )),
                          const SizedBox(width: 12),
                          Expanded(child: _buildActionCard(
                            Icons.biotech_rounded,
                            'View Labs',
                            AppColors.indigo,
                            () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => const LabResultsScreen())),
                          )),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 40)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Appointment Card ────────────────────────────────────────────────────
  Widget _buildAppointmentCard(BuildContext context, Appointment appointment, WidgetRef ref) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => PatientRecordScreen(
                appointment: appointment,
                fallbackDoctorId: _doctorId,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.cardDecoration(shadow: AppTheme.shadowMedium),
          child: Row(
            children: [
              // Patient Avatar
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                ),
                child: Center(
                  child: Text(
                    appointment.patientName.isNotEmpty
                        ? appointment.patientName.substring(0, 1).toUpperCase()
                        : '?',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            appointment.patientName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                        StatusBadge.fromStatus(appointment.status),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.access_time_rounded,
                            size: 13, color: AppColors.textHint),
                        const SizedBox(width: 4),
                        Text(
                          '${appointment.time} • ${appointment.type}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    if (appointment.symptoms.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.medical_information_outlined,
                                size: 12, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                appointment.symptoms,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textTertiary,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_ios_rounded,
                  size: 14, color: AppColors.textHint),
            ],
          ),
        ),
      ),
    );
  }

  // ── Action Card ─────────────────────────────────────────────────────────
  Widget _buildActionCard(IconData icon, String label, Color color, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
          decoration: AppTheme.cardDecoration(),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      color.withValues(alpha: 0.15),
                      color.withValues(alpha: 0.05),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                ),
                child: Icon(icon, size: 24, color: color),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Empty State ─────────────────────────────────────────────────────────
  Widget _buildEmptyQueue() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.event_available_rounded,
              size: 32,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'No patients in queue',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.textTertiary,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'New appointments will appear here',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  List<Appointment> _demoAppointments({String? fallbackPatientId, String? fallbackDoctorId}) {
    return [
      Appointment(
        id: 'demo-1',
        patientId: fallbackPatientId ?? '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        doctorId: fallbackDoctorId,
        patientName: 'Selvakumar Balakrishnan',
        time: '10:30 AM',
        type: 'OPD',
        status: 'In-Queue',
        symptoms: 'Mild Fever, Cough',
      ),
      Appointment(
        id: 'demo-2',
        patientId: fallbackPatientId ?? '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        doctorId: fallbackDoctorId,
        patientName: 'Rahul Sharma',
        time: '11:15 AM',
        type: 'Follow-up',
        status: 'In-Queue',
        symptoms: 'Follow-up consultation',
      ),
    ];
  }
}

// ── Animated Stat Card ──────────────────────────────────────────────────
class _AnimatedStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final int delay;

  const _AnimatedStatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 600 + delay),
      curve: Curves.easeOutCubic,
      builder: (context, animValue, child) {
        return Transform.translate(
          offset: Offset(0, (1 - animValue) * 20),
          child: Opacity(
            opacity: animValue.clamp(0.0, 1.0),
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: AppTheme.cardDecoration(shadow: AppTheme.shadowMedium),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: TextStyle(
                      color: color,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    color.withValues(alpha: 0.15),
                    color.withValues(alpha: 0.05),
                  ],
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
          ],
        ),
      ),
    );
  }
}
