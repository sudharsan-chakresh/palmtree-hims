import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/breadcrumb.dart';
import '../services/api_service.dart';

class OPDRegistrationScreen extends ConsumerStatefulWidget {
  const OPDRegistrationScreen({super.key});

  @override
  ConsumerState<OPDRegistrationScreen> createState() => _OPDRegistrationScreenState();
}

class _OPDRegistrationScreenState extends ConsumerState<OPDRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();

  // Patient Details
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _abhaIdController = TextEditingController();
  String _gender = 'Male';

  // ABHA State
  String _aadhaarInput = '';
  String _otpInput = '';
  String? _txnId;
  bool _isAbhaLoading = false;
  bool _isAbhaVerified = false;
  bool _hasConsent = false;

  // Clinical State
  final _weightController = TextEditingController();
  final _bpController = TextEditingController();
  String? _selectedDoctorId;
  List<dynamic> _doctors = [];
  bool _isLoadingDoctors = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchDoctors();
  }

  Future<void> _fetchDoctors() async {
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getDoctors();
      final data = res.data;
      setState(() {
        _doctors = data is List
            ? data
            : (data is Map && data['data'] is List)
                ? data['data']
                : [];
        _isLoadingDoctors = false;
      });
    } catch (e) {
      setState(() => _isLoadingDoctors = false);
    }
  }

  Future<void> _finalizeRegistration() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();

    if (name.isEmpty || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Enter patient name and phone number'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    if (_selectedDoctorId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Select a consultant'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = ref.read(apiServiceProvider);
      final patientRes = await api.registerPatient({
        'name': name,
        'phone': phone,
        'gender': _gender,
        'age': 0,
        'abhaId': _abhaIdController.text.trim(),
        'abhaStatus': _isAbhaVerified ? 'Verified' : '',
        'abhaVerified': _isAbhaVerified,
      });

      final patient = patientRes.data;
      final patientId = patient is Map ? patient['id']?.toString() : null;
      if (patientId == null || patientId.isEmpty) {
        throw Exception('Patient registration did not return an ID');
      }

      await api.createEncounter({
        'patientId': patientId,
        'doctorId': _selectedDoctorId,
        'diagnosis': '',
        'notes': 'OPD token issued from mobile intake desk.',
        'vitals': {
          'bp': _bpController.text.trim(),
          'pulse': 0,
          'temp': 0,
          'weight': _weightController.text.trim(),
        },
        'complaints': const <String>[],
        'prescriptions': const <Map<String, dynamic>>[],
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white),
              SizedBox(width: 8),
              Expanded(child: Text('Patient registered, encounter created, and token issued')),
            ],
          ),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Registration failed: $e'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _abhaIdController.dispose();
    _weightController.dispose();
    _bpController.dispose();
    super.dispose();
  }

  Future<void> _generateAbhaOtp() async {
    if (_aadhaarInput.length != 12) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Enter a valid 12-digit Aadhaar number'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }
    setState(() => _isAbhaLoading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.generateAbhaOtp(_aadhaarInput);
      if (!mounted) return;
      setState(() {
        _txnId = res.data['txnId'];
        _isAbhaLoading = false;
      });
      _showOtpDialog();
    } catch (e) {
      setState(() => _isAbhaLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Failed to generate OTP. Try again.'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  Future<void> _verifyAbhaOtp() async {
    if (_otpInput.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Enter a valid OTP code'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }
    setState(() => _isAbhaLoading = true);
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.verifyAbhaOtp(_otpInput, _txnId!);
      final profile = res.data;
      if (!mounted) return;
      setState(() {
        _nameController.text = profile['name'] ?? '';
        _gender = profile['gender'] == 'M' ? 'Male' : 'Female';
        _abhaIdController.text = profile['healthId'] ?? '';
        _isAbhaVerified = true;
        _isAbhaLoading = false;
      });
      Navigator.pop(context); // Close OTP Dialog
    } catch (e) {
      if (!mounted) return;
      setState(() => _isAbhaLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Verification Failed. Please check the OTP code.'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  void _showOtpDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Row(
          children: [
            Icon(Icons.lock_outline, color: Color(0xFF2563EB)),
            SizedBox(width: 10),
            Text('Enter Aadhaar OTP', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('A verification code has been sent to the Aadhaar-linked phone.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            const SizedBox(height: 16),
            TextField(
              onChanged: (v) => _otpInput = v,
              keyboardType: TextInputType.number,
              style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 3, fontSize: 16),
              decoration: InputDecoration(
                hintText: '6-digit OTP',
                hintStyle: const TextStyle(letterSpacing: 0, fontSize: 14),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: _verifyAbhaOtp,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            child: const Text('Verify Identity'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        scrolledUnderElevation: 0,
        backgroundColor: Colors.white,
        title: const Text('OPD Registration'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Breadcrumb(paths: ['Front Desk', 'OPD Intake Registration']),
              const SizedBox(height: 20),

              // ABHA SECTION CARD
              _buildFormCard(
                icon: Icons.shield_outlined,
                title: 'ABDM DIGITAL HEALTH IDENTITY',
                color: const Color(0xFF2563EB),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Checkbox(
                          value: _hasConsent,
                          onChanged: (v) => setState(() => _hasConsent = v!),
                          activeColor: const Color(0xFF2563EB),
                        ),
                        const Expanded(
                          child: Text(
                            'I consent to verify & retrieve ABDM digital health records.',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (!_isAbhaVerified) ...[
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              onChanged: (v) => _aadhaarInput = v,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: '12-digit Aadhaar Number',
                                prefixIcon: const Icon(Icons.badge, size: 20),
                                suffixIcon: _isAbhaLoading
                                    ? const Padding(
                                        padding: EdgeInsets.all(12),
                                        child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB))),
                                      )
                                    : null,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          ElevatedButton(
                            onPressed: _hasConsent && !_isAbhaLoading ? _generateAbhaOtp : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            child: const Text('OTP', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 22),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'ABHA Identity Verified',
                                    style: TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  if (_abhaIdController.text.isNotEmpty)
                                    Text(
                                      'ABHA: ${_abhaIdController.text}',
                                      style: const TextStyle(color: Color(0xFF047857), fontSize: 12, fontWeight: FontWeight.w600),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // PATIENT DEMOGRAPHICS CARD
              _buildFormCard(
                icon: Icons.person_outline,
                title: 'PATIENT DEMOGRAPHICS',
                color: const Color(0xFF0F172A),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildTextField(_nameController, 'Full Name', Icons.person),
                    const SizedBox(height: 16),
                    _buildTextField(_phoneController, 'Phone Number', Icons.phone, keyboardType: TextInputType.phone),
                    const SizedBox(height: 20),
                    const Text(
                      'Gender Selector',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF475569)),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: ['Male', 'Female', 'Other']
                          .map((g) => _buildGenderChip(g))
                          .toList(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // INITIAL VITALS CARD
              _buildFormCard(
                icon: Icons.monitor_heart_outlined,
                title: 'INITIAL CLINICAL VITALS',
                color: const Color(0xFF059669),
                child: Row(
                  children: [
                    Expanded(child: _buildTextField(_weightController, 'Weight (kg)', Icons.scale)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildTextField(_bpController, 'BP (Sys/Dia)', Icons.speed)),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ASSIGN CONSULTANT CARD
              _buildFormCard(
                icon: Icons.assignment_ind_outlined,
                title: 'ASSIGN CLINICAL CONSULTANT',
                color: const Color(0xFF4F46E5),
                child: _isLoadingDoctors
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(color: Color(0xFF4F46E5)),
                        ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Select an active duty physician for consultation assignment:',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 12),
                          ..._doctors.map((doc) => _buildDoctorCard(doc)),
                        ],
                      ),
              ),
              const SizedBox(height: 32),

              // FINALIZE ACTION BUTTON
              ElevatedButton(
                onPressed: _isSubmitting ? null : _finalizeRegistration,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 60),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 2,
                  shadowColor: const Color(0xFF0F172A).withOpacity(0.25),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'FINALIZE & ISSUE INTAKE TOKEN',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, letterSpacing: 0.5),
                          ),
                        ],
                      ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFormCard({required IconData icon, required String title, required Color color, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: color,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon, {TextInputType keyboardType = TextInputType.text}) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: const Color(0xFF64748B), size: 20),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }

  Widget _buildGenderChip(String label) {
    final isSelected = _gender == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (v) => setState(() => _gender = label),
        selectedColor: const Color(0xFF2563EB),
        checkmarkColor: Colors.white,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : const Color(0xFF475569),
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(
            color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0),
          ),
        ),
        backgroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _buildDoctorCard(dynamic doc) {
    final id = doc is Map ? doc['id']?.toString() : null;
    final isSelected = id != null && _selectedDoctorId == id;
    final String name = doc is Map ? (doc['name']?.toString() ?? 'Doctor') : 'Doctor';
    final String specialization = doc is Map ? (doc['specialization']?.toString() ?? 'Consultant') : 'Consultant';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
          width: isSelected ? 2.0 : 1.0,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: id == null ? null : () => setState(() => _selectedDoctorId = id),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: isSelected ? Colors.white : const Color(0xFFF1F5F9),
                    radius: 20,
                    child: Icon(
                      Icons.person,
                      color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: isSelected ? const Color(0xFF1E3A8A) : const Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          specialization,
                          style: TextStyle(
                            fontSize: 12,
                            color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isSelected)
                    const Icon(Icons.check_circle_rounded, color: Color(0xFF2563EB)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
