import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ─── Providers ────────────────────────────────────────────────────────────────
final myLeavesProvider = FutureProvider.family<List<dynamic>, String>((ref, token) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.getMyLeaves(token);
  return (res.data as List?) ?? [];
});

final teamLeavesProvider = FutureProvider.family<List<dynamic>, String>((ref, token) async {
  final api = ref.read(apiServiceProvider);
  final res = await api.getTeamLeaveRequests(token);
  return (res.data as List?) ?? [];
});

// ─── Main Widget ──────────────────────────────────────────────────────────────
class EmployeeDashboardScreen extends ConsumerStatefulWidget {
  const EmployeeDashboardScreen({super.key});

  @override
  ConsumerState<EmployeeDashboardScreen> createState() => _EmployeeDashboardScreenState();
}

class _EmployeeDashboardScreenState extends ConsumerState<EmployeeDashboardScreen> with SingleTickerProviderStateMixin {
  // ── State ──────────────────────────────────────────────────────────────────
  String _token = '';
  String _userName = '';
  String _role = '';
  bool _isManager = false;
  bool _isLoading = true;
  int _selectedTab = 0;
  late TabController _tabController;

  // Leave request form state
  final _leaveTypeOptions = ['Casual Leave', 'Sick Leave', 'Emergency Leave', 'Maternity/Paternity'];
  String _selectedLeaveType = 'Casual Leave';
  final _fromController = TextEditingController();
  final _toController   = TextEditingController();
  final _reasonController = TextEditingController();
  bool _submitting = false;

  // ── Init ───────────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    final token    = prefs.getString('auth_token') ?? '';
    final userName = prefs.getString('user_name')  ?? 'Employee';
    final role     = prefs.getString('user_role')  ?? 'staff';
    final isManager= prefs.getBool('is_manager')   ?? false;

    setState(() {
      _token     = token;
      _userName  = userName;
      _role      = role;
      _isManager = isManager;
      _isLoading = false;
    });

