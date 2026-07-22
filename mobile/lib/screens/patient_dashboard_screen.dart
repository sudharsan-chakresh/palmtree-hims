import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/appointment.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_app_bar.dart';
import '../widgets/shimmer_loading.dart';
import 'login_screen.dart';
import 'abha_card_screen.dart';
import 'patient_appointment_screen.dart';
import 'patient_record_screen.dart';
import 'lab_results_screen.dart';
import 'patient_invoices_screen.dart';
import 'patient_auth_screen.dart';

class PatientDashboardScreen extends ConsumerStatefulWidget {
  const PatientDashboardScreen({super.key});

  @override
  ConsumerState<PatientDashboardScreen> createState() => _PatientDashboardScreenState();
}

class _PatientDashboardScreenState extends ConsumerState<PatientDashboardScreen> {
  String? _patientId;
  String? _patientName;
  List<Appointment> _appointments = [];
  bool _isLoading = true;
  dynamic _patientDetails;
  // Interactive Health Manager States
  final List<Map<String, dynamic>> _glucoseLogs = [
    {'date': 'Today, 8:00 AM', 'value': 95, 'type': 'Fasting', 'status': 'Normal'},
    {'date': 'Yesterday, 2:00 PM', 'value': 138, 'type': 'Post-meal', 'status': 'Normal'},
  ];

  final List<Map<String, dynamic>> _insulinLogs = [
    {'date': 'Today, 8:15 AM', 'units': 12, 'type': 'Lantus'},
    {'date': 'Yesterday, 8:15 AM', 'units': 12, 'type': 'Lantus'},
  ];

  final List<Map<String, dynamic>> _reminders = [
    {'time': '08:00 AM', 'title': 'Metformin 500mg', 'active': true},
    {'time': '02:00 PM', 'title': 'Multivitamin', 'active': true},
    {'time': '09:00 PM', 'title': 'Atorvastatin 10mg', 'active': false},
  ];

  // Interactive Truemeds Features State
  final _medicineSearchController = TextEditingController();
  String _medicineSearchQuery = '';
  Map<String, dynamic>? _selectedAlternative;
  bool _isUploadingPrescription = false;
  String? _uploadedFileName;

