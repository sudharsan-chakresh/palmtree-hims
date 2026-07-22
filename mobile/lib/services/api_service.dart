import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:flutter/foundation.dart';
class ApiService {
  final Dio _dio = Dio();

  // Base URL: set via --dart-define=API_BASE_URL=... at build time, or falls back to local dev
  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL');
  static String get _baseUrl {
    if (_envBaseUrl.isNotEmpty) return _envBaseUrl;
    if (kReleaseMode) {
      return "https://jioplix-backend.vercel.app/api";
    }
    if (kIsWeb) {
      return "http://localhost:4000/api";
    }
    if (defaultTargetPlatform == TargetPlatform.windows || 
        defaultTargetPlatform == TargetPlatform.linux || 
        defaultTargetPlatform == TargetPlatform.macOS) {
      return "http://localhost:4000/api";
    }
    return "http://10.0.2.2:4000/api";
  }

  final String baseUrl = _baseUrl;

  ApiService() {
    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 30);
    _dio.options.receiveTimeout = const Duration(seconds: 30);

    // Global Interceptor for Headers (Multi-tenancy & Auth)
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token');
        final tenantId = prefs.getString('tenant_id');

        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        if (tenantId != null) {
          options.headers['x-tenant-id'] = tenantId;
        }

        return handler.next(options);
      },
    ));
  }

  // Auth Methods
  Future<Response> login(String email, String password, String facility,
      {String type = "tenant"}) async {
    return _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
      'facility': facility,
      'type': type,
    });
  }

  // Patient Methods
  Future<Response> getPatients() async {
    return _dio.get('/patients');
  }

  Future<Response> getPatientDetails(String patientId) async {
    return _dio.get('/patients/$patientId');
  }

  Future<Response> getPatientTimeline(String patientId) async {
    return _dio.get('/patients/$patientId/timeline');
  }

  Future<Response> getAppointments({String? doctorId}) async {
    return _dio.get(
      '/appointments',
      queryParameters:
          doctorId == null || doctorId.isEmpty ? null : {'doctorId': doctorId},
    );
  }

  Future<Response> getDashboardStats() async {
    return _dio.get('/hospital/metrics/stats');
  }

  Future<Response> createAppointment(
      Map<String, dynamic> appointmentData) async {
    return _dio.post('/appointments', data: appointmentData);
  }

  // ABHA / ABDM Methods
  Future<Response> generateAbhaOtp(String aadhaar) async {
    return _dio.post('/abha/generate-otp', data: {'aadhaar': aadhaar});
  }

  Future<Response> verifyAbhaOtp(String otp, String txnId) async {
    return _dio.post('/abha/verify-otp', data: {'otp': otp, 'txnId': txnId});
  }

  Future<Response> searchAbhaByMobile(String mobile) async {
    return _dio.post('/abha/search-mobile', data: {'mobile': mobile});
  }

  // Clinical Master Data
  Future<Response> getDoctors() async {
    return _dio.get('/hospital/doctors');
  }

  Future<Response> validateAppointmentSlot(
      String doctorId, String appointmentTime) async {
    return _dio.get('/appointments/validate', queryParameters: {
      'doctorId': doctorId,
      'appointmentTime': appointmentTime,
    });
  }

  Future<Response> searchPatients(String query) async {
    return _dio.get('/patients', queryParameters: {'search': query});
  }

  // Encounter / Registration
  Future<Response> registerPatient(Map<String, dynamic> patientData) async {
    return _dio.post('/patients', data: patientData);
  }

  Future<Response> createEncounter(Map<String, dynamic> encounterData) async {
    return _dio.post('/consultations', data: encounterData);
  }

  Future<Response> createActiveEncounter(
      Map<String, dynamic> encounterData) async {
    return _dio.post('/hospital/encounters', data: encounterData);
  }

  Future<Response> updateEncounter(
      String encounterId, Map<String, dynamic> encounterData) async {
    return _dio.put('/hospital/encounters/$encounterId', data: encounterData);
  }

  Future<Response> createPrescription(
      String encounterId, List<Map<String, dynamic>> items) async {
    return _dio.post('/hospital/encounters/$encounterId/prescriptions',
        data: {'items': items});
  }

  Future<Response> createLabOrders(
      String encounterId, List<String> diagnosticIds,
      {String priority = 'Normal'}) async {
    return _dio.post('/hospital/encounters/$encounterId/lab-orders',
        data: {'diagnosticIds': diagnosticIds, 'priority': priority});
  }

  Future<Response> createAdmission(Map<String, dynamic> admissionData) async {
    return _dio.post('/hospital/ipd/admissions', data: admissionData);
  }

  Future<Response> getBedMap() async {
    return _dio.get('/hospital/ipd/bedmap');
  }

  Future<Response> getWardBeds(String wardId) async {
    return _dio.get('/hospital/ipd/wards/$wardId/beds');
  }

  // Public: register a lightweight patient complaint when no auth token is present
  Future<Response> postPatientComplaint(
      String patientId, Map<String, dynamic> complaintData) async {
    return _dio.post('/public/patients/$patientId/complaints',
        data: complaintData);
  }

  Future<Response> updateAppointmentStatus(
      String appointmentId, String status) {
    return _dio.patch('/appointments/$appointmentId', data: {'status': status});
  }

  // Nexus Methods
  Future<Response> getPublicTenants() async {
    return _dio.get('/nexus/tenants/public');
  }

  // === Pharmacist Endpoints ===
  Future<Response> getPrescriptions() async {
    return _dio.get('/hospital/pharmacy/prescriptions');
  }

  Future<Response> getPrescriptionItems(String prescriptionId) async {
    return _dio.get('/hospital/pharmacy/prescriptions/$prescriptionId/items');
  }

  Future<Response> dispensePrescription(Map<String, dynamic> data) async {
    return _dio.post('/hospital/pharmacy/dispense', data: data);
  }

  Future<Response> getPharmacyInventory() async {
    return _dio.get('/hospital/pharmacy/inventory');
  }

  // === Lab Assistant Endpoints ===
  Future<Response> getLabOrders() async {
    return _dio.get('/hospital/lab/orders');
  }

  Future<Response> updateLabOrderStatus(String orderId, String status) async {
    return _dio
        .put('/hospital/lab/orders/$orderId/status', data: {'status': status});
  }

  Future<Response> submitLabResults(String orderId,
      Map<String, dynamic> results, String technicianNote) async {
    return _dio.post('/hospital/lab/orders/$orderId/results', data: {
      'results': results,
      'technicianNote': technicianNote,
    });
  }

  Future<Response> publishLabResults(String orderId) async {
    return _dio.post('/hospital/lab/orders/$orderId/publish');
  }

  // === Admin & Billing Endpoints ===
  Future<Response> getBillingQueue(String patientId) async {
    return _dio.get('/billing/queue/$patientId');
  }

  Future<Response> finalizeInvoice(Map<String, dynamic> invoiceData) async {
    return _dio.post('/billing', data: invoiceData);
  }

  Future<Response> getBillingHistory() async {
    return _dio.get('/billing/history');
  }

  // === IPD Admissions Endpoints ===
  Future<Response> getIpdAdmissions() async {
    return _dio.get('/hospital/ipd/admissions');
  }

  Future<Response> getIpdAdmissionDetails(String admissionId) async {
    return _dio.get('/hospital/ipd/admissions/$admissionId');
  }

  Future<Response> postIpdServiceCharges(
      String admissionId, Map<String, dynamic> data) async {
    return _dio.post('/hospital/ipd/admissions/$admissionId/service-charges',
        data: data);
  }

  Future<Response> dischargeIpdPatient(
      String admissionId, Map<String, dynamic> data) async {
    return _dio.post('/hospital/ipd/admissions/$admissionId/discharge',
        data: data);
  }

  // === Employee Leave Endpoints ===
  Future<Response> getMyLeaves(String token) async {
    return _dio.get('/hospital/leaves/mine');
  }

  Future<Response> getTeamLeaveRequests(String token) async {
    return _dio.get('/hospital/leaves/team');
  }

  Future<Response> applyLeave({
    required String token,
    required String leaveType,
    required String fromDate,
    required String toDate,
    String reason = '',
  }) async {
    return _dio.post('/hospital/leaves', data: {
      'leave_type': leaveType,
      'from_date': fromDate,
      'to_date': toDate,
      'reason': reason,
    });
  }

  Future<Response> updateLeaveStatus({
    required String token,
    required int leaveId,
    required String status,
  }) async {
    return _dio.put('/hospital/leaves/$leaveId', data: {'status': status});
  }
}

final apiServiceProvider = Provider((ref) => ApiService());