    _tabController = TabController(
      length: _isManager ? 3 : 2,
      vsync: this,
    );
    _tabController.addListener(() => setState(() => _selectedTab = _tabController.index));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _fromController.dispose();
    _toController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  // ── Leave submission ───────────────────────────────────────────────────────
  Future<void> _submitLeave() async {
    if (_fromController.text.isEmpty || _toController.text.isEmpty) {
      _showSnack('Please select From and To dates.', isError: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.applyLeave(
        token: _token,
        leaveType: _selectedLeaveType,
        fromDate: _fromController.text,
        toDate: _toController.text,
        reason: _reasonController.text,
      );
      _fromController.clear();
      _toController.clear();
      _reasonController.clear();
      _showSnack('Leave request submitted successfully!');
      ref.invalidate(myLeavesProvider(_token));
    } catch (e) {
      _showSnack('Failed to submit leave request. Try again.', isError: true);
    } finally {
      setState(() => _submitting = false);
    }
  }

  // ── Team leave approval ────────────────────────────────────────────────────
  Future<void> _handleLeaveAction(int leaveId, String action) async {
    try {
      final api = ref.read(apiServiceProvider);
      await api.updateLeaveStatus(token: _token, leaveId: leaveId, status: action);
      _showSnack('Leave ${action == 'approved' ? 'approved' : 'rejected'} successfully.');
      ref.invalidate(teamLeavesProvider(_token));
    } catch (e) {
      _showSnack('Action failed. Please try again.', isError: true);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(
        children: [
          Icon(isError ? Icons.error_outline : Icons.check_circle_outline, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(child: Text(msg)),
        ],
      ),
      backgroundColor: isError ? const Color(0xFFEF4444) : const Color(0xFF10B981),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  // ── Date picker helper ─────────────────────────────────────────────────────
  Future<void> _pickDate(TextEditingController ctrl) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF2563EB),
            onPrimary: Colors.white,
            surface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      ctrl.text =
          '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    }
  }

  // ── Status badge widget ────────────────────────────────────────────────────
  Widget _statusBadge(String status) {
    final map = {
      'pending':  {'bg': const Color(0xFFFEF3C7), 'text': const Color(0xFFD97706), 'icon': Icons.hourglass_empty},
      'approved': {'bg': const Color(0xFFD1FAE5), 'text': const Color(0xFF059669), 'icon': Icons.check_circle_rounded},
      'rejected': {'bg': const Color(0xFFFEE2E2), 'text': const Color(0xFFEF4444), 'icon': Icons.cancel_rounded},
    };
    final colors = map[status.toLowerCase()] ??
        {'bg': const Color(0xFFF1F5F9), 'text': const Color(0xFF64748B), 'icon': Icons.help_outline};
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: colors['bg'] as Color,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: (colors['bg'] as Color).withOpacity(0.8), width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(colors['icon'] as IconData, size: 12, color: colors['text'] as Color),
          const SizedBox(width: 4),
          Text(
            status.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: colors['text'] as Color,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // ── Top App Bar ─────────────────────────────────────────────────
            _buildAppBar(),

            // ── Tab Bar ─────────────────────────────────────────────────────
            Container(
              color: Colors.white,
              child: TabBar(
                controller: _tabController,
                labelColor: const Color(0xFF2563EB),
                unselectedLabelColor: const Color(0xFF64748B),
                indicatorColor: const Color(0xFF2563EB),
                indicatorWeight: 3,
                labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                tabs: [
                  const Tab(text: 'My Leave History'),
                  const Tab(text: 'Request Leave'),
                  if (_isManager) const Tab(text: 'Team Approvals'),
                ],
              ),
            ),

            // ── Tab Content ─────────────────────────────────────────────────
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildMyLeavesTab(),
                  _buildApplyLeaveTab(),
                  if (_isManager) _buildTeamApprovalsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── App Bar ─────────────────────────────────────────────────────────────────
  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFFEFF6FF),
            child: Text(
              _userName.isNotEmpty ? _userName.trim().split(' ').map((e) => e[0]).take(2).join().toUpperCase() : 'E',
              style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hello, $_userName 👋',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _role.toUpperCase().replaceAll('_', ' '),
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ),
                    if (_isManager) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'MANAGER',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFFD97706)),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: IconButton(
              onPressed: () async {
                final prefs = await SharedPreferences.getInstance();
                await prefs.clear();
                if (mounted) Navigator.pushReplacementNamed(context, '/');
              },
              icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 18),
              tooltip: 'Sign Out',
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              padding: EdgeInsets.zero,
            ),
          ),
        ],
      ),
    );
  }

  // ── My Leaves Tab ───────────────────────────────────────────────────────────
  Widget _buildMyLeavesTab() {
    final leavesAsync = ref.watch(myLeavesProvider(_token));
    return leavesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
      error: (e, _) => _buildErrorState('Could not load leave roster history.'),
      data: (leaves) {
        if (leaves.isEmpty) {
          return _buildEmptyState(
            icon: Icons.beach_access_outlined,
            title: 'No leave requests yet',
            subtitle: 'Navigate to "Request Leave" to log a new attendance request.',
          );
        }

        // Summary counts
        final pending  = leaves.where((l) => (l['status'] ?? '') == 'pending').length;
        final approved = leaves.where((l) => (l['status'] ?? '') == 'approved').length;
        final rejected = leaves.where((l) => (l['status'] ?? '') == 'rejected').length;

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Summary chips
            Row(
              children: [
                _summaryChip('$pending Pending', const Color(0xFFFEF3C7), const Color(0xFFD97706)),
                const SizedBox(width: 8),
                _summaryChip('$approved Approved', const Color(0xFFD1FAE5), const Color(0xFF059669)),
                const SizedBox(width: 8),
                _summaryChip('$rejected Rejected', const Color(0xFFFEE2E2), const Color(0xFFEF4444)),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Text(
                  'ROSTER REQUESTS HISTORY',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 1.1),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...leaves.map((leave) => _buildLeaveCard(leave)).toList(),
          ],
        );
      },
    );
  }

  Widget _summaryChip(String label, Color bg, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: bg.withOpacity(0.8), width: 0.5),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: color),
        ),
      ),
    );
  }

  Widget _buildLeaveCard(Map<dynamic, dynamic> leave) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 8,
            offset: const Offset(0, 2),
          )
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
                  leave['leave_type'] ?? 'Leave Request',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                ),
                _statusBadge(leave['status'] ?? 'pending'),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 8),
                Text(
                  '${_fmtDate(leave['from_date'])} to ${_fmtDate(leave['to_date'])}',
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), fontWeight: FontWeight.bold),
                ),
              ],
            ),
            if ((leave['reason'] ?? '').isNotEmpty) ...[
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(left: 22),
                child: Text(
                  leave['reason'],
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ── Apply Leave Tab ─────────────────────────────────────────────────────────
  Widget _buildApplyLeaveTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '📅 Request Absence / Leave',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Submit leave request details for manager authorization.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 20),

                // Leave Type
                _fieldLabel('Absence Category'),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedLeaveType,
                      isExpanded: true,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A), fontSize: 14),
                      items: _leaveTypeOptions.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                      onChanged: (v) => setState(() => _selectedLeaveType = v!),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Date range
                Row(
                  children: [
                    Expanded(child: _buildDateField('Start Date', _fromController)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildDateField('End Date', _toController)),
                  ],
                ),
                const SizedBox(height: 16),

                // Reason
                _fieldLabel('Reason for Absence'),
                TextField(
                  controller: _reasonController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Provide a brief explanation here...',
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 24),

                // Submit button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submitLeave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 1,
                    ),
                    child: _submitting
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('SUBMIT REQUEST', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 0.5)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateField(String label, TextEditingController ctrl) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel(label),
        GestureDetector(
          onTap: () => _pickDate(ctrl),
          child: AbsorbPointer(
            child: TextField(
              controller: ctrl,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'YYYY-MM-DD',
                suffixIcon: const Icon(Icons.calendar_today_outlined, color: Color(0xFF64748B), size: 16),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Team Approvals Tab ─────────────────────────────────────────────────────
  Widget _buildTeamApprovalsTab() {
    final teamAsync = ref.watch(teamLeavesProvider(_token));
    return teamAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
      error: (e, _) => _buildErrorState('Could not load team leave roster.'),
      data: (leaves) {
        final pending = leaves.where((l) => (l['status'] ?? '') == 'pending').toList();
        final others  = leaves.where((l) => (l['status'] ?? '') != 'pending').toList();

        if (leaves.isEmpty) {
          return _buildEmptyState(
            icon: Icons.group_outlined,
            title: 'No leave requests',
            subtitle: 'Your team currently has no logged leave requests.',
          );
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (pending.isNotEmpty) ...[
              _sectionHeader('⏳ AWAITING YOUR APPROVAL (${pending.length})'),
              ...pending.map((l) => _buildTeamLeaveCard(l, isPending: true)).toList(),
              const SizedBox(height: 16),
            ],
            if (others.isNotEmpty) ...[
              _sectionHeader('APPROVAL HISTORY'),
              ...others.map((l) => _buildTeamLeaveCard(l, isPending: false)).toList(),
            ],
          ],
        );
      },
    );
  }

  Widget _buildTeamLeaveCard(Map<dynamic, dynamic> leave, {required bool isPending}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isPending ? const Color(0xFFFDE68A) : const Color(0xFFE2E8F0), width: isPending ? 1.5 : 1.0),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.01), blurRadius: 6, offset: const Offset(0, 2))
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
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        leave['employee_name'] ?? 'Team Member',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        leave['leave_type'] ?? 'Leave Request',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                _statusBadge(leave['status'] ?? 'pending'),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 8),
                Text(
                  '${_fmtDate(leave['from_date'])} to ${_fmtDate(leave['to_date'])}',
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), fontWeight: FontWeight.bold),
                ),
              ],
            ),
            if ((leave['reason'] ?? '').isNotEmpty) ...[
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(left: 22),
                child: Text(
                  '"${leave['reason']}"',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
            if (isPending) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _handleLeaveAction(leave['id'], 'rejected'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEF4444),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.close, size: 14),
                          SizedBox(width: 4),
                          Text('Reject', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _handleLeaveAction(leave['id'], 'approved'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check, size: 14),
                          SizedBox(width: 4),
                          Text('Approve', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  Widget _fieldLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
      );

  Widget _sectionHeader(String text) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 12),
        child: Text(
          text,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.1),
        ),
      );

  Widget _buildEmptyState({required IconData icon, required String title, required String subtitle}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: const Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
            const SizedBox(height: 6),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String message) => Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 40, color: Color(0xFF94A3B8)),
              const SizedBox(height: 12),
              Text(message, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)), textAlign: TextAlign.center),
            ],
          ),
        ),
      );

  String _fmtDate(dynamic raw) {
    if (raw == null) return 'N/A';
    try {
      final d = DateTime.parse(raw.toString());
      return '${d.day.toString().padLeft(2, '0')} ${_monthName(d.month)} ${d.year}';
    } catch (_) {
      return raw.toString();
    }
  }

  String _monthName(int m) =>
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
}
