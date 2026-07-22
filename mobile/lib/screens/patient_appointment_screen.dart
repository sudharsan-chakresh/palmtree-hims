import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../widgets/breadcrumb.dart';
import '../models/appointment.dart';
import 'patient_record_screen.dart';

class PatientAppointmentScreen extends ConsumerStatefulWidget {
  const PatientAppointmentScreen({super.key});

  @override
  ConsumerState<PatientAppointmentScreen> createState() =>
      _PatientAppointmentScreenState();
}

class _PatientAppointmentScreenState
    extends ConsumerState<PatientAppointmentScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _abhaIdController = TextEditingController();
  final _weightController = TextEditingController();
  final _bpController = TextEditingController();
  final _tempController = TextEditingController();
  final _complaintController = TextEditingController();

  String _gender = 'Male';
  bool _isSubmitting = false;
  bool _isLoadingDoctors = true;
  bool _isLoadingTenants = true;
  List<dynamic> _doctors = [];
  List<dynamic> _tenants = [];
  String? _selectedDoctorId;
  String? _selectedTenantId;
  bool _isValidatingSlot = false;
  bool _slotAvailable = false;
  String? _slotValidationMessage;
  DateTime _appointmentDate = DateTime.now();
  TimeOfDay _appointmentTime = TimeOfDay.now();
  String? _loggedInPatientId;

  @override
  void initState() {
    super.initState();
    _loadPatientInfo();
    _loadTenants();
  }

  Future<void> _loadPatientInfo() async {
    final prefs = await SharedPreferences.getInstance();
    final patientId = prefs.getString('patient_id');
    final patientName = prefs.getString('patient_name');
    final patientPhone = prefs.getString('patient_phone');

    if (patientId != null) {
      setState(() {
        _loggedInPatientId = patientId;
        _nameController.text = patientName ?? '';
        _phoneController.text = patientPhone ?? '';
      });
    }
  }

  Future<void> _loadTenants() async {
    setState(() {
      _isLoadingTenants = true;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final prefs = await SharedPreferences.getInstance();
      final tenantsRes = await api.getPublicTenants();
      final tenantsData = tenantsRes.data as List<dynamic>;
      final stored = prefs.getString('tenant_id');

      setState(() {
        _tenants = tenantsData;
        _selectedTenantId = stored ?? (tenantsData.isNotEmpty ? tenantsData.first['id'].toString() : null);
      });

      if (_selectedTenantId != null) {
        await prefs.setString('tenant_id', _selectedTenantId!);
        await _fetchDoctors();
      } else {
        setState(() => _isLoadingDoctors = false);
      }
    } catch (e) {
      setState(() {
        _tenants = [];
        _isLoadingDoctors = false;
      });
    } finally {
      setState(() => _isLoadingTenants = false);
    }
  }

  Future<void> _fetchDoctors() async {
    try {
      final api = ref.read(apiServiceProvider);
      setState(() => _isLoadingDoctors = true);
      final prefs = await SharedPreferences.getInstance();
      final tenantToUse = _selectedTenantId ?? prefs.getString('tenant_id');
      if (tenantToUse == null) {
        setState(() => _isLoadingDoctors = false);
        return;
      }

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
      await _validateSlot();
    } catch (e) {
      setState(() => _isLoadingDoctors = false);
    }
  }

  Future<void> _validateSlot() async {
    if (_selectedDoctorId == null) {
      setState(() {
        _slotAvailable = false;
        _slotValidationMessage = 'Select a doctor to see availability';
      });
      return;
    }

    setState(() {
      _isValidatingSlot = true;
      _slotValidationMessage = null;
    });

    try {
      final api = ref.read(apiServiceProvider);
      final appointmentDateTime = DateTime(
        _appointmentDate.year,
        _appointmentDate.month,
        _appointmentDate.day,
        _appointmentTime.hour,
        _appointmentTime.minute,
      );
      final res = await api.validateAppointmentSlot(
        _selectedDoctorId!,
        appointmentDateTime.toIso8601String(),
      );
      final data = res.data;

      setState(() {
        _slotAvailable = data is Map && data['isValid'] == true;
        _slotValidationMessage = data is Map
            ? (data['error'] ?? data['message'] ?? 'Availability check complete')
            : 'Unable to validate slot';
      });
    } catch (e) {
      setState(() {
        _slotAvailable = false;
        _slotValidationMessage = 'Unable to validate slot. Please try again.';
      });
    } finally {
      setState(() => _isValidatingSlot = false);
    }
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _appointmentDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (date != null) {
      setState(() {
        _appointmentDate = date;
      });
        await _validateSlot();
    }
  }

  Future<void> _pickTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _appointmentTime,
    );
    if (time != null) {
      setState(() {
        _appointmentTime = time;
      });
        await _validateSlot();
    }
  }

  Future<void> _submitAppointment() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    final bp = _bpController.text.trim();
    final temp = _tempController.text.trim();
    final weight = _weightController.text.trim();

    if (name.isEmpty || phone.isEmpty) {
      _showMessage('Enter patient name and phone number');
      return;
    }
    if (_selectedTenantId == null) {
      _showMessage('Select a facility before booking');
      return;
    }

    if (_selectedDoctorId == null) {
      _showMessage('Select a doctor for your consultation');
      return;
    }
    if (!_slotAvailable) {
      _showMessage(_slotValidationMessage ?? 'Selected slot is not available');
      return;
    }
    // Vitals are optional for patient self-booking and will be validated/captured by triage nurses.


    String? patientId = _loggedInPatientId;

    setState(() => _isSubmitting = true);

    try {
      final api = ref.read(apiServiceProvider);
      if (patientId == null || patientId.isEmpty) {
        final patientRes = await api.registerPatient({
          'name': name,
          'phone': phone,
          'gender': _gender,
          'age': 0,
          'abhaId': _abhaIdController.text.trim(),
          'abhaStatus': '',
          'abhaVerified': false,
        });

        final patient = patientRes.data;
        patientId = patient is Map ? patient['id']?.toString() : null;
        if (patientId == null || patientId.isEmpty) {
          throw Exception('Patient registration did not return an ID');
        }
      }

      final appointmentDateTime = DateTime(
        _appointmentDate.year,
        _appointmentDate.month,
        _appointmentDate.day,
        _appointmentTime.hour,
        _appointmentTime.minute,
      );

      final apptRes = await api.createAppointment({
        'patient_id': patientId,
        'doctor_id': _selectedDoctorId,
        'appointment_time': appointmentDateTime.toIso8601String(),
        'status': 'Scheduled',
      });

      final apptData = apptRes.data;
      final apptId = apptData is Map ? apptData['id']?.toString() : '';

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('patient_id', patientId);
      await prefs.setString('patient_name', name);
      await prefs.setString('patient_phone', phone);

      await api.createActiveEncounter({
        'patientId': patientId,
        'doctorId': _selectedDoctorId,
        'type': 'OPD',
        'vitals': {
          'bp': bp.isEmpty ? 'N/A' : bp,
          'pulse': 0,
          'heartRate': 0,
          'temp': temp.isEmpty ? 0.0 : (double.tryParse(temp) ?? 98.6),
          'weight': weight.isEmpty ? 0.0 : (double.tryParse(weight) ?? 70.0),
        },
        'complaints': _complaintController.text.trim().isEmpty
            ? 'Urgent consultation request'
            : _complaintController.text.trim(),
      });

      if (!mounted) return;

      _showMessage('Appointment booked successfully', success: true);

      final appointment = Appointment(
        id: apptId ?? '',
        patientId: patientId,
        doctorId: _selectedDoctorId,
        patientName: name,
        time: _appointmentTime.format(context),
        type: 'OPD',
        status: 'Scheduled',
        symptoms: _complaintController.text.trim(),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => PatientRecordScreen(
            appointment: appointment,
            fallbackDoctorId: _selectedDoctorId,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _showMessage('Booking failed: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showMessage(String message, {bool success = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: success ? Colors.green : null,
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _abhaIdController.dispose();
    _weightController.dispose();
    _bpController.dispose();
    _tempController.dispose();
    _complaintController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf8fafc),
      appBar: AppBar(
        title: const Text('Self Appointment & Consultation'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1e293b),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Breadcrumb(paths: [
              'Patient',
              'Self-Service',
              'Appointment & Consultation'
            ]),
            const SizedBox(height: 20),
            _buildSectionTitle(Icons.person_add, 'Patient Details'),
            _buildTextField(_nameController, 'Full Name', Icons.person, readOnly: _loggedInPatientId != null),
            const SizedBox(height: 16),
            _buildTextField(
                _phoneController, 'Phone Number', Icons.phone,
                keyboardType: TextInputType.phone, readOnly: _loggedInPatientId != null),
            const SizedBox(height: 16),
            const Text('Gender',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Color(0xFF64748b))),
            const SizedBox(height: 8),
            Row(
              children: ['Male', 'Female', 'Other']
                  .map((g) => _buildGenderChip(g))
                  .toList(),
            ),
            const SizedBox(height: 32),
            _buildSectionTitle(Icons.monitor_heart, 'Vitals (By Patient)'),
            Row(
              children: [
                Expanded(
                    child: _buildTextField(
                        _weightController, 'Weight (kg)', Icons.scale,
                        keyboardType: TextInputType.number)),
                const SizedBox(width: 16),
                Expanded(
                    child: _buildTextField(
                        _bpController, 'BP (Sys/Dia)', Icons.speed,
                        keyboardType: TextInputType.text)),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: _buildTextField(
                        _tempController, 'Temperature', Icons.thermostat,
                        keyboardType: TextInputType.number)),
                const SizedBox(width: 16),
                Expanded(
                    child: _buildTextField(
                        _complaintController, 'Primary Complaint',
                        Icons.note,
                        keyboardType: TextInputType.text)),
              ],
            ),
            const SizedBox(height: 32),
            _buildSectionTitle(Icons.calendar_today, 'Appointment Slot'),
            Row(
              children: [
                Expanded(
                  child: _buildPickerButton('Date',
                      '${_appointmentDate.day.toString().padLeft(2, '0')}/${_appointmentDate.month.toString().padLeft(2, '0')}/${_appointmentDate.year}',
                      _pickDate),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildPickerButton(
                      'Time', _appointmentTime.format(context), _pickTime),
                ),
              ],
            ),
            const SizedBox(height: 32),
            _buildSectionTitle(Icons.local_hospital, 'Choose Facility / Doctor'),
            _isLoadingTenants
                ? const Center(child: CircularProgressIndicator())
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _selectedTenantId,
                        decoration: InputDecoration(
                          labelText: 'Select Facility',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16)),
                          prefixIcon:
                              const Icon(Icons.business, color: Color(0xFF0284c7)),
                          filled: true,
                          fillColor: Colors.white,
                        ),
                        items: _tenants.map((dynamic t) {
                          return DropdownMenuItem<String>(
                            value: t['id'].toString(),
                            child: Text(t['name'].toString()),
                          );
                        }).toList(),
                        onChanged: (v) async {
                          if (v == null) return;
                          setState(() {
                            _selectedTenantId = v;
                            _isLoadingDoctors = true;
                            _selectedDoctorId = null;
                            _slotAvailable = false;
                            _slotValidationMessage = null;
                          });
                          final prefs = await SharedPreferences.getInstance();
                          await prefs.setString('tenant_id', v);
                          await _fetchDoctors();
                        },
                      ),
                      const SizedBox(height: 12),
                      _isLoadingDoctors
                          ? const Center(child: CircularProgressIndicator())
                          : Column(
                              children: _doctors
                                  .map((doc) => _buildDoctorCard(doc))
                                  .toList(),
                            ),
                      const SizedBox(height: 12),
                      if (_isValidatingSlot)
                        const Row(
                          children: [
                            SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 10),
                            Text('Checking doctor availability...'),
                          ],
                        )
                      else if (_slotValidationMessage != null)
                        Text(
                          _slotValidationMessage!,
                          style: TextStyle(
                            color: _slotAvailable ? Colors.green : Colors.red,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitAppointment,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 64),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.event_available_rounded),
                        SizedBox(width: 12),
                        Text('BOOK APPOINTMENT & REQUEST CONSULTATION',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                      ],
                    ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(IconData icon, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF2563EB)),
          const SizedBox(width: 8),
          Text(title,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF64748B),
                  letterSpacing: 1.1)),
        ],
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label,
      IconData icon,
      {TextInputType keyboardType = TextInputType.text, bool readOnly = false}) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      readOnly: readOnly,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
        filled: true,
        fillColor: readOnly ? const Color(0xFFF1F5F9) : Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      ),
    );
  }

  Widget _buildPickerButton(String label, String value, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF64748B))),
            const SizedBox(height: 6),
            Text(value,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B))),
          ],
        ),
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
        selectedColor: const Color(0xFFEFF6FF),
        backgroundColor: Colors.white,
        labelStyle: TextStyle(
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF475569),
          fontWeight: FontWeight.bold,
        ),
        checkmarkColor: const Color(0xFF2563EB),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
          ),
        ),
        onSelected: (v) => setState(() => _gender = label),
      ),
    );
  }

  Widget _buildDoctorCard(dynamic doc) {
    final isSelected = _selectedDoctorId == doc['id']?.toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected
              ? const Color(0xFF2563EB)
              : const Color(0xFFE2E8F0),
          width: isSelected ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.01),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () async {
          final doctorId = doc['id']?.toString();
          if (doctorId == null) return;
          setState(() {
            _selectedDoctorId = doctorId;
            _slotAvailable = false;
            _slotValidationMessage = null;
          });
          await _validateSlot();
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const CircleAvatar(
                radius: 24,
                backgroundColor: Color(0xFFDBEAFE),
                child: Icon(Icons.person_rounded, color: Color(0xFF2563EB)),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc['name']?.toString() ?? 'Doctor',
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    const SizedBox(height: 4),
                    Text(doc['specialization']?.toString() ?? 'General',
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              if (isSelected)
                const Icon(Icons.check_circle_rounded, color: Color(0xFF2563EB)),
            ],
          ),
        ),
      ),
    );
  }
}
