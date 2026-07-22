import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../widgets/breadcrumb.dart';
import 'login_screen.dart';

class AdminBillingDashboardScreen extends ConsumerStatefulWidget {
  const AdminBillingDashboardScreen({super.key});

  @override
  ConsumerState<AdminBillingDashboardScreen> createState() => _AdminBillingDashboardScreenState();
}

class _AdminBillingDashboardScreenState extends ConsumerState<AdminBillingDashboardScreen> {
  // Patients list
  List<dynamic> _patients = [];
  List<dynamic> _ipdAdmissions = [];
  bool _isLoadingPatients = true;
  String? _patientsError;

  // Selected Patient & Billing Queue
  dynamic _selectedPatient;
  List<dynamic> _billingQueue = [];
  bool _isLoadingQueue = false;

  // Selected items in consolidation invoice
  final Set<String> _selectedQueueIds = {};

  // Discount values mapped by queue item ID
  final Map<String, double> _itemDiscounts = {}; // Map of queue item id -> discount amount

  // Selected Payment Mode
  String _paymentMode = 'cash'; // 'cash', 'creditcard', 'upi'
  bool _isCheckingOut = false;

  // Search Filter
  final _patientSearchController = TextEditingController();
  String _patientSearchQuery = '';
  int _activeTab = 0; // 0: OPD Patients, 1: IPD Admitted Patients

  @override
  void initState() {
    super.initState();
    _loadPatientsAndAdmissions();
  }

  Future<void> _loadPatientsAndAdmissions() async {
    setState(() {
      _isLoadingPatients = true;
      _patientsError = null;
    });

    try {
      final api = ref.read(apiServiceProvider);
      
      // 1. Fetch Patients
      final patientsRes = await api.getPatients();
      if (patientsRes.statusCode == 200) {
        _patients = patientsRes.data is List ? patientsRes.data as List : [];
      }

      // 2. Fetch IPD Admissions
      final ipdRes = await api.getIpdAdmissions();
      if (ipdRes.statusCode == 200) {
        _ipdAdmissions = ipdRes.data is Map && ipdRes.data['data'] is List 
            ? ipdRes.data['data'] as List 
            : (ipdRes.data is List ? ipdRes.data as List : []);
      }

      setState(() => _isLoadingPatients = false);
    } catch (e) {
      setState(() {
        _patients = _getMockPatients();
        _ipdAdmissions = _getMockIpdAdmissions();
        _patientsError = 'Live patient directory offline. Offline backup active.';
        _isLoadingPatients = false;
      });
    }
  }

