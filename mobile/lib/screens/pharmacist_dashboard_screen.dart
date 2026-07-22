import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/gradient_app_bar.dart';
import '../widgets/shimmer_loading.dart';
import 'login_screen.dart';

class PharmacistDashboardScreen extends ConsumerStatefulWidget {
  const PharmacistDashboardScreen({super.key});

  @override
  ConsumerState<PharmacistDashboardScreen> createState() => _PharmacistDashboardScreenState();
}

class _PharmacistDashboardScreenState extends ConsumerState<PharmacistDashboardScreen> {
  List<dynamic> _prescriptions = [];
  bool _isLoading = true;
  String? _error;
  String _filter = 'All'; // 'All', 'Pending', 'Completed'
  dynamic _selectedPrescription;
  List<dynamic> _selectedPrescriptionItems = [];
  bool _isLoadingItems = false;
  bool _isActionLoading = false;
  String _userName = 'Pharmacist';

  // Search filter
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadPrescriptions();
  }

  Future<void> _loadPrescriptions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      _userName = prefs.getString('user_name') ?? 'Pharmacist';
      final api = ref.read(apiServiceProvider);
      final res = await api.getPrescriptions();
      if (mounted) {
        setState(() {
          _prescriptions = res.data is List ? res.data as List : [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        final prefs = await SharedPreferences.getInstance();
        _userName = prefs.getString('user_name') ?? 'Pharmacist';
        setState(() {
          _prescriptions = _getMockPrescriptions();
          _error = 'Live prescriptions unavailable. Offline mode active.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadPrescriptionItems(dynamic prescription) async {
    setState(() {
      _selectedPrescription = prescription;
      _selectedPrescriptionItems = [];
      _isLoadingItems = true;
    });

    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getPrescriptionItems(prescription['id']);
      if (mounted) {
        setState(() {
          _selectedPrescriptionItems = res.data is List ? res.data as List : [];
          _isLoadingItems = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _selectedPrescriptionItems = _getMockPrescriptionItems(prescription['id']);
          _isLoadingItems = false;
        });
      }
    }
  }

  Future<void> _dispenseMedicines() async {
    if (_selectedPrescription == null) return;
    setState(() => _isActionLoading = true);

    try {
      final api = ref.read(apiServiceProvider);
      final itemsToDispense = _selectedPrescriptionItems.map((item) {
        return {
          'drugId': item['medicine_id'] ?? '00000000-0000-0000-0000-000000000000',
          'drugName': item['medicine_name'] ?? item['drug_name'] ?? 'Unknown Medicine',
          'quantity': 10, // Default batch quantity
          'unitPrice': double.tryParse(item['unit_price']?.toString() ?? '12.0') ?? 12.0
        };
      }).toList();

      final response = await api.dispensePrescription({
        'prescriptionId': _selectedPrescription['id'],
        'encounterId': _selectedPrescription['encounter_id'],
        'items': itemsToDispense
      });

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Medicines dispensed successfully! Billed to patient queue.'),
              backgroundColor: Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        _loadPrescriptions();
        if (mounted) {
          setState(() {
            _selectedPrescription = null;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Dispense failed: ${e.toString()}'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isActionLoading = false);
      }
    }
  }

  Future<void> _collectPharmacyPayment(String paymentMode) async {
    if (_selectedPrescription == null) return;
    setState(() => _isActionLoading = true);

    try {
      final api = ref.read(apiServiceProvider);
      
      // Calculate total for pharmacy items
      double total = 0;
      final billItems = _selectedPrescriptionItems.map((item) {
        final price = double.tryParse(item['unit_price']?.toString() ?? '12.0') ?? 12.0;
        final qty = 10.0; // simulated quantity
        final itemAmt = price * qty;
        total += itemAmt;
        return {
          'description': 'Medicine: ${item['medicine_name'] ?? item['drug_name']}',
          'quantity': qty,
          'unit_price': price,
          'tax_percent': 0.0,
          'amount': itemAmt,
          'discount_amount': 0.0
        };
      }).toList();

      final invoiceData = {
        'patientId': _selectedPrescription['patient_id'] ?? '00000000-0000-0000-0000-000000000000',
        'encounterId': _selectedPrescription['encounter_id'],
        'billType': 'PHARMACY',
        'items': billItems,
        'totalAmount': total,
        'paymentMode': paymentMode,
        'status': 'PAID'
      };

      final response = await api.finalizeInvoice(invoiceData);

      if (response.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Pharmacy bill of ₹$total collected successfully via ${paymentMode.toUpperCase()}!'),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        // Also dispense
        await api.dispensePrescription({
          'prescriptionId': _selectedPrescription['id'],
          'encounterId': _selectedPrescription['encounter_id'],
          'items': _selectedPrescriptionItems.map((item) {
            return {
              'drugId': item['medicine_id'] ?? '00000000-0000-0000-0000-000000000000',
              'drugName': item['medicine_name'] ?? item['drug_name'] ?? 'Unknown Medicine',
              'quantity': 10,
              'unitPrice': double.tryParse(item['unit_price']?.toString() ?? '12.0') ?? 12.0
            };
          }).toList()
        });

        _loadPrescriptions();
        if (mounted) {
          setState(() {
            _selectedPrescription = null;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment failure: ${e.toString()}'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isActionLoading = false);
      }
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

  Widget _buildPrescriptionList(List<dynamic> filtered, bool isMobile) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Breadcrumb(paths: ['Pharmacy Desk', 'Prescriptions']),
          const SizedBox(height: 12),
          // Search & Filter header
          if (isMobile) ...[
            TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: 'Search patient, MRN...',
                prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B)),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterButton('All'),
                  const SizedBox(width: 6),
                  _buildFilterButton('Pending'),
                  const SizedBox(width: 6),
                  _buildFilterButton('Completed'),
                ],
              ),
            ),
          ] else ...[
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search patient, MRN...',
                      prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B)),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                _buildFilterButton('All'),
                const SizedBox(width: 6),
                _buildFilterButton('Pending'),
                const SizedBox(width: 6),
                _buildFilterButton('Completed'),
              ],
            ),
          ],
          const SizedBox(height: 16),
          if (_error != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFCD34D)),
              ),
              child: Text(_error!, style: const TextStyle(color: Color(0xFF92400E), fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          Expanded(
            child: _isLoading
                ? const SingleChildScrollView(
                    child: ShimmerCardSkeleton(count: 3),
                  )
                : filtered.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final p = filtered[index];
                          final isSel = _selectedPrescription != null && _selectedPrescription['id'] == p['id'];
                          final isCompleted = p['status'] == 'Completed';
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: isSel ? const Color(0xFFECFDF5) : Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSel ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                                width: isSel ? 1.5 : 1.0,
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
                              borderRadius: BorderRadius.circular(16),
                              onTap: () => _loadPrescriptionItems(p),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor: isCompleted ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                                      child: Icon(
                                        Icons.assignment_rounded,
                                        color: isCompleted ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            p['patient_name'] ?? 'Walk-in Customer',
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B), fontSize: 14),
                                          ),
                                          const SizedBox(height: 4),
                                          Text('MRN: ${p['mrn'] ?? 'N/A'} • Rx ID: ${p['id'].toString().substring(0, 8)}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                                          const SizedBox(height: 2),
                                          Text('Prescribed by ${p['doctor_name'] ?? 'Physician'}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: isCompleted ? const Color(0xFFD1FAE5) : const Color(0xFFFFE4E6),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        p['status'] ?? 'Pending',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isCompleted ? const Color(0xFF065F46) : const Color(0xFF9F1239),
                                        ),
                                      ),
                                    ),
                                  ],
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

  Widget _buildPrescriptionDetailPanel({required bool isMobile}) {
    if (_selectedPrescription == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Details Header
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      if (isMobile) ...[
                        IconButton(
                          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF64748B)),
                          onPressed: () => setState(() => _selectedPrescription = null),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                        const SizedBox(width: 8),
                      ],
                      const Text('PRESCRIPTION DETAILS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2)),
                    ],
                  ),
                  if (!isMobile)
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => setState(() => _selectedPrescription = null),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _selectedPrescription['patient_name'] ?? 'Walk-in Customer',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 2),
              Text('MRN: ${_selectedPrescription['mrn'] ?? 'N/A'}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
        // Items List
        Expanded(
          child: _isLoadingItems
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _selectedPrescriptionItems.length,
                  itemBuilder: (context, index) {
                    final item = _selectedPrescriptionItems[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  item['medicine_name'] ?? item['drug_name'] ?? 'Unknown Drug',
                                  style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B), fontSize: 14),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '₹${item['unit_price'] ?? 12.0}',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669), fontSize: 14),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _buildBadge(Icons.timer_outlined, item['dosage'] ?? '1-0-1'),
                              _buildBadge(Icons.calendar_month_outlined, item['duration'] ?? '5 Days'),
                              _buildBadge(Icons.speed_rounded, item['frequency'] ?? 'Twice daily'),
                            ],
                          ),
                          if (item['instructions'] != null && item['instructions'].toString().isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              'Instructions: ${item['instructions']}',
                              style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                            ),
                          ]
                        ],
                      ),
                    );
                  },
                ),
        ),
        // Actions Panel
        if (_selectedPrescription['status'] != 'Completed')
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ElevatedButton.icon(
                  onPressed: _isActionLoading ? null : _dispenseMedicines,
                  icon: _isActionLoading
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.local_pharmacy_rounded, color: Colors.white, size: 18),
                  label: const Text('DISPENSE DRUGS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _isActionLoading ? null : () => _showPaymentCollectionDialog(context),
                  icon: const Icon(Icons.receipt_long_rounded, color: Color(0xFF059669), size: 18),
                  label: const Text('COLLECT BILL & DISPENSE', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669))),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: const BorderSide(color: Color(0xFF10B981)),
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(20),
            color: const Color(0xFFF0FDF4),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_rounded, color: Color(0xFF059669)),
                SizedBox(width: 8),
                Text('Dispensed & Billed', style: TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.bold)),
              ],
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    // Filter list based on status and search query
    final filtered = _prescriptions.where((p) {
      final statusMatch = _filter == 'All' || p['status'] == _filter;
      final searchMatch = _searchQuery.isEmpty ||
          (p['patient_name']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false) ||
          (p['mrn']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
      return statusMatch && searchMatch;
    }).toList();

    final bool isMobile = MediaQuery.of(context).size.width < 850;

    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      appBar: GradientAppBar(
        userName: _userName,
        role: 'pharmacist',
        onLogout: () => _logout(context),
      ),
      body: isMobile
          ? (_selectedPrescription == null
              ? _buildPrescriptionList(filtered, isMobile)
              : _buildPrescriptionDetailPanel(isMobile: true))
          : Row(
              children: [
                // Main Panel: Prescription List
                Expanded(
                  flex: 3,
                  child: _buildPrescriptionList(filtered, isMobile),
                ),
                // Side Panel: Prescription Items & Action panel
                Expanded(
                  flex: 2,
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(left: BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    child: _selectedPrescription == null
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.description_outlined, size: 48, color: Color(0xFF94A3B8)),
                                SizedBox(height: 12),
                                Text('Select a prescription to view details', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                              ],
                            ),
                          )
                        : _buildPrescriptionDetailPanel(isMobile: false),
                  ),
                )
              ],
            ),
    );
  }

  Widget _buildFilterButton(String name) {
    final isSelected = _filter == name;
    return ChoiceChip(
      label: Text(name),
      selected: isSelected,
      onSelected: (val) {
        if (val) {
          setState(() {
            _filter = name;
          });
        }
      },
      selectedColor: const Color(0xFF10B981),
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : const Color(0xFF475569),
        fontWeight: FontWeight.bold,
      ),
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0)),
      ),
    );
  }

  Widget _buildBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: const Color(0xFF64748B)),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.assignment_outlined, size: 64, color: Color(0xFFCBD5E1)),
          const SizedBox(height: 16),
          Text('No prescriptions found for \"$_filter\"', style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  void _showPaymentCollectionDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        double subtotal = 0;
        for (final item in _selectedPrescriptionItems) {
          final price = double.tryParse(item['unit_price']?.toString() ?? '12.0') ?? 12.0;
          subtotal += price * 10;
        }
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Collect Pharmacy Bill', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Patient: ${_selectedPrescription['patient_name']}'),
              const SizedBox(height: 8),
              Text('Subtotal: ₹$subtotal', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF059669))),
              const SizedBox(height: 16),
              const Text('Select Payment Mode:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _paymentModeOption(context, 'Cash', Icons.money),
                  _paymentModeOption(context, 'Card', Icons.credit_card),
                  _paymentModeOption(context, 'UPI', Icons.qr_code_scanner),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _paymentModeOption(BuildContext dialogContext, String mode, IconData icon) {
    return InkWell(
      onTap: () {
        Navigator.pop(dialogContext);
        _collectPharmacyPayment(mode.toLowerCase() == 'card' ? 'creditcard' : mode.toLowerCase());
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFE2E8F0)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: const Color(0xFF10B981)),
            const SizedBox(height: 6),
            Text(mode, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  List<dynamic> _getMockPrescriptions() {
    return [
      {
        'id': 'rx-demo-1',
        'patient_name': 'Selvakumar Balakrishnan',
        'mrn': 'MRN-2405-001243',
        'patient_id': '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        'doctor_name': 'Dr. Sankaran R',
        'status': 'Pending',
        'encounter_id': 'enc-demo-1',
      },
      {
        'id': 'rx-demo-2',
        'patient_name': 'Meera Krishnan',
        'mrn': 'MRN-2405-001990',
        'patient_id': '00000000-0000-0000-0000-000000000000',
        'doctor_name': 'Dr. Clara Nightingale',
        'status': 'Completed',
        'encounter_id': 'enc-demo-2',
      }
    ];
  }

  List<dynamic> _getMockPrescriptionItems(String rxId) {
    if (rxId == 'rx-demo-1') {
      return [
        {
          'medicine_id': 'med-1',
          'medicine_name': 'Paracetamol 650mg',
          'dosage': '1-0-1',
          'duration': '5 Days',
          'frequency': 'After food',
          'unit_price': 8.50,
          'instructions': 'Drink plenty of water'
        },
        {
          'medicine_id': 'med-2',
          'medicine_name': 'Amoxicillin 500mg',
          'dosage': '1-1-1',
          'duration': '7 Days',
          'frequency': 'Every 8 hours',
          'unit_price': 18.00,
          'instructions': 'Complete the course'
        }
      ];
    }
    return [
      {
        'medicine_id': 'med-3',
        'medicine_name': 'Cetirizine 10mg',
        'dosage': '0-0-1',
        'duration': '10 Days',
        'frequency': 'At night',
        'unit_price': 5.00,
        'instructions': 'May cause drowsiness'
      }
    ];
  }
}
