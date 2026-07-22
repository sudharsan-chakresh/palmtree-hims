import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_app_bar.dart';
import '../widgets/shimmer_loading.dart';
import 'admin_billing_dashboard_screen.dart';
import 'login_screen.dart';
import 'dashboard_screen.dart';
import 'pharmacist_dashboard_screen.dart';
import 'lab_assistant_dashboard_screen.dart';
import 'nurse_dashboard_screen.dart';
import 'receptionist_dashboard_screen.dart';

class AdminDashboardScreen extends ConsumerStatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  ConsumerState<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends ConsumerState<AdminDashboardScreen> {
  Map<String, dynamic> _metrics = {};
  String _userName = 'Admin';
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final prefs = await SharedPreferences.getInstance();
    final userName = prefs.getString('user_name') ?? 'Admin';

    try {
      final response = await ref.read(apiServiceProvider).getDashboardStats();
      final data = response.data;
      if (!mounted) return;
      setState(() {
        _userName = userName;
        _metrics = data is Map && data['metrics'] is Map
            ? Map<String, dynamic>.from(data['metrics'] as Map)
            : {};
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _userName = userName;
        _errorMessage = 'Live metrics unavailable. Pull down to retry.';
        _isLoading = false;
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

  num _number(String key) {
    final value = _metrics[key];
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  String _currency(String key) {
    final value = _number(key);
    return '₹${value.toStringAsFixed(value % 1 == 0 ? 0 : 2)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadDashboard,
          color: const Color(0xFF7C3AED),
          child: CustomScrollView(
            slivers: [
              // ── App Bar ─────────────────────────────────────────────
              SliverToBoxAdapter(
                child: GradientAppBar(
                  userName: _userName,
                  role: 'admin',
                  onLogout: _logout,
                ),
              ),

              // ── Hero Card ───────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, child) {
                      return Transform.translate(
                        offset: Offset(0, (1 - value) * 20),
                        child: Opacity(opacity: value.clamp(0.0, 1.0), child: child),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1E1B4B), Color(0xFF4C1D95)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(AppTheme.radiusXxl),
                        boxShadow: AppTheme.shadowColored(const Color(0xFF4C1D95)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.12),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.admin_panel_settings,
                                    color: Colors.white, size: 24),
                              ),
                              const SizedBox(width: 14),
                              const Expanded(
                                child: Text(
                                  'Operations Console',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Text(
                                  'LIVE',
                                  style: TextStyle(
                                    color: Color(0xFF10B981),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Real-time bed occupancy, patient flow & billing.',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // ── Error Banner ────────────────────────────────────────
              if (_errorMessage != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.amberSurface,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(
                            color: AppColors.amber.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.cloud_off_rounded,
                              color: AppColors.amberDark, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: AppColors.amberDark,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

              // ── Metrics Section ─────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: const Text(
                    'HOSPITAL METRICS',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      color: AppColors.textMuted,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),

              if (_isLoading)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(child: ShimmerLoading(height: 110, borderRadius: AppTheme.radiusXl)),
                            const SizedBox(width: 12),
                            Expanded(child: ShimmerLoading(height: 110, borderRadius: AppTheme.radiusXl)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: ShimmerLoading(height: 110, borderRadius: AppTheme.radiusXl)),
                            const SizedBox(width: 12),
                            Expanded(child: ShimmerLoading(height: 110, borderRadius: AppTheme.radiusXl)),
                          ],
                        ),
                      ],
                    ),
                  ),
                )
              else
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _buildMetricGrid(),
                  ),
                ),

              // ── Financial Section ───────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                  child: const Text(
                    'FINANCIAL',
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
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const AdminBillingDashboardScreen())),
                      borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                      child: Container(
                        padding: const EdgeInsets.all(18),
                        decoration: AppTheme.cardDecoration(shadow: AppTheme.shadowMedium),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                gradient: AppColors.tealGradient,
                                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                              ),
                              child: const Icon(Icons.payments_rounded,
                                  color: Colors.white, size: 22),
                            ),
                            const SizedBox(width: 16),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Billing & Collections',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    'Invoices, payments, discounts',
                                    style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded,
                                color: AppColors.textHint),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // ── Department Consoles ─────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                  child: const Text(
                    'DEPARTMENT CONSOLES',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      color: AppColors.textMuted,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),

              SliverList(
                delegate: SliverChildListDelegate([
                  _buildDeptCard(
                    title: 'Clinical Desk',
                    subtitle: 'Consultation queue & EMR',
                    icon: Icons.medical_services_outlined,
                    color: AppColors.primary,
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const DashboardScreen())),
                    index: 0,
                  ),
                  _buildDeptCard(
                    title: 'Diagnostics Lab',
                    subtitle: 'Verify orders & publish reports',
                    icon: Icons.biotech_outlined,
                    color: AppColors.indigo,
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const LabAssistantDashboardScreen())),
                    index: 1,
                  ),
                  _buildDeptCard(
                    title: 'Pharmacy',
                    subtitle: 'Prescriptions & dispensing',
                    icon: Icons.local_pharmacy_outlined,
                    color: AppColors.secondary,
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const PharmacistDashboardScreen())),
                    index: 2,
                  ),
                  _buildDeptCard(
                    title: 'Nursing Station',
                    subtitle: 'Triage vitals & IPD bed map',
                    icon: Icons.monitor_heart_outlined,
                    color: AppColors.amber,
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const NurseDashboardScreen())),
                    index: 3,
                  ),
                  _buildDeptCard(
                    title: 'Front Desk',
                    subtitle: 'Registration & check-ins',
                    icon: Icons.desk_outlined,
                    color: AppColors.pink,
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const ReceptionistDashboardScreen())),
                    index: 4,
                  ),
                  const SizedBox(height: 40),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Metric Grid ─────────────────────────────────────────────────────────
  Widget _buildMetricGrid() {
    final items = [
      _MetricData("Today's Queue", _number('appointmentsToday').toString(),
          Icons.calendar_month_rounded, AppColors.primary, AppColors.primarySurface),
      _MetricData('Checked-In', _number('checkedInToday').toString(),
          Icons.people_alt_rounded, AppColors.secondary, AppColors.secondarySurface),
      _MetricData('Admitted', _number('activeAdmissions').toString(),
          Icons.bed_rounded, AppColors.indigo, AppColors.indigoSurface),
      _MetricData('Pending Bills', _number('pendingBills').toString(),
          Icons.receipt_long_rounded, AppColors.error, AppColors.errorSurface),
      _MetricData("Revenue", _currency('dailyRevenue'),
          Icons.trending_up_rounded, AppColors.secondaryDark, AppColors.secondarySurface),
      _MetricData('Occupancy', '${_number('bedOccupancy')}%',
          Icons.local_hospital_rounded, AppColors.cyan, AppColors.cyanSurface),
    ];

    return Column(
      children: [
        for (int i = 0; i < items.length; i += 2)
          Padding(
            padding: EdgeInsets.only(bottom: i + 2 < items.length ? 12 : 0),
            child: Row(
              children: [
                Expanded(child: _buildMetricCard(items[i], i)),
                const SizedBox(width: 12),
                Expanded(
                  child: i + 1 < items.length
                      ? _buildMetricCard(items[i + 1], i + 1)
                      : const SizedBox(),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildMetricCard(_MetricData item, int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 500 + (index * 80)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.scale(
          scale: 0.85 + (value * 0.15),
          child: Opacity(
            opacity: value.clamp(0.0, 1.0),
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: AppTheme.cardDecoration(shadow: AppTheme.shadowMedium),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    item.color.withValues(alpha: 0.15),
                    item.color.withValues(alpha: 0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Icon(item.icon, color: item.color, size: 20),
            ),
            const SizedBox(height: 14),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                item.value,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Department Card ─────────────────────────────────────────────────────
  Widget _buildDeptCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    required int index,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 80)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset((1 - value) * 30, 0),
          child: Opacity(
            opacity: value.clamp(0.0, 1.0),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: AppTheme.cardDecoration(),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          color.withValues(alpha: 0.15),
                          color.withValues(alpha: 0.05),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    ),
                    child: Icon(icon, color: color, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: AppColors.textSecondary)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 12)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: AppColors.textHint, size: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricData {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color bg;

  _MetricData(this.label, this.value, this.icon, this.color, this.bg);
}
