import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'admin_dashboard_screen.dart';
import 'admin_billing_dashboard_screen.dart';
import 'pharmacist_dashboard_screen.dart';
import 'lab_assistant_dashboard_screen.dart';
import 'dashboard_screen.dart';
import 'employee_dashboard_screen.dart';
import 'nurse_dashboard_screen.dart';
import 'receptionist_dashboard_screen.dart';
import 'feature_placeholder_screen.dart';
import 'login_screen.dart';

class RoleDashboardRouter extends StatefulWidget {
  const RoleDashboardRouter({super.key});

  @override
  State<RoleDashboardRouter> createState() => _RoleDashboardRouterState();
}

class _RoleDashboardRouterState extends State<RoleDashboardRouter> {
  String _role = 'staff';
  String _userName = 'User';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRoleInfo();
  }

  Future<void> _loadRoleInfo() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _role = prefs.getString('user_role') ?? 'staff';
      _userName = prefs.getString('user_name') ?? 'User';
      _isLoading = false;
    });
  }

  Future<void> _switchRole(String newRole) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_role', newRole);
    HapticFeedback.mediumImpact();
    setState(() => _role = newRole);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.swap_horiz_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text(
                'Switched to ${newRole.toUpperCase()} view',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          backgroundColor: AppColors.roleColor(newRole),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 2),
        ),
      );
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

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.surfaceVariant,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final normalizedRole = _role.toLowerCase();

    // Build role-specific AppShell with bottom nav tabs
    if (normalizedRole.contains('admin')) {
      return AppShell(
        role: 'admin',
        activeColor: const Color(0xFF7C3AED),
        tabs: [
          const AppShellTab(
            icon: Icons.dashboard_outlined,
            activeIcon: Icons.dashboard_rounded,
            label: 'Overview',
            body: AdminDashboardScreen(),
          ),
          const AppShellTab(
            icon: Icons.payments_outlined,
            activeIcon: Icons.payments_rounded,
            label: 'Billing',
            body: AdminBillingDashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.settings_outlined,
            activeIcon: Icons.settings_rounded,
            label: 'Settings',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    if (normalizedRole.contains('doctor')) {
      return AppShell(
        role: 'doctor',
        tabs: [
          const AppShellTab(
            icon: Icons.dashboard_outlined,
            activeIcon: Icons.dashboard_rounded,
            label: 'Dashboard',
            body: DashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    if (normalizedRole.contains('nurse')) {
      return AppShell(
        role: 'nurse',
        activeColor: AppColors.amber,
        tabs: [
          const AppShellTab(
            icon: Icons.monitor_heart_outlined,
            activeIcon: Icons.monitor_heart_rounded,
            label: 'Station',
            body: NurseDashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    if (normalizedRole.contains('pharmacy') || normalizedRole.contains('pharmacist')) {
      return AppShell(
        role: 'pharmacist',
        activeColor: AppColors.secondary,
        tabs: [
          const AppShellTab(
            icon: Icons.local_pharmacy_outlined,
            activeIcon: Icons.local_pharmacy_rounded,
            label: 'Rx Queue',
            body: PharmacistDashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    if (normalizedRole.contains('lab')) {
      return AppShell(
        role: 'lab_assistant',
        activeColor: AppColors.indigo,
        tabs: [
          const AppShellTab(
            icon: Icons.biotech_outlined,
            activeIcon: Icons.biotech_rounded,
            label: 'Orders',
            body: LabAssistantDashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    if (normalizedRole.contains('receptionist')) {
      return AppShell(
        role: 'receptionist',
        activeColor: AppColors.pink,
        tabs: [
          const AppShellTab(
            icon: Icons.desk_outlined,
            activeIcon: Icons.desk_rounded,
            label: 'Front Desk',
            body: ReceptionistDashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    if (normalizedRole.contains('billing') || normalizedRole.contains('accountant')) {
      return AppShell(
        role: 'accountant',
        activeColor: AppColors.secondary,
        tabs: [
          const AppShellTab(
            icon: Icons.payments_outlined,
            activeIcon: Icons.payments_rounded,
            label: 'Billing',
            body: AdminBillingDashboardScreen(),
          ),
          AppShellTab(
            icon: Icons.swap_horiz_outlined,
            activeIcon: Icons.swap_horiz_rounded,
            label: 'Roles',
            body: _buildSettingsTab(),
          ),
          AppShellTab(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
            body: _buildProfileTab(),
          ),
        ],
      );
    }

    // Default: Employee / Staff
    return AppShell(
      role: 'staff',
      activeColor: AppColors.textTertiary,
      tabs: [
        const AppShellTab(
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard_rounded,
          label: 'Dashboard',
          body: EmployeeDashboardScreen(),
        ),
        AppShellTab(
          icon: Icons.swap_horiz_outlined,
          activeIcon: Icons.swap_horiz_rounded,
          label: 'Roles',
          body: _buildSettingsTab(),
        ),
        AppShellTab(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'Profile',
          body: _buildProfileTab(),
        ),
      ],
    );
  }

  // ── Role Switcher Tab ────────────────────────────────────────────────────
  Widget _buildSettingsTab() {
    final roles = [
      _RoleItem('Doctor', 'doctor', Icons.medical_services_outlined, AppColors.primary),
      _RoleItem('Admin', 'admin', Icons.admin_panel_settings_outlined, const Color(0xFF7C3AED)),
      _RoleItem('Pharmacist', 'pharmacist', Icons.local_pharmacy_outlined, AppColors.secondary),
      _RoleItem('Lab Assistant', 'lab_assistant', Icons.biotech_outlined, AppColors.indigo),
      _RoleItem('Nurse', 'nurse', Icons.monitor_heart_outlined, AppColors.amber),
      _RoleItem('Receptionist', 'receptionist', Icons.desk_outlined, AppColors.pink),
      _RoleItem('Billing', 'accountant', Icons.payments_outlined, AppColors.secondaryDark),
    ];

    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 8),
            const Text(
              'Switch View',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Preview the app from different department perspectives.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 24),
            ...roles.map((item) {
              final isActive = _role.toLowerCase().contains(item.key);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _switchRole(item.key),
                    borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: isActive ? item.color.withValues(alpha: 0.08) : AppColors.surface,
                        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                        border: Border.all(
                          color: isActive ? item.color.withValues(alpha: 0.3) : AppColors.border,
                          width: isActive ? 1.5 : 0.5,
                        ),
                        boxShadow: isActive ? AppTheme.shadowColored(item.color) : AppTheme.shadowSubtle,
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? item.color
                                  : item.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                            ),
                            child: Icon(
                              item.icon,
                              color: isActive ? Colors.white : item.color,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              item.label,
                              style: TextStyle(
                                fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                                fontSize: 15,
                                color: isActive ? item.color : AppColors.textSecondary,
                              ),
                            ),
                          ),
                          if (isActive)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: item.color,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'ACTIVE',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            )
                          else
                            Icon(Icons.chevron_right_rounded,
                                color: AppColors.textHint, size: 22),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  // ── Profile Tab ──────────────────────────────────────────────────────────
  Widget _buildProfileTab() {
    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 8),
            // Profile Header
            Center(
              child: Column(
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      shape: BoxShape.circle,
                      boxShadow: AppTheme.shadowColored(AppColors.primary),
                    ),
                    child: Center(
                      child: Text(
                        _userName.isNotEmpty
                            ? _userName.substring(0, _userName.length > 1 ? 2 : 1).toUpperCase()
                            : '?',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _userName,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.roleColor(_role).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _role.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.roleColor(_role),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Profile Options
            _buildProfileOption(
              icon: Icons.info_outline_rounded,
              label: 'About Jioplix',
              subtitle: 'Version 1.0.1',
              onTap: () {},
            ),
            _buildProfileOption(
              icon: Icons.logout_rounded,
              label: 'Sign Out',
              subtitle: 'Clear session and return to login',
              color: AppColors.error,
              onTap: _logout,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileOption({
    required IconData icon,
    required String label,
    required String subtitle,
    Color? color,
    required VoidCallback onTap,
  }) {
    final c = color ?? AppColors.textTertiary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: AppTheme.cardDecoration(),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: c.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  ),
                  child: Icon(icon, color: c, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: color ?? AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded,
                    color: AppColors.textHint, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleItem {
  final String label;
  final String key;
  final IconData icon;
  final Color color;

  _RoleItem(this.label, this.key, this.icon, this.color);
}
