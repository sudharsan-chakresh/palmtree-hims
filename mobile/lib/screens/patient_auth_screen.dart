import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'patient_dashboard_screen.dart';
import 'login_screen.dart';

final patientTenantsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getPublicTenants();
  return response.data as List<dynamic>;
});

class PatientAuthScreen extends ConsumerStatefulWidget {
  const PatientAuthScreen({super.key});

  @override
  ConsumerState<PatientAuthScreen> createState() => _PatientAuthScreenState();
}

class _PatientAuthScreenState extends ConsumerState<PatientAuthScreen> {
  bool _isSignUp = false;
  final _loginQueryController = TextEditingController();
  final _signUpNameController = TextEditingController();
  final _signUpPhoneController = TextEditingController();
  final _signUpEmailController = TextEditingController();
  final _signUpAbhaController = TextEditingController();
  final _signUpDobController = TextEditingController();

  String? _selectedFacilityId;
  String _signUpGender = 'Male';
  DateTime? _signUpDob;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _loginQueryController.dispose();
    _signUpNameController.dispose();
    _signUpPhoneController.dispose();
    _signUpEmailController.dispose();
    _signUpAbhaController.dispose();
    _signUpDobController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 30)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _signUpDob = picked;
        _signUpDobController.text =
            "${picked.day.toString().padLeft(2, '0')}/${picked.month.toString().padLeft(2, '0')}/${picked.year}";
      });
    }
  }

  Future<void> _handlePatientLookup() async {
    final query = _loginQueryController.text.trim();
    if (query.isEmpty) {
      setState(() => _errorMessage = 'Enter your Phone Number or Patient MRN');
      return;
    }
    if (_selectedFacilityId == null) {
      setState(() => _errorMessage = 'Please select a facility/hospital');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    HapticFeedback.mediumImpact();

    try {
      final api = ref.read(apiServiceProvider);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('tenant_id', _selectedFacilityId!);

      final searchRes = await api.searchPatients(query);
      final list = searchRes.data;

      if (list is List && list.isNotEmpty) {
        final patient = list.firstWhere(
          (p) =>
              p['phone']?.toString().contains(query) == true ||
              p['mrn']?.toString().toLowerCase() == query.toLowerCase(),
          orElse: () => list.first,
        );

        await prefs.setString('patient_id', patient['id'].toString());
        await prefs.setString('patient_name', patient['name'].toString());
        await prefs.setString('patient_phone', patient['phone']?.toString() ?? '');
        await prefs.setString('user_role', 'patient');

        if (mounted) {
          Navigator.pushReplacement(
            context,
            PageRouteBuilder(
              pageBuilder: (_, __, ___) => const PatientDashboardScreen(),
              transitionDuration: const Duration(milliseconds: 500),
              transitionsBuilder: (_, animation, __, child) {
                return FadeTransition(opacity: animation, child: child);
              },
            ),
          );
        }
      } else {
        setState(() => _errorMessage =
            'No patient record found in this hospital with that search query. Please switch to register.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Lookup failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handlePatientRegister() async {
    final name = _signUpNameController.text.trim();
    final phone = _signUpPhoneController.text.trim();
    final email = _signUpEmailController.text.trim();
    final abhaId = _signUpAbhaController.text.trim();

    if (name.isEmpty || phone.isEmpty) {
      setState(() => _errorMessage = 'Name and Phone number are required');
      return;
    }
    if (_selectedFacilityId == null) {
      setState(() => _errorMessage = 'Please select a facility/hospital');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    HapticFeedback.mediumImpact();

    try {
      final api = ref.read(apiServiceProvider);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('tenant_id', _selectedFacilityId!);

      final dobStr = _signUpDob != null
          ? "${_signUpDob!.year}-${_signUpDob!.month.toString().padLeft(2, '0')}-${_signUpDob!.day.toString().padLeft(2, '0')}"
          : null;

      int age = 0;
      if (_signUpDob != null) {
        age = DateTime.now().year - _signUpDob!.year;
      }

      final regRes = await api.registerPatient({
        'name': name,
        'phone': phone,
        'email': email,
        'gender': _signUpGender,
        'age': age,
        'dob': dobStr,
        'abhaId': abhaId,
        'abhaStatus': '',
        'abhaVerified': false,
      });

      final patient = regRes.data;
      if (patient is Map && patient['id'] != null) {
        await prefs.setString('patient_id', patient['id'].toString());
        await prefs.setString('patient_name', patient['name'].toString());
        await prefs.setString('patient_phone', patient['phone']?.toString() ?? '');
        await prefs.setString('user_role', 'patient');

        if (mounted) {
          Navigator.pushReplacement(
            context,
            PageRouteBuilder(
              pageBuilder: (_, __, ___) => const PatientDashboardScreen(),
              transitionDuration: const Duration(milliseconds: 500),
              transitionsBuilder: (_, animation, __, child) {
                return FadeTransition(opacity: animation, child: child);
              },
            ),
          );
        }
      } else {
        setState(() => _errorMessage = 'Registration failed. Backend returned empty response.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Registration failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showFacilitySelector(List<dynamic> tenants) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.75,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: AppColors.textHint.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2.5),
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(28),
                child: Text(
                  'Select Hospital',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  itemCount: tenants.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final tenant = tenants[index];
                    final tenantId = tenant['id'].toString();
                    final isSelected = _selectedFacilityId == tenantId;
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _selectedFacilityId = tenantId);
                          Navigator.pop(context);
                        },
                        borderRadius: BorderRadius.circular(24),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primarySurface
                                : Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.border,
                              width: 2,
                            ),
                            boxShadow: [
                              if (!isSelected)
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.02),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                )
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: isSelected ? AppColors.primary : Colors.grey.shade50,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.local_hospital_rounded,
                                  color: isSelected ? Colors.white : AppColors.textMuted,
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Text(
                                  tenant['name'].toString(),
                                  style: TextStyle(
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    fontSize: 16,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              if (isSelected)
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: AppColors.primary,
                                  size: 26,
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 36),
            ],
          ),
        );
      },
    );
  }

  Widget _buildGenderChip(String label) {
    final isSelected = _signUpGender == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        selectedColor: AppColors.primarySurface,
        backgroundColor: AppColors.surface,
        labelStyle: TextStyle(
          color: isSelected ? AppColors.primary : AppColors.textTertiary,
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
        checkmarkColor: AppColors.primary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        onSelected: (v) {
          if (v) setState(() => _signUpGender = label);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tenantsAsync = ref.watch(patientTenantsProvider);

    return Scaffold(
      backgroundColor: Colors.white, // Pure white background
      body: Stack(
        fit: StackFit.expand,
        children: [
          SafeArea(
            child: Column(
              children: [
                // Header Row (Back + Title)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
                        onPressed: () {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                          );
                        },
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Patient Portal Onboarding',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                    child: Column(
                      children: [
                        // Header Logo & Branding
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.15),
                                blurRadius: 40,
                                spreadRadius: 5,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: Image.asset(
                            'assets/logo.png',
                            height: 50,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.health_and_safety_rounded,
                              size: 50,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Jioplix Patient Portal',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Access clinical schedules & manage digital health records',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Hospital Selector Dropdown Card
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 20,
                                offset: const Offset(0, 5),
                              )
                            ],
                            border: Border.all(color: AppColors.border, width: 1.5),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: tenantsAsync.when(
                              data: (tenants) {
                                if (_selectedFacilityId == null && tenants.isNotEmpty) {
                                  _selectedFacilityId = tenants.first['id'].toString();
                                }
                                final activeName = tenants.firstWhere(
                                  (t) => t['id'].toString() == _selectedFacilityId,
                                  orElse: () => {'name': 'Select Hospital'},
                                )['name'].toString();

                                return _buildFacilitySelectorButton(activeName, () => _showFacilitySelector(tenants));
                              },
                              loading: () => const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(16.0),
                                  child: SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
                                  ),
                                ),
                              ),
                              error: (e, __) => _buildFacilitySelectorButton('API Connection Error', () {
                                ref.refresh(patientTenantsProvider);
                              }),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Tab Chip Toggles (Lookup vs SignUp)
                        Container(
                          height: 52,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setState(() {
                                    _isSignUp = false;
                                    _errorMessage = null;
                                  }),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: !_isSignUp ? Colors.white : Colors.transparent,
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: !_isSignUp ? [
                                        BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10)
                                      ] : null,
                                    ),
                                    child: Text(
                                      'Sign In / Lookup',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: !_isSignUp ? AppColors.textPrimary : AppColors.textMuted,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setState(() {
                                    _isSignUp = true;
                                    _errorMessage = null;
                                  }),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: _isSignUp ? Colors.white : Colors.transparent,
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: _isSignUp ? [
                                        BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10)
                                      ] : null,
                                    ),
                                    child: Text(
                                      'Register Profile',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: _isSignUp ? AppColors.textPrimary : AppColors.textMuted,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Dynamic Height Form Card
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 30,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: AnimatedSize(
                            duration: const Duration(milliseconds: 250),
                            curve: Curves.easeInOut,
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: _isSignUp ? _buildRegisterForm() : _buildLookupForm(),
                            ),
                          ),
                        ),

                        // Error box if any
                        if (_errorMessage != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.errorSurface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.errorLight),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: const TextStyle(
                                      color: AppColors.errorDark,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLookupForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Find Existing Patient Profile',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 6),
        const Text(
          'Enter phone number or medical records identifier (MRN) to synchronize your data.',
          style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _loginQueryController,
          keyboardType: TextInputType.text,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary, fontSize: 16),
          decoration: InputDecoration(
            labelText: 'Phone Number or MRN',
            filled: true,
            fillColor: AppColors.surface,
            prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: const BorderSide(color: AppColors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
          ),
        ),
        const SizedBox(height: 32),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handlePatientLookup,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text(
                    'ACCESS PORTAL',
                    style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5, fontSize: 15),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Register New Patient Account',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 6),
        const Text(
          'Create a new digital profile in the selected hospital system.',
          style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _signUpNameController,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          decoration: InputDecoration(
            labelText: 'Full Name',
            filled: true, fillColor: AppColors.surface,
            prefixIcon: const Icon(Icons.person_outline_rounded, color: AppColors.textMuted, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _signUpPhoneController,
          keyboardType: TextInputType.phone,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          decoration: InputDecoration(
            labelText: 'Phone Number',
            filled: true, fillColor: AppColors.surface,
            prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.textMuted, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _signUpDobController,
          readOnly: true,
          onTap: _pickDate,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          decoration: InputDecoration(
            labelText: 'Birth Date',
            filled: true, fillColor: AppColors.surface,
            prefixIcon: const Icon(Icons.calendar_month_outlined, color: AppColors.textMuted, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Gender',
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textTertiary, fontSize: 13),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: ['Male', 'Female', 'Other'].map((g) => _buildGenderChip(g)).toList(),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _signUpEmailController,
          keyboardType: TextInputType.emailAddress,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          decoration: InputDecoration(
            labelText: 'Email (Optional)',
            filled: true, fillColor: AppColors.surface,
            prefixIcon: const Icon(Icons.email_outlined, color: AppColors.textMuted, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _signUpAbhaController,
          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          decoration: InputDecoration(
            labelText: 'ABHA ID / Number (Optional)',
            filled: true, fillColor: AppColors.surface,
            prefixIcon: const Icon(Icons.badge_outlined, color: AppColors.textMuted, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 24),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handlePatientRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text(
                    'CREATE ACCOUNT',
                    style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5, fontSize: 15),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildFacilitySelectorButton(String text, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: const BoxDecoration(
                  color: AppColors.primarySurface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.business_rounded, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SELECTED HOSPITAL',
                      style: TextStyle(fontSize: 10, color: AppColors.textHint, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      text,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.unfold_more_rounded, color: AppColors.textHint),
            ],
          ),
        ),
      ),
    );
  }
}