  final List<Map<String, dynamic>> _medicineCatalog = [
    {
      'brand': 'Crocin 650mg',
      'generic': 'Paracetamol 650mg',
      'brandPrice': 32.0,
      'genericPrice': 8.5,
      'savings': '73%',
      'manufacturer': 'GlaxoSmithKline',
      'genericMfg': 'Cipla Ltd',
      'description': 'Used for fever and mild to moderate pain relief.'
    },
    {
      'brand': 'Augmentin 625 Duo',
      'generic': 'Amoxycillin + Clavulanic Acid',
      'brandPrice': 204.5,
      'genericPrice': 58.0,
      'savings': '71%',
      'manufacturer': 'GlaxoSmithKline',
      'genericMfg': 'Alkem Laboratories',
      'description': 'Broad-spectrum penicillin antibiotic for bacterial infections.'
    },
    {
      'brand': 'Lipitor 10mg',
      'generic': 'Atorvastatin 10mg',
      'brandPrice': 125.0,
      'genericPrice': 32.5,
      'savings': '74%',
      'manufacturer': 'Pfizer India',
      'genericMfg': 'Zydus Cadila',
      'description': 'Cholesterol-lowering statin medication for heart health.'
    },
    {
      'brand': 'Glycomet 500mg',
      'generic': 'Metformin 500mg',
      'brandPrice': 58.0,
      'genericPrice': 14.0,
      'savings': '76%',
      'manufacturer': 'USV Private Ltd',
      'genericMfg': 'Abbott India',
      'description': 'First-line medication for type 2 diabetes management.'
    },
    {
      'brand': 'Pan-D Capsule',
      'generic': 'Pantoprazole + Domperidone',
      'brandPrice': 148.0,
      'genericPrice': 44.5,
      'savings': '70%',
      'manufacturer': 'Alkem Laboratories',
      'genericMfg': 'Aristo Pharmaceuticals',
      'description': 'Acidity, GERD, and anti-reflux capsule.'
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    final prefs = await SharedPreferences.getInstance();
    
    _patientId = prefs.getString('patient_id');
    _patientName = prefs.getString('patient_name');

    if (_patientId == null) {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const PatientAuthScreen()),
        );
      }
      return;
    }

    setState(() {
      _isLoading = true;
    });

    if (_patientId != null) {
      try {
        final api = ref.read(apiServiceProvider);
        
        // 1. Fetch live details from backend
        final profileRes = await api.getPatientDetails(_patientId!);
        if (profileRes.statusCode == 200 && profileRes.data != null) {
          final data = profileRes.data;
          setState(() {
            _patientName = data['name']?.toString() ?? _patientName;
            _patientDetails = data;
          });
          if (_patientName != null) {
            await prefs.setString('patient_name', _patientName!);
          }
        }

        // 2. Fetch appointments
        final res = await api.getAppointments();
        if (res.statusCode == 200 && res.data is List) {
          final list = res.data as List;
          setState(() {
            _appointments = list
                .map((item) => Appointment.fromJson(Map<String, dynamic>.from(item)))
                .where((a) => a.patientId == _patientId)
                .toList();
          });
        }
      } catch (e) {
        debugPrint('Failed to load patient appointments or profile: $e');
      }
    }

    setState(() {
      _isLoading = false;
    });
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

  @override
  Widget build(BuildContext context) {
    final welcomeName = _patientName ?? 'Deepika';

    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      appBar: GradientAppBar(
        userName: welcomeName,
        role: 'patient',
        onNotificationTap: _showNotifications,
        onProfileTap: _showProfileDetails,
        onLogout: () => _logout(context),
        extraActions: [
          IconButton(
            icon: const Icon(Icons.swap_horiz_rounded, color: AppColors.textTertiary),
            onPressed: _showProfileSwitcher,
            tooltip: 'Switch Profile',
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF21274F)),
              accountName: Text(welcomeName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              accountEmail: const Text('deepika@abdm.gov.in'),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.blue.shade100,
                child: Text(
                  welcomeName.substring(0, welcomeName.length > 1 ? 2 : 1).toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Color(0xFF21274F)),
                ),
              ),
            ),
            ListfulDrawerItem(
              icon: Icons.dashboard_outlined,
              title: 'Dashboard',
              onTap: () => Navigator.pop(context),
            ),
            ListfulDrawerItem(
              icon: Icons.shield_outlined,
              title: 'ABHA Digital ID',
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (context) => AbhaCardScreen(patientName: welcomeName)));
              },
            ),
            ListfulDrawerItem(
              icon: Icons.logout_rounded,
              title: 'Sign Out',
              onTap: () {
                Navigator.pop(context);
                _logout(context);
              },
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Prominent Truemeds-style Search Bar
              _buildSearchBar(),

              // 2. Quick Prescription Upload Banner
              _buildUploadPrescriptionBanner(),

              // 3. Promotional Savings Banner
              _buildPromoBanner(),

              // 4. Generic Alternative savings search comparison tool
              _buildAlternativeFinder(),

              // 5. Browse Shop Health Categories
              _buildBrowseCategories(),

              // 6. ABHA Digital Health ID
              _buildAbhaSection(welcomeName),

              // 7. Clinical Services
              _buildHealthServicesSection(context, welcomeName),

              // 8. Health Manager Section ( mock grid from screenshot )
              _buildHealthManagerSection(context, welcomeName),

              // 9. Upcoming Visits
              _buildUpcomingVisitsSection(),
            ],
          ),
        ),
      ),
    );
  }

  // ── Truemeds-style Search Bar ───────────────────────────────────────────
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _medicineSearchController,
            onChanged: (val) {
              setState(() {
                _medicineSearchQuery = val;
                if (val.isEmpty) {
                  _selectedAlternative = null;
                }
              });
            },
            decoration: InputDecoration(
              hintText: 'Search medicines, generic alternatives...',
              prefixIcon: const Icon(Icons.search, color: AppColors.textHint, size: 22),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.mic_rounded, color: AppColors.primary, size: 20),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Listening for medicine name...'), behavior: SnackBarBehavior.floating),
                      );
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.camera_alt_rounded, color: AppColors.primary, size: 20),
                    onPressed: _showUploadPrescriptionSheet,
                  ),
                ],
              ),
              filled: true,
              fillColor: AppColors.surface,
              contentPadding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
      ),
    );
  }

  // ── Upload Prescription Banner ───────────────────────────────────────────
  Widget _buildUploadPrescriptionBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      padding: const EdgeInsets.all(18),
      decoration: AppTheme.cardDecoration(
        color: AppColors.surface,
        shadow: AppTheme.shadowSubtle,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.secondarySurface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.description_outlined, color: AppColors.secondary, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Quick Upload Prescription',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                const Text(
                  'Let pharmacists find generic substitutes.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (_uploadedFileName != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.check_circle, color: AppColors.secondary, size: 14),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          _uploadedFileName!,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.secondaryDark),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _isUploadingPrescription ? null : _showUploadPrescriptionSheet,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.secondary,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _isUploadingPrescription
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text(
                    'Upload',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }

  void _showUploadPrescriptionSheet() {
    showModalBottomSheet(
      context: context,
      builder: (c) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Upload Doctor Prescription',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              const Text(
                'Select source to upload prescription. Our pharmacists will review and recommend generic substitutes with savings up to 72%.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildUploadOption(
                    icon: Icons.camera_alt_rounded,
                    label: 'Camera',
                    onTap: () {
                      Navigator.pop(c);
                      _simulatePrescriptionUpload('rx_camera_capture.jpg');
                    },
                  ),
                  _buildUploadOption(
                    icon: Icons.photo_library_rounded,
                    label: 'Gallery',
                    onTap: () {
                      Navigator.pop(c);
                      _simulatePrescriptionUpload('rx_june_12.png');
                    },
                  ),
                  _buildUploadOption(
                    icon: Icons.folder_shared_rounded,
                    label: 'ABDM Records',
                    onTap: () {
                      Navigator.pop(c);
                      _simulatePrescriptionUpload('abdm_health_lock_rx.pdf');
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUploadOption({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 80,
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primarySurface,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.primary, size: 24),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  void _simulatePrescriptionUpload(String filename) {
    setState(() {
      _isUploadingPrescription = true;
      _uploadedFileName = null;
    });
    
    // Simulate upload progress
    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      setState(() {
        _uploadedFileName = filename;
        _isUploadingPrescription = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              const SizedBox(width: 8),
              Expanded(child: Text('Prescription "$filename" uploaded successfully!')),
            ],
          ),
          backgroundColor: AppColors.secondary,
          behavior: SnackBarBehavior.floating,
        ),
      );
    });
  }

  // ── Generic Alternative Finder ───────────────────────────────────────────
  Widget _buildAlternativeFinder() {
    final filtered = _medicineCatalog.where((med) {
      final query = _medicineSearchQuery.toLowerCase();
      return med['brand'].toString().toLowerCase().contains(query) ||
             med['generic'].toString().toLowerCase().contains(query);
    }).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Alternative Finder (Save up to 75%)',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              if (_medicineSearchQuery.isNotEmpty)
                TextButton(
                  onPressed: () {
                    _medicineSearchController.clear();
                    setState(() {
                      _medicineSearchQuery = '';
                      _selectedAlternative = null;
                    });
                  },
                  child: const Text('Clear', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (_medicineSearchQuery.isEmpty && _selectedAlternative == null) ...[
            const Text(
              'Select popular brand medicines to view cheaper generic substitutes:',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _medicineCatalog.map((med) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ActionChip(
                      label: Text(med['brand']),
                      onPressed: () {
                        setState(() {
                          _selectedAlternative = med;
                        });
                      },
                      backgroundColor: AppColors.surface,
                      side: const BorderSide(color: AppColors.border, width: 0.5),
                      labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                    ),
                  );
                }).toList(),
              ),
            ),
          ] else ...[
            if (_selectedAlternative == null && filtered.isNotEmpty) ...[
              const Text(
                'Matches found in our generic substitutes catalog:',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: AppTheme.cardDecoration(),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final med = filtered[index];
                    return ListTile(
                      dense: true,
                      title: Text(med['brand'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                      subtitle: Text('Alternative: ${med['generic']}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.secondarySurface,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Save ${med['savings']}',
                          style: const TextStyle(color: AppColors.secondaryDark, fontWeight: FontWeight.w800, fontSize: 10),
                        ),
                      ),
                      onTap: () {
                        setState(() {
                          _selectedAlternative = med;
                        });
                      },
                    );
                  },
                ),
              ),
            ] else if (_selectedAlternative != null) ...[
              _buildCompareCard(_selectedAlternative!),
            ] else ...[
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: AppTheme.cardDecoration(),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.info_outline, color: AppColors.textHint, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'No exact matches found. Search generic drug names.',
                      style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildCompareCard(Map<String, dynamic> med) {
    return Container(
      decoration: AppTheme.cardDecoration(
        shadow: AppTheme.shadowMedium,
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.savings_outlined, color: AppColors.secondary, size: 18),
                  SizedBox(width: 6),
                  Text(
                    'Truemeds Price Comparison',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.secondaryDark),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.secondary,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: AppTheme.shadowColored(AppColors.secondary),
                ),
                child: Text(
                  '${med['savings']} cheaper',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              // Left: Brand
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.errorSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.errorLight.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        med['brand'],
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.errorDark),
                      ),
                      const SizedBox(height: 2),
                      Text(med['manufacturer'], style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                      const SizedBox(height: 10),
                      Text(
                        '₹${med['brandPrice']}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textTertiary,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_rounded, color: AppColors.textHint),
              const SizedBox(width: 8),
              // Right: Generic Alternative
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.secondarySurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.secondaryLight.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        med['generic'],
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.secondaryDark),
                      ),
                      const SizedBox(height: 2),
                      Text(med['genericMfg'], style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                      const SizedBox(height: 10),
                      Text(
                        '₹${med['genericPrice']}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.secondaryDark,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            med['description'],
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted, height: 1.3),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _selectedAlternative = null;
                    });
                  },
                  child: const Text('Back to searches'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _orderGenericSubstitute(med),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.secondary,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Add Alternative'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _orderGenericSubstitute(Map<String, dynamic> med) {
    HapticFeedback.mediumImpact();
    _medicineSearchController.clear();
    setState(() {
      _medicineSearchQuery = '';
      _selectedAlternative = null;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.shopping_bag_rounded, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Added ${med['generic']} to your cart! Save ${med['savings']}.',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.secondary,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: 'Checkout',
          textColor: Colors.white,
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Order submitted successfully! Cash on delivery in 24 hours.'), behavior: SnackBarBehavior.floating),
            );
          },
        ),
      ),
    );
  }

  // ── Browse Health Categories Grid ────────────────────────────────────────
  Widget _buildBrowseCategories() {
    final List<Map<String, dynamic>> cats = [
      {'title': 'OTC & Pain', 'icon': Icons.healing_rounded, 'color': AppColors.primary},
      {'title': 'Diabetes Care', 'icon': Icons.water_drop_rounded, 'color': AppColors.error},
      {'title': 'Cardiac Care', 'icon': Icons.favorite_rounded, 'color': AppColors.pink},
      {'title': 'Baby & Child', 'icon': Icons.child_care_rounded, 'color': AppColors.amber},
      {'title': 'Vitamins & Supps', 'icon': Icons.health_and_safety_rounded, 'color': AppColors.secondary},
      {'title': 'All Categories', 'icon': Icons.grid_view_rounded, 'color': AppColors.indigo},
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Browse Health Categories',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.95,
            ),
            itemCount: cats.length,
            itemBuilder: (context, index) {
              final cat = cats[index];
              return Container(
                decoration: AppTheme.cardDecoration(
                  shadow: AppTheme.shadowSubtle,
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Browsing category: ${cat['title']}'), behavior: SnackBarBehavior.floating),
                      );
                    },
                    borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: (cat['color'] as Color).withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(cat['icon'] as IconData, color: cat['color'] as Color, size: 22),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            cat['title'] as String,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // ── ABHA Health ID Widget ────────────────────────────────────────────────
  Widget _buildAbhaSection(String welcomeName) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      decoration: AppTheme.cardDecoration(
        color: AppColors.primarySurface,
        hasBorder: true,
        shadow: AppTheme.shadowSubtle,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (context) => AbhaCardScreen(patientName: welcomeName)));
            },
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.shield_outlined, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ABHA Digital Health ID',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryDark,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Access and share health locker files under ABDM schema.',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.textTertiary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.primary, size: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // Animated double-stacked Card Banner matching mockup
  Widget _buildPromoBanner() {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.85, end: 1.0),
      duration: const Duration(milliseconds: 800),
      curve: Curves.easeOutBack,
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: child,
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        child: Stack(
          children: [
            // Bottom offset card in medical teal
            Positioned.fill(
              child: Container(
                margin: const EdgeInsets.only(top: 8, left: 8),
                decoration: BoxDecoration(
                  gradient: AppColors.tealGradient,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: AppTheme.shadowColored(AppColors.secondary),
                ),
              ),
            ),
            // Foreground dark card
            Container(
              margin: const EdgeInsets.only(bottom: 8, right: 8),
              decoration: BoxDecoration(
                gradient: AppColors.heroGradient,
                borderRadius: BorderRadius.circular(24),
                boxShadow: AppTheme.shadowMedium,
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: -20,
                    top: -20,
                    child: Opacity(
                      opacity: 0.08,
                      child: const Icon(Icons.spa_rounded, color: Colors.white, size: 120),
                    ),
                  ),
                  Positioned(
                    right: 16,
                    top: 16,
                    child: TweenAnimationBuilder<double>(
                      tween: Tween<double>(begin: 0.5, end: 1.0),
                      duration: const Duration(seconds: 2),
                      curve: Curves.elasticOut,
                      builder: (context, val, child) {
                        return Transform.scale(
                          scale: val,
                          child: const Icon(Icons.auto_awesome, color: Colors.amber, size: 20),
                        );
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            gradient: AppColors.primaryGradient,
                            shape: BoxShape.circle,
                            boxShadow: AppTheme.shadowColored(AppColors.primary),
                          ),
                          child: const Icon(
                            Icons.spa_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                        ),
                        const SizedBox(width: 16),
                        const Expanded(
                          child: Text(
                            'Simplifying health management\nfor a healthier tomorrow.',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGlucoseIndicator() {
    final lastGlucose = _glucoseLogs.isNotEmpty ? (_glucoseLogs.first['value'] as num).toDouble() : 95.0;
    final double progress = (lastGlucose / 200.0).clamp(0.0, 1.0);
    return SizedBox(
      width: 46,
      height: 46,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: progress,
            backgroundColor: AppColors.errorSurface,
            color: AppColors.error,
            strokeWidth: 3.5,
          ),
          const Icon(Icons.water_drop_rounded, color: AppColors.error, size: 18),
        ],
      ),
    );
  }

  Widget _buildBmiIndicator() {
    return const SizedBox(
      width: 46,
      height: 46,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: 22.0 / 40.0,
            backgroundColor: AppColors.secondarySurface,
            color: AppColors.secondary,
            strokeWidth: 3.5,
          ),
          Icon(Icons.speed_rounded, color: AppColors.secondary, size: 18),
        ],
      ),
    );
  }

  // Health Manager grid section
  Widget _buildHealthManagerSection(BuildContext context, String welcomeName) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Health Manager',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 14),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              _buildGridItem(
                icon: Icons.water_drop_rounded,
                iconColor: AppColors.error,
                backgroundColor: AppColors.errorSurface,
                title: 'Blood Glucose',
                onTap: _showGlucoseModal,
                trailingIndicator: _buildGlucoseIndicator(),
              ),
              _buildGridItem(
                icon: Icons.speed_rounded,
                iconColor: AppColors.secondary,
                backgroundColor: AppColors.secondarySurface,
                title: 'BMI Calculator',
                onTap: _showBmiModal,
                trailingIndicator: _buildBmiIndicator(),
              ),
              _buildGridItem(
                icon: Icons.history_rounded,
                iconColor: AppColors.primary,
                backgroundColor: AppColors.primarySurface,
                title: 'Medical History',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => PatientRecordScreen(
                        patientName: welcomeName,
                        appointment: Appointment(
                          id: '',
                          patientId: _patientId ?? '71820db3-f8f1-4294-8c11-1dc66ab1056e',
                          doctorId: '',
                          patientName: welcomeName,
                          time: '',
                          type: 'OPD',
                          status: 'Active',
                          symptoms: '',
                        ),
                      ),
                    ),
                  );
                },
              ),
              _buildGridItem(
                icon: Icons.notifications_active_rounded,
                iconColor: AppColors.indigo,
                backgroundColor: AppColors.indigoSurface,
                title: 'Set Reminders',
                onTap: _showRemindersModal,
              ),
              _buildGridItem(
                icon: Icons.vaccines_rounded,
                iconColor: AppColors.cyan,
                backgroundColor: AppColors.cyanSurface,
                title: 'Insulin Dosage',
                onTap: _showInsulinModal,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildGridItem({
    required IconData icon,
    required Color iconColor,
    required Color backgroundColor,
    required String title,
    required VoidCallback onTap,
    Widget? trailingIndicator,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: AppTheme.cardDecoration(
          shadow: AppTheme.shadowSubtle,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (trailingIndicator != null)
              trailingIndicator
            else
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: backgroundColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: AppColors.textPrimary,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Core clinical services links
  Widget _buildHealthServicesSection(BuildContext context, String welcomeName) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'HOSPITAL CLINICAL DESK',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 12,
              color: Color(0xFF64748B),
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildServiceGridItem(
                  context: context,
                  icon: Icons.calendar_month_rounded,
                  title: 'Book Consult',
                  color: const Color(0xFF2563EB),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const PatientAppointmentScreen()),
                    ).then((_) => _loadDashboardData());
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildServiceGridItem(
                  context: context,
                  icon: Icons.receipt_long_rounded,
                  title: 'Lab Reports',
                  color: const Color(0xFF10B981),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const LabResultsScreen()),
                    );
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildServiceGridItem(
                  context: context,
                  icon: Icons.account_balance_wallet_rounded,
                  title: 'My Bills',
                  color: const Color(0xFFF59E0B),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const PatientInvoicesScreen()),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServiceGridItem({
    required BuildContext context,
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUpcomingVisitsSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'UPCOMING VISITS',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 12,
              color: Color(0xFF64748B),
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          _isLoading
              ? const ShimmerCardSkeleton(count: 2)
              : _appointments.isEmpty
                  ? _buildEmptyVisits()
                  : Column(
                      children: _appointments
                          .map((appt) => _buildAppointmentCard(appt))
                          .toList(),
                    ),
        ],
      ),
    );
  }

  Widget _buildEmptyVisits() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Column(
        children: [
          Icon(Icons.calendar_today_outlined, size: 28, color: Color(0xFFCBD5E1)),
          SizedBox(height: 8),
          Text(
            'No active appointments',
            style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildAppointmentCard(Appointment appt) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => PatientRecordScreen(
                appointment: appt,
              ),
            ),
          );
        },
        leading: CircleAvatar(
          backgroundColor: Colors.blue.shade50,
          child: const Icon(Icons.person, color: Color(0xFF0284C7)),
        ),
        title: Text('Dr. ${appt.doctorName ?? 'Practitioner'}', style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('${appt.time} • ${appt.type}'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            appt.status.toUpperCase(),
            style: const TextStyle(color: Color(0xFF3B82F6), fontWeight: FontWeight.bold, fontSize: 9),
          ),
        ),
      ),
    );
  }


  // PROFILE & SYSTEM DIALOGS
  void _showNotifications() {
    showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Notifications'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(Icons.check_circle, color: Colors.green),
              title: Text('Lab Report Published'),
              subtitle: Text('CBC report is now available.'),
            ),
            ListTile(
              leading: Icon(Icons.event, color: Colors.blue),
              title: Text('Appointment Scheduled'),
              subtitle: Text('Consultation booked successfully.'),
            ),
          ],
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('Dismiss'))],
      ),
    );
  }

  void _showProfileDetails() {
    final welcomeName = _patientName ?? 'Patient';
    final mrn = _patientDetails != null ? (_patientDetails['mrn']?.toString() ?? 'N/A') : 'N/A';
    final gender = _patientDetails != null ? (_patientDetails['gender']?.toString() ?? 'N/A') : 'N/A';
    final age = _patientDetails != null ? (_patientDetails['age']?.toString() ?? 'N/A') : 'N/A';
    final abha = _patientDetails != null ? (_patientDetails['abha_id']?.toString() ?? 'N/A') : 'N/A';
    final email = _patientDetails != null ? (_patientDetails['email']?.toString() ?? 'N/A') : 'N/A';

    showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.badge, color: Color(0xFF21274F)),
            SizedBox(width: 8),
            Text('Patient Profile Details'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Name: $welcomeName', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('MRN: $mrn'),
            Text('Gender: $gender'),
            Text('Age: $age'),
            Text('ABHA ID: $abha'),
            Text('Email: $email'),
          ],
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('Close'))],
      ),
    );
  }

  void _showProfileSwitcher() {
    showModalBottomSheet(
      context: context,
      builder: (c) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Patient Profile Options', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ),
          ListTile(
            leading: CircleAvatar(
              backgroundColor: AppColors.primarySurface,
              child: Text(
                _patientName != null && _patientName!.isNotEmpty
                    ? _patientName!.substring(0, 1).toUpperCase()
                    : 'P',
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(_patientName ?? 'Active Patient'),
            subtitle: Text('Active Session ID: ${_patientId ?? 'N/A'}'),
            trailing: const Icon(Icons.check_circle, color: Colors.green),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.secondary),
            title: const Text('Add / Register Another Profile'),
            onTap: () async {
              Navigator.pop(c);
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove('patient_id');
              await prefs.remove('patient_name');
              await prefs.remove('patient_phone');
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (context) => const PatientAuthScreen()),
                );
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.swap_horiz_rounded, color: AppColors.primary),
            title: const Text('Sign In to Different Profile'),
            onTap: () async {
              Navigator.pop(c);
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove('patient_id');
              await prefs.remove('patient_name');
              await prefs.remove('patient_phone');
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (context) => const PatientAuthScreen()),
                );
              }
            },
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  // 1. Blood Glucose Tracker Dialog
  void _showGlucoseModal() {
    final valController = TextEditingController(text: '95');
    String type = 'Fasting';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              left: 24,
              right: 24,
              top: 24,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Blood Glucose Tracker', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: type,
                        decoration: const InputDecoration(labelText: 'Type'),
                        items: const [
                          DropdownMenuItem(value: 'Fasting', child: Text('Fasting')),
                          DropdownMenuItem(value: 'Post-meal', child: Text('Post-meal')),
                          DropdownMenuItem(value: 'Random', child: Text('Random')),
                        ],
                        onChanged: (v) {
                          if (v != null) setModalState(() => type = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextField(
                        controller: valController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Value (mg/dL)'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    final val = int.tryParse(valController.text) ?? 95;
                    final status = val > 140 ? 'High' : (val < 70 ? 'Low' : 'Normal');
                    setState(() {
                      _glucoseLogs.insert(0, {
                        'date': 'Just now',
                        'value': val,
                        'type': type,
                        'status': status,
                      });
                    });
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0066FF), foregroundColor: Colors.white),
                  child: const Text('Add Log'),
                ),
                const SizedBox(height: 20),
                const Text('Recent Logs', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Column(
                  children: _glucoseLogs.map((log) {
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.bloodtype, color: Colors.red),
                      title: Text('${log['value']} mg/dL (${log['type']})'),
                      subtitle: Text(log['date']!),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: log['status'] == 'Normal' ? Colors.green.shade50 : Colors.red.shade50,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          log['status']!,
                          style: TextStyle(
                            color: log['status'] == 'Normal' ? Colors.green : Colors.red,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          );
        });
      },
    );
  }

  // 2. BMI Calculator Bottom Sheet
  void _showBmiModal() {
    final heightController = TextEditingController(text: '165');
    final weightController = TextEditingController(text: '60');
    double? bmi;
    String status = '';
    Color statusColor = Colors.green;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(builder: (context, setModalState) {
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
                const Text('BMI Calculator', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: heightController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Height (cm)', suffixText: 'cm'),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextField(
                        controller: weightController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Weight (kg)', suffixText: 'kg'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    final hCm = double.tryParse(heightController.text) ?? 165;
                    final wKg = double.tryParse(weightController.text) ?? 60;
                    final hM = hCm / 100;
                    final calculated = wKg / (hM * hM);
                    
                    String cat;
                    Color col;
                    if (calculated < 18.5) {
                      cat = 'Underweight';
                      col = Colors.orange;
                    } else if (calculated < 25) {
                      cat = 'Normal';
                      col = Colors.green;
                    } else if (calculated < 30) {
                      cat = 'Overweight';
                      col = Colors.orange;
                    } else {
                      cat = 'Obese';
                      col = Colors.red;
                    }

                    setModalState(() {
                      bmi = calculated;
                      status = cat;
                      statusColor = col;
                    });
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0066FF), foregroundColor: Colors.white),
                  child: const Text('Calculate'),
                ),
                if (bmi != null) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      children: [
                        const Text('Your BMI Index', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(bmi!.toStringAsFixed(1), style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: statusColor)),
                        Text('Category: $status', style: TextStyle(fontWeight: FontWeight.bold, color: statusColor, fontSize: 16)),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 12),
              ],
            ),
          );
        });
      },
    );
  }

  // 3. Reminders Manager
  void _showRemindersModal() {
    final titleController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(builder: (context, setModalState) {
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
                const Text('Daily Medicine Reminders', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: titleController,
                        decoration: const InputDecoration(labelText: 'Medicine Name & Dosage'),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_circle, color: Color(0xFF0066FF), size: 36),
                      onPressed: () {
                        if (titleController.text.isNotEmpty) {
                          setState(() {
                            _reminders.add({
                              'time': '09:00 AM',
                              'title': titleController.text,
                              'active': true,
                            });
                          });
                          setModalState(() {
                            titleController.clear();
                          });
                        }
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Column(
                  children: _reminders.asMap().entries.map((entry) {
                    final index = entry.key;
                    final rem = entry.value;
                    return SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(rem['title']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Schedule: ${rem['time']}'),
                      value: rem['active'],
                      onChanged: (v) {
                        setState(() {
                          _reminders[index]['active'] = v;
                        });
                        setModalState(() {});
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          );
        });
      },
    );
  }

  // 4. Insulin Dosage Logger
  void _showInsulinModal() {
    final valController = TextEditingController(text: '12');
    String type = 'Lantus';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(builder: (context, setModalState) {
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
                const Text('Insulin Dosage Logger', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: type,
                        decoration: const InputDecoration(labelText: 'Insulin Brand/Type'),
                        items: const [
                          DropdownMenuItem(value: 'Lantus', child: Text('Lantus (Long-acting)')),
                          DropdownMenuItem(value: 'Humalog', child: Text('Humalog (Rapid-acting)')),
                          DropdownMenuItem(value: 'Novolog', child: Text('Novolog (Rapid-acting)')),
                        ],
                        onChanged: (v) {
                          if (v != null) setModalState(() => type = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextField(
                        controller: valController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Units'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    final val = int.tryParse(valController.text) ?? 12;
                    setState(() {
                      _insulinLogs.insert(0, {
                        'date': 'Just now',
                        'units': val,
                        'type': type,
                      });
                    });
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0066FF), foregroundColor: Colors.white),
                  child: const Text('Log Dosage'),
                ),
                const SizedBox(height: 20),
                const Text('Recent Dosage Logs', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Column(
                  children: _insulinLogs.map((log) {
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.vaccines, color: Colors.teal),
                      title: Text('${log['units']} Units - ${log['type']}'),
                      subtitle: Text(log['date']!),
                    );
                  }).toList(),
                ),
              ],
            ),
          );
        });
      },
    );
  }
}

class ListfulDrawerItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  const ListfulDrawerItem({super.key, required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: const Color(0xFF21274F)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
      onTap: onTap,
    );
  }
}