  Future<void> _loadBillingQueue(dynamic patient) async {
    setState(() {
      _selectedPatient = patient;
      _billingQueue = [];
      _selectedQueueIds.clear();
      _itemDiscounts.clear();
      _isLoadingQueue = true;
    });

    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getBillingQueue(patient['id'] ?? patient['patient_id']);
      if (mounted) {
        setState(() {
          _billingQueue = res.data is List ? res.data as List : [];
          // Pre-select all pending items
          for (final item in _billingQueue) {
            _selectedQueueIds.add(item['id']);
          }
          _isLoadingQueue = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _billingQueue = _getMockBillingQueue(patient['id'] ?? patient['patient_id']);
          // Pre-select all pending items
          for (final item in _billingQueue) {
            _selectedQueueIds.add(item['id']);
          }
          _isLoadingQueue = false;
        });
      }
    }
  }

  // Check discount eligibility: Doctor fee in IPD and Bed charges only
  bool _isItemEligibleForDiscount(dynamic item) {
    final module = item['source_module']?.toString().toUpperCase() ?? '';
    final desc = item['description']?.toString().toLowerCase() ?? '';
    
    // 1. Bed / Room charges: from module IPD_ROOM or contains 'room' or 'bed' in description
    final isBedCharge = module == 'IPD_ROOM' || desc.contains('room') || desc.contains('bed') || desc.contains('ward');
    
    // 2. Doctor fee in IPD: source module is IPD or IPD_SERVICE, and description contains doctor/consultation/visit
    final isDoctorIpdFee = (module == 'IPD_SERVICE' || module == 'IPD') && 
        (desc.contains('doctor') || desc.contains('visit') || desc.contains('consultation') || desc.contains('fee') || desc.contains('rounds'));

    return isBedCharge || isDoctorIpdFee;
  }

  Future<void> _processCheckout() async {
    if (_selectedPatient == null || _selectedQueueIds.isEmpty) return;
    setState(() => _isCheckingOut = true);

    try {
      final api = ref.read(apiServiceProvider);

      final checkoutItems = _billingQueue
          .where((item) => _selectedQueueIds.contains(item['id']))
          .map((item) {
            final disc = _itemDiscounts[item['id']] ?? 0.0;
            final price = double.tryParse(item['unit_price']?.toString() ?? '0') ?? 0.0;
            final qty = double.tryParse(item['quantity']?.toString() ?? '1') ?? 1.0;
            final amt = (price * qty) - disc;
            return {
              'id': item['id'],
              'description': item['description'],
              'quantity': qty,
              'unit_price': price,
              'tax_percent': double.tryParse(item['tax_percent']?.toString() ?? '0') ?? 0.0,
              'amount': amt,
              'discount_amount': disc
            };
          }).toList();

      double total = 0;
      for (final it in checkoutItems) {
        total += it['amount'] as double;
      }

      final pId = _selectedPatient['id'] ?? _selectedPatient['patient_id'];

      final invoiceData = {
        'patientId': pId,
        'encounterId': null, // Consolidated billing is parent level
        'billType': _activeTab == 1 ? 'IPD' : 'OPD',
        'items': checkoutItems,
        'totalAmount': total,
        'paymentMode': _paymentMode,
        'status': 'PAID'
      };

      final response = await api.finalizeInvoice(invoiceData);

      if (response.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Consolidated Invoice of ₹$total collected successfully via ${_paymentMode.toUpperCase()}!')),
                ],
              ),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
        // Refresh
        await _loadPatientsAndAdmissions();
        if (mounted) {
          setState(() {
            _selectedPatient = null;
            _billingQueue = [];
            _selectedQueueIds.clear();
            _itemDiscounts.clear();
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Checkout failed: $e'),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } finally {
      setState(() => _isCheckingOut = false);
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

  Widget _buildPatientDirectory(List<dynamic> patientList) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PATIENTS DIRECTORY',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 11,
              color: Color(0xFF64748B),
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          // Search Patient
          TextField(
            controller: _patientSearchController,
            onChanged: (val) => setState(() => _patientSearchQuery = val),
            decoration: InputDecoration(
              hintText: 'Search patient, MRN...',
              prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          // OPD / IPD Tab selection
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() {
                      _activeTab = 0;
                      _selectedPatient = null;
                      _billingQueue = [];
                    }),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _activeTab == 0 ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: _activeTab == 0
                            ? [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                )
                              ]
                            : null,
                      ),
                      child: Text(
                        'OPD Clients',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: _activeTab == 0 ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() {
                      _activeTab = 1;
                      _selectedPatient = null;
                      _billingQueue = [];
                    }),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _activeTab == 1 ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: _activeTab == 1
                            ? [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                )
                              ]
                            : null,
                      ),
                      child: Text(
                        'IPD Admitted',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: _activeTab == 1 ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_patientsError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                _patientsError!,
                style: const TextStyle(color: Color(0xFFD97706), fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          // Patient List
          Expanded(
            child: _isLoadingPatients
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                : patientList.isEmpty
                    ? const Center(child: Text('No matching patients found', style: TextStyle(color: Color(0xFF64748B))))
                    : ListView.builder(
                        padding: EdgeInsets.only(bottom: 40 + MediaQuery.of(context).padding.bottom),
                        itemCount: patientList.length,
                        itemBuilder: (context, index) {
                          final p = patientList[index];
                          final pName = p['name'] ?? p['patient_name'] ?? 'Walk-in Customer';
                          final pMrn = p['mrn'] ?? 'GENERAL';
                          final isSel = _selectedPatient != null && (_selectedPatient['id'] == p['id'] || _selectedPatient['patient_id'] == p['patient_id']);

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: isSel ? const Color(0xFFEFF6FF) : Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSel ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                                width: isSel ? 2 : 1,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: ListTile(
                                onTap: () => _loadBillingQueue(p),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                title: Text(pName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Text('MRN: $pMrn', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                                    const SizedBox(height: 2),
                                    Text(
                                      _activeTab == 1 ? (p['ward_name'] ?? 'General Ward') : (p['phone'] ?? ''),
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                                trailing: Icon(
                                  Icons.arrow_forward_ios,
                                  size: 14,
                                  color: isSel ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileDetailView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Back button
          TextButton.icon(
            onPressed: () => setState(() {
              _selectedPatient = null;
              _billingQueue = [];
              _selectedQueueIds.clear();
              _itemDiscounts.clear();
            }),
            icon: const Icon(Icons.arrow_back, color: Color(0xFF2563EB)),
            label: const Text('Back to Patients Directory', style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold)),
            style: TextButton.styleFrom(
              alignment: Alignment.centerLeft,
              padding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: 12),
          // Patient Meta info
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFFEFF6FF),
                  radius: 22,
                  child: Icon(
                    _activeTab == 1 ? Icons.hotel : Icons.person,
                    color: const Color(0xFF2563EB),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedPatient['name'] ?? _selectedPatient['patient_name'] ?? 'Walk-in Patient',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 2),
                      Text('MRN: ${_selectedPatient['mrn'] ?? 'GENERAL'}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Billing Queue Header
          const Text('PENDING BILLING ITEMS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 1.2)),
          const SizedBox(height: 10),
          if (_isLoadingQueue)
            const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: Color(0xFF2563EB))))
          else if (_billingQueue.isEmpty)
            Padding(padding: const EdgeInsets.symmetric(vertical: 20), child: _buildEmptyQueue())
          else ...[
            // List of items
            ..._billingQueue.map((item) {
              final isSel = _selectedQueueIds.contains(item['id']);
              final isEligible = _isItemEligibleForDiscount(item);
              final price = double.tryParse(item['unit_price']?.toString() ?? '0') ?? 0.0;
              final qty = double.tryParse(item['quantity']?.toString() ?? '1') ?? 1.0;

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Checkbox(
                            value: isSel,
                            onChanged: (val) {
                              setState(() {
                                if (val == true) {
                                  _selectedQueueIds.add(item['id']);
                                } else {
                                  _selectedQueueIds.remove(item['id']);
                                }
                              });
                            },
                            activeColor: const Color(0xFF10B981),
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item['description'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                                  child: Text('Module: ${item['source_module']} • Qty: $qty', style: const TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ),
                          Text('₹${price * qty}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (isEligible) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFFDE68A))),
                              child: const Row(
                                children: [
                                  Icon(Icons.local_offer, size: 12, color: Color(0xFFD97706)),
                                  SizedBox(width: 4),
                                  Text('Discount Eligible', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                                ],
                              ),
                            ),
                            Row(
                              children: [
                                const Text('Discount: ', style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                                _buildDiscountInputField(item, price * qty),
                              ],
                            ),
                          ] else ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                              child: const Text('Non-Discountable', style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                            ),
                            Text('₹0.00 discount', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                          ]
                        ],
                      )
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 20),
            _buildConsolidatedCheckoutPanel(),
            SizedBox(height: 60 + MediaQuery.of(context).padding.bottom),
          ]
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Filter patients based on tab & search query
    final search = _patientSearchQuery.toLowerCase();
    final patientList = _activeTab == 0
        ? _patients.where((p) {
            return search.isEmpty ||
                (p['name']?.toString().toLowerCase().contains(search) ?? false) ||
                (p['phone']?.toString().toLowerCase().contains(search) ?? false);
          }).toList()
        : _ipdAdmissions.where((p) {
            final name = p['patient_name'] ?? p['name'] ?? '';
            final mrn = p['mrn'] ?? '';
            return search.isEmpty ||
                (name.toString().toLowerCase().contains(search)) ||
                (mrn.toString().toLowerCase().contains(search));
          }).toList();

    final bool isMobile = MediaQuery.of(context).size.width < 850;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        scrolledUnderElevation: 0,
        backgroundColor: Colors.white,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFA7F3D0), width: 0.8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.payments_outlined, color: Color(0xFF059669), size: 14),
                  SizedBox(width: 6),
                  Text(
                    'BILLING DESK',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF059669),
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: IconButton(
              onPressed: () => _logout(context),
              icon: const Icon(Icons.logout_rounded, size: 18, color: Color(0xFFEF4444)),
              tooltip: 'Logout',
            ),
          ),
        ],
      ),
      body: isMobile
          ? (_selectedPatient == null ? _buildPatientDirectory(patientList) : _buildMobileDetailView())
          : Row(
              children: [
                // Left Column: Patient Selection & Search
                Expanded(
                  flex: 2,
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(right: BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    child: _buildPatientDirectory(patientList),
                  ),
                ),
                // Middle Column: Consolidated Queue & Items panel
                Expanded(
                  flex: 3,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    child: _selectedPatient == null
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long, size: 48, color: Color(0xFFCBD5E1)),
                                SizedBox(height: 12),
                                Text('Select a patient to pull billing queue', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                              ],
                            ),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Breadcrumb(paths: ['Billing Consolidation', 'Active Queue']),
                              const SizedBox(height: 12),
                              // Patient Meta info
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor: const Color(0xFFEFF6FF),
                                      radius: 20,
                                      child: Icon(
                                        _activeTab == 1 ? Icons.hotel : Icons.person,
                                        color: const Color(0xFF2563EB),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _selectedPatient['name'] ?? _selectedPatient['patient_name'] ?? 'Walk-in Patient',
                                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text('MRN: ${_selectedPatient['mrn'] ?? 'GENERAL'}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 20),
                              // Billing Queue list
                              Expanded(
                                child: _isLoadingQueue
                                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                                    : _billingQueue.isEmpty
                                        ? _buildEmptyQueue()
                                        : ListView.builder(
                                            itemCount: _billingQueue.length,
                                            itemBuilder: (context, index) {
                                              final item = _billingQueue[index];
                                              final isSel = _selectedQueueIds.contains(item['id']);
                                              final isEligible = _isItemEligibleForDiscount(item);
                                              final price = double.tryParse(item['unit_price']?.toString() ?? '0') ?? 0.0;
                                              final qty = double.tryParse(item['quantity']?.toString() ?? '1') ?? 1.0;

                                              return Container(
                                                margin: const EdgeInsets.only(bottom: 10),
                                                decoration: BoxDecoration(
                                                  color: Colors.white,
                                                  borderRadius: BorderRadius.circular(16),
                                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                                ),
                                                child: Padding(
                                                  padding: const EdgeInsets.all(16),
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Row(
                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                        children: [
                                                          Checkbox(
                                                            value: isSel,
                                                            onChanged: (val) {
                                                              setState(() {
                                                                if (val == true) {
                                                                  _selectedQueueIds.add(item['id']);
                                                                } else {
                                                                  _selectedQueueIds.remove(item['id']);
                                                                }
                                                              });
                                                            },
                                                            activeColor: const Color(0xFF10B981),
                                                          ),
                                                          const SizedBox(width: 4),
                                                          Expanded(
                                                            child: Column(
                                                              crossAxisAlignment: CrossAxisAlignment.start,
                                                              children: [
                                                                Text(item['description'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
                                                                const SizedBox(height: 4),
                                                                Container(
                                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                                                                  child: Text('Module: ${item['source_module']} • Qty: $qty', style: const TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.bold)),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                          Text('₹${price * qty}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
                                                        ],
                                                      ),
                                                      const SizedBox(height: 12),
                                                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                                      const SizedBox(height: 12),
                                                      Row(
                                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                        children: [
                                                          if (isEligible) ...[
                                                            Container(
                                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFFDE68A))),
                                                              child: const Row(
                                                                children: [
                                                                  Icon(Icons.local_offer, size: 12, color: Color(0xFFD97706)),
                                                                  SizedBox(width: 4),
                                                                  Text('Discount Eligible', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                                                                ],
                                                              ),
                                                            ),
                                                            Row(
                                                              children: [
                                                                const Text('Discount: ', style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                                                                _buildDiscountInputField(item, price * qty),
                                                              ],
                                                            ),
                                                          ] else ...[
                                                            Container(
                                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                              decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                                                              child: const Text('Non-Discountable', style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                                                            ),
                                                            Text('₹0.00 discount', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                                                          ]
                                                        ],
                                                      )
                                                    ],
                                                  ),
                                                ),
                                              );
                                            },
                                          ),
                              ),
                            ],
                          ),
                  ),
                ),
                // Right Column: Consolidation checkout breakdown
                Expanded(
                  flex: 2,
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(left: BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    padding: const EdgeInsets.all(20),
                    child: _selectedPatient == null
                        ? const Center(
                            child: Text('Consolidated breakdown will display here', style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontStyle: FontStyle.italic)),
                          )
                        : _billingQueue.isEmpty
                            ? const Center(child: Text('Queue empty', style: TextStyle(color: Color(0xFF64748B))))
                            : _buildConsolidatedCheckoutPanel(),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildDiscountInputField(dynamic item, double maxVal) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _quickDiscChip(item, '10%', maxVal * 0.1),
        const SizedBox(width: 4),
        _quickDiscChip(item, '20%', maxVal * 0.2),
        const SizedBox(width: 6),
        SizedBox(
          width: 64,
          height: 32,
          child: TextField(
            keyboardType: TextInputType.number,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            onChanged: (val) {
              final disc = double.tryParse(val) ?? 0.0;
              setState(() {
                if (disc > maxVal) {
                  _itemDiscounts[item['id']] = maxVal;
                } else {
                  _itemDiscounts[item['id']] = disc;
                }
              });
            },
            decoration: InputDecoration(
              prefixText: '₹',
              contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _quickDiscChip(dynamic item, String label, double amt) {
    final isSelected = (_itemDiscounts[item['id']] ?? 0.0) == amt;
    return InkWell(
      onTap: () {
        setState(() {
          _itemDiscounts[item['id']] = amt;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFD97706) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  Widget _buildConsolidatedCheckoutPanel() {
    double subtotal = 0;
    double taxTotal = 0;
    double discountTotal = 0;

    for (final item in _billingQueue) {
      if (_selectedQueueIds.contains(item['id'])) {
        final price = double.tryParse(item['unit_price']?.toString() ?? '0') ?? 0.0;
        final qty = double.tryParse(item['quantity']?.toString() ?? '1') ?? 1.0;
        final tax = double.tryParse(item['tax_percent']?.toString() ?? '0') ?? 0.0;
        
        final amt = price * qty;
        subtotal += amt;
        taxTotal += amt * (tax / 100);
        discountTotal += _itemDiscounts[item['id']] ?? 0.0;
      }
    }

    final total = subtotal + taxTotal - discountTotal;
    final bool isMobile = MediaQuery.of(context).size.width < 850;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'BILLING CONSOLIDATION SUMMARY',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2),
        ),
        const SizedBox(height: 16),
        _summaryRow('Selected Items Count', '${_selectedQueueIds.length}'),
        const Divider(height: 20, color: Color(0xFFE2E8F0)),
        _summaryRow('Queue Subtotal', '₹$subtotal'),
        _summaryRow('Applicable Taxes', '₹$taxTotal'),
        _summaryRow('Discounts Applied', '-₹$discountTotal', color: const Color(0xFFD97706), isBold: true),
        const Divider(height: 24, color: Color(0xFFE2E8F0)),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFA7F3D0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('NET PAYABLE', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF065F46))),
              Text('₹$total', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF059669))),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text('COLLECTION METHOD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2)),
        const SizedBox(height: 12),
        Row(
          children: [
            _paymentModeSelector('cash', Icons.money_rounded, 'Cash'),
            const SizedBox(width: 8),
            _paymentModeSelector('creditcard', Icons.credit_card_rounded, 'Card'),
            const SizedBox(width: 8),
            _paymentModeSelector('upi', Icons.qr_code_scanner_rounded, 'UPI'),
          ],
        ),
        if (isMobile) const SizedBox(height: 24) else const Spacer(),
        ElevatedButton(
          onPressed: (_selectedQueueIds.isEmpty || _isCheckingOut) ? null : _processCheckout,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF059669),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 1,
          ),
          child: _isCheckingOut
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('CHECKOUT & COLLECT', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, letterSpacing: 0.5)),
        ),
      ],
    );
  }

  Widget _paymentModeSelector(String mode, IconData icon, String label) {
    final isSelected = _paymentMode == mode;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _paymentMode = mode),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
            border: Border.all(
              color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
              width: isSelected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B), size: 22),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {Color? color, bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w700,
              color: color ?? const Color(0xFF1E293B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyQueue() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                color: Color(0xFFECFDF5),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_outline, size: 36, color: Color(0xFF059669)),
            ),
            const SizedBox(height: 12),
            const Text(
              'All clear! No pending payments.',
              style: TextStyle(color: Color(0xFF1E293B), fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  List<dynamic> _getMockPatients() {
    return [
      {'id': '71820db3-f8f1-4294-8c11-1dc66ab1056e', 'name': 'Selvakumar Balakrishnan', 'mrn': 'MRN-2405-001243', 'phone': '9876543210'},
      {'id': 'mock-opd-2', 'name': 'Rahul Sharma', 'mrn': 'MRN-2405-001556', 'phone': '9876500112'},
    ];
  }

  List<dynamic> _getMockIpdAdmissions() {
    return [
      {
        'id': 'adm-mock-1',
        'patient_id': '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        'patient_name': 'Selvakumar Balakrishnan',
        'mrn': 'MRN-2405-001243',
        'ward_name': 'Private Suite',
        'bed_number': 'PS-03',
        'daily_charge': 7500.0,
      },
      {
        'id': 'adm-mock-2',
        'patient_id': 'mock-ipd-2',
        'patient_name': 'Aanya Patel',
        'mrn': 'MRN-2405-001991',
        'ward_name': 'Semi-Private Ward',
        'bed_number': 'SP-08',
        'daily_charge': 3500.0,
      }
    ];
  }

  List<dynamic> _getMockBillingQueue(String patientId) {
    return [
      {
        'id': 'q-1',
        'patient_id': patientId,
        'source_module': 'OPD',
        'description': 'Consultation Fee (Dr. Sankaran R)',
        'quantity': 1.0,
        'unit_price': 500.0,
        'tax_percent': 0.0,
        'status': 'PENDING'
      },
      {
        'id': 'q-2',
        'patient_id': patientId,
        'source_module': 'IPD_ROOM',
        'description': 'Bed / Room Charges (3 Days in Private Suite)',
        'quantity': 1.0,
        'unit_price': 22500.0,
        'tax_percent': 5.0,
        'status': 'PENDING'
      },
      {
        'id': 'q-3',
        'patient_id': patientId,
        'source_module': 'IPD_SERVICE',
        'description': 'IPD Doctor rounds / visit charges',
        'quantity': 3.0,
        'unit_price': 1500.0,
        'tax_percent': 0.0,
        'status': 'PENDING'
      },
      {
        'id': 'q-4',
        'patient_id': patientId,
        'source_module': 'PHARMACY',
        'description': 'Medicine: Amoxicillin 500mg',
        'quantity': 10.0,
        'unit_price': 18.0,
        'tax_percent': 0.0,
        'status': 'PENDING'
      },
      {
        'id': 'q-5',
        'patient_id': patientId,
        'source_module': 'LAB',
        'description': 'Lab: Complete Blood Count (CBC)',
        'quantity': 1.0,
        'unit_price': 500.0,
        'tax_percent': 0.0,
        'status': 'PENDING'
      }
    ];
  }
}
