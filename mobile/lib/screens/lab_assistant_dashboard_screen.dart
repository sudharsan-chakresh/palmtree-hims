import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/breadcrumb.dart';
import '../widgets/gradient_app_bar.dart';
import '../widgets/shimmer_loading.dart';
import 'login_screen.dart';

class LabAssistantDashboardScreen extends ConsumerStatefulWidget {
  const LabAssistantDashboardScreen({super.key});

  @override
  ConsumerState<LabAssistantDashboardScreen> createState() => _LabAssistantDashboardScreenState();
}

class _LabAssistantDashboardScreenState extends ConsumerState<LabAssistantDashboardScreen> {
  List<dynamic> _labOrders = [];
  bool _isLoading = true;
  String? _error;
  String _filter = 'All'; // 'All', 'Pending', 'Completed', 'Published'
  dynamic _selectedOrder;
  bool _isActionLoading = false;
  String _userName = 'Lab Assistant';

  // Results Input Controllers
  final _testValueController = TextEditingController();
  final _techNotesController = TextEditingController();

  // Search Filter
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadLabOrders();
  }

  Future<void> _loadLabOrders() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      _userName = prefs.getString('user_name') ?? 'Lab Assistant';
      final api = ref.read(apiServiceProvider);
      final res = await api.getLabOrders();
      if (mounted) {
        setState(() {
          _labOrders = res.data is List ? res.data as List : [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        final prefs = await SharedPreferences.getInstance();
        _userName = prefs.getString('user_name') ?? 'Lab Assistant';
        setState(() {
          _labOrders = _getMockLabOrders();
          _error = 'Live lab orders stream offline. Offline snapshot active.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _updateOrderStatus(String status) async {
    if (_selectedOrder == null) return;
    setState(() => _isActionLoading = true);

    try {
      final api = ref.read(apiServiceProvider);
      final response = await api.updateLabOrderStatus(_selectedOrder['id'], status);
      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Order status updated to $status'),
              backgroundColor: const Color(0xFF6366F1),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        await _loadLabOrders();
        if (mounted) {
          setState(() {
            _selectedOrder = _labOrders.firstWhere((o) => o['id'] == _selectedOrder['id'], orElse: () => null);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Update status failed: $e'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isActionLoading = false);
      }
    }
  }

  Future<void> _submitResults() async {
    if (_selectedOrder == null) return;
    if (_testValueController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter test results values'), backgroundColor: Colors.orange, behavior: SnackBarBehavior.floating),
      );
      return;
    }

    setState(() => _isActionLoading = true);

    try {
      final api = ref.read(apiServiceProvider);
      final results = {
        'value': _testValueController.text,
        'units': _selectedOrder['test_name'].toString().toLowerCase().contains('glucose') ? 'mg/dL' : 'g/dL',
        'range': _selectedOrder['test_name'].toString().toLowerCase().contains('glucose') ? '70-100' : '12-16',
      };

      final response = await api.submitLabResults(
        _selectedOrder['id'],
        results,
        _techNotesController.text,
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Test results submitted! Report is completed.'), backgroundColor: Color(0xFF10B981), behavior: SnackBarBehavior.floating),
          );
        }
        _testValueController.clear();
        _techNotesController.clear();
        await _loadLabOrders();
        if (mounted) {
          setState(() {
            _selectedOrder = null;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submission failed: $e'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isActionLoading = false);
      }
    }
  }

  Future<void> _publishReport() async {
    if (_selectedOrder == null) return;
    setState(() => _isActionLoading = true);

    try {
      final api = ref.read(apiServiceProvider);
      final response = await api.publishLabResults(_selectedOrder['id']);
      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Report published and shared with Doctor/Patient.'), backgroundColor: Color(0xFF10B981), behavior: SnackBarBehavior.floating),
          );
        }
        await _loadLabOrders();
        if (mounted) {
          setState(() {
            _selectedOrder = null;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Publish failed: $e'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isActionLoading = false);
      }
    }
  }

  Future<void> _collectLabPayment(String paymentMode) async {
    if (_selectedOrder == null) return;
    setState(() => _isActionLoading = true);

    try {
      final api = ref.read(apiServiceProvider);
      final price = 500.0; // simulated standard lab price
      final billItems = [
        {
          'description': 'Lab Order: ${_selectedOrder['test_name']}',
          'quantity': 1.0,
          'unit_price': price,
          'tax_percent': 0.0,
          'amount': price,
          'discount_amount': 0.0
        }
      ];

      final invoiceData = {
        'patientId': _selectedOrder['patient_id'] ?? '00000000-0000-0000-0000-000000000000',
        'encounterId': _selectedOrder['encounter_id'],
        'billType': 'LAB',
        'items': billItems,
        'totalAmount': price,
        'paymentMode': paymentMode,
        'status': 'PAID'
      };

      final response = await api.finalizeInvoice(invoiceData);

      if (response.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Lab test bill of ₹$price collected successfully via ${paymentMode.toUpperCase()}!'),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        // Sync order pay status
        await _loadLabOrders();
        if (mounted) {
          setState(() {
            _selectedOrder = _labOrders.firstWhere((o) => o['id'] == _selectedOrder['id'], orElse: () => null);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: $e'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
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

  Widget _buildLabOrdersList(List<dynamic> filtered, bool isMobile) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Breadcrumb(paths: ['Diagnostic Desk', 'Lab Orders']),
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
                  const SizedBox(width: 6),
                  _buildFilterButton('Published'),
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
                const SizedBox(width: 6),
                _buildFilterButton('Published'),
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
                          final order = filtered[index];
                          final isSel = _selectedOrder != null && _selectedOrder['id'] == order['id'];
                          final isUrgent = order['priority']?.toString().toLowerCase() == 'high' || order['priority']?.toString().toLowerCase() == 'emergency';

                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: isSel ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0),
                                width: isSel ? 1.5 : 1.0,
                              ),
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () {
                                setState(() {
                                  _selectedOrder = order;
                                  _testValueController.text = order['results']?['value']?.toString() ?? '';
                                  _techNotesController.text = order['technician_notes']?.toString() ?? '';
                                });
                              },
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    Badge(
                                      isLabelVisible: isUrgent,
                                      backgroundColor: const Color(0xFFEF4444),
                                      child: CircleAvatar(
                                        backgroundColor: _getStatusColor(order['status']).withValues(alpha: 0.1),
                                        child: Icon(
                                          Icons.biotech_rounded,
                                          color: _getStatusColor(order['status']),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            order['patient_name'] ?? 'Walk-in Patient',
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B), fontSize: 14),
                                          ),
                                          const SizedBox(height: 4),
                                          Text('${order['test_name']} • Priority: ${order['priority'] ?? 'Normal'}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                                          const SizedBox(height: 2),
                                          Text('MRN: ${order['mrn'] ?? 'N/A'} • Ordered: ${order['created_at']?.toString().split('T')[0] ?? 'Today'}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: _getStatusColor(order['status']).withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            order['status'] ?? 'Pending',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: _getStatusColor(order['status']),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          order['is_paid'] == true || order['is_paid'] == 1 ? 'PAID' : 'UNPAID',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                            color: order['is_paid'] == true || order['is_paid'] == 1 ? const Color(0xFF059669) : const Color(0xFFEF4444),
                                          ),
                                        ),
                                      ],
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

  Widget _buildLabOrderDetailPanel({required bool isMobile}) {
    if (_selectedOrder == null) return const SizedBox.shrink();

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
                          onPressed: () => setState(() => _selectedOrder = null),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                        const SizedBox(width: 8),
                      ],
                      const Text('TEST SUMMARY & RESULTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2)),
                    ],
                  ),
                  if (!isMobile)
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => setState(() => _selectedOrder = null),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _selectedOrder['test_name'] ?? 'Diagnostic Test',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 6),
              Text('Patient: ${_selectedOrder['patient_name']}', style: const TextStyle(color: Color(0xFF1E293B), fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 2),
              Text('MRN: ${_selectedOrder['mrn'] ?? 'N/A'} • Doc: ${_selectedOrder['doctor_name'] ?? 'Staff'}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
        // Results Entry Panel
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Show Bill Checkout if unpaid
                if (!(_selectedOrder['is_paid'] == true || _selectedOrder['is_paid'] == 1)) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.warning_amber_rounded, color: Color(0xFFB91C1C), size: 20),
                            SizedBox(width: 8),
                            Text('Unpaid Lab Order', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF991B1B))),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Text('Collect billing amount (₹500) before releasing or performing the test.', style: TextStyle(fontSize: 12, color: Color(0xFF7F1D1D), fontWeight: FontWeight.w500)),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: () => _showPaymentCollectionDialog(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEF4444),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Collect Payment', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ],

                const Text('TEST MEASUREMENTS / VALUE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B))),
                const SizedBox(height: 8),
                TextField(
                  controller: _testValueController,
                  enabled: _selectedOrder['status'] == 'Pending' || _selectedOrder['status'] == 'Processing',
                  decoration: InputDecoration(
                    hintText: 'e.g. 13.5 (Normal Range: 12-16)',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                ),
                const SizedBox(height: 20),
                const Text('LAB TECHNICIAN NOTES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B))),
                const SizedBox(height: 8),
                TextField(
                  controller: _techNotesController,
                  maxLines: 3,
                  enabled: _selectedOrder['status'] == 'Pending' || _selectedOrder['status'] == 'Processing',
                  decoration: InputDecoration(
                    hintText: 'Add findings, range notes or remarks...',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Progress Flow helpers
                if (_selectedOrder['status'] == 'Pending') ...[
                  ElevatedButton(
                    onPressed: _isActionLoading ? null : () => _updateOrderStatus('Processing'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('START PROCESSING TEST', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ] else if (_selectedOrder['status'] == 'Processing') ...[
                  ElevatedButton(
                    onPressed: _isActionLoading ? null : _submitResults,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('SUBMIT TEST RESULTS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ] else if (_selectedOrder['status'] == 'Completed') ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFA7F3D0))),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF059669)),
                            const SizedBox(width: 8),
                            Text('Results: ${_selectedOrder['results']?['value'] ?? 'Entered'}', style: const TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _isActionLoading ? null : _publishReport,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4F46E5),
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('PUBLISH FINAL REPORT', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                      ],
                    ),
                  ),
                ] else if (_selectedOrder['status'] == 'Published') ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFBFDBFE))),
                    child: const Column(
                      children: [
                        Icon(Icons.check_circle_outline_rounded, color: Color(0xFF2563EB), size: 32),
                        SizedBox(height: 8),
                        Text('Report Published & Complete', style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('Shared to Patient timeline.', style: TextStyle(fontSize: 12, color: Color(0xFF3B82F6))),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _labOrders.where((o) {
      final statusMatch = _filter == 'All' || o['status'] == _filter;
      final searchMatch = _searchQuery.isEmpty ||
          (o['patient_name']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false) ||
          (o['mrn']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
      return statusMatch && searchMatch;
    }).toList();

    final bool isMobile = MediaQuery.of(context).size.width < 850;

    return Scaffold(
      backgroundColor: AppColors.surfaceVariant,
      appBar: GradientAppBar(
        userName: _userName,
        role: 'lab_assistant',
        onLogout: () => _logout(context),
      ),
      body: isMobile
          ? (_selectedOrder == null
              ? _buildLabOrdersList(filtered, isMobile)
              : _buildLabOrderDetailPanel(isMobile: true))
          : Row(
              children: [
                // Main Panel: Lab Orders list
                Expanded(
                  flex: 3,
                  child: _buildLabOrdersList(filtered, isMobile),
                ),
                // Side Panel: Results entry, status actions & billing
                Expanded(
                  flex: 2,
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(left: BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    child: _selectedOrder == null
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.biotech_outlined, size: 48, color: Color(0xFF94A3B8)),
                                SizedBox(height: 12),
                                Text('Select an order to input results', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                              ],
                            ),
                          )
                        : _buildLabOrderDetailPanel(isMobile: false),
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
      selectedColor: const Color(0xFF4F46E5),
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

  Color _getStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'published':
        return const Color(0xFF2563EB);
      case 'completed':
        return const Color(0xFF10B981);
      case 'processing':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFFEF4444);
    }
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.biotech_outlined, size: 64, color: Color(0xFFCBD5E1)),
          const SizedBox(height: 16),
          Text('No lab orders found for \"$_filter\"', style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  void _showPaymentCollectionDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Collect Lab Test Bill', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Test: ${_selectedOrder['test_name']}'),
              const SizedBox(height: 8),
              const Text('Price: ₹500.00', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF4F46E5))),
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
        _collectLabPayment(mode.toLowerCase() == 'card' ? 'creditcard' : mode.toLowerCase());
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
            Icon(icon, color: const Color(0xFF4F46E5)),
            const SizedBox(height: 6),
            Text(mode, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  List<dynamic> _getMockLabOrders() {
    return [
      {
        'id': 'lab-demo-1',
        'patient_name': 'Selvakumar Balakrishnan',
        'mrn': 'MRN-2405-001243',
        'patient_id': '71820db3-f8f1-4294-8c11-1dc66ab1056e',
        'doctor_name': 'Dr. Sankaran R',
        'test_name': 'Complete Blood Count (CBC)',
        'priority': 'High',
        'status': 'Pending',
        'is_paid': false,
        'encounter_id': 'enc-demo-1',
      },
      {
        'id': 'lab-demo-2',
        'patient_name': 'Arun Kumar',
        'mrn': 'MRN-2405-001882',
        'patient_id': '00000000-0000-0000-0000-000000000000',
        'doctor_name': 'Dr. Clara Nightingale',
        'test_name': 'Fasting Blood Glucose',
        'priority': 'Normal',
        'status': 'Completed',
        'is_paid': true,
        'results': {'value': '95', 'units': 'mg/dL'},
        'technician_notes': 'Glucose level is normal',
        'encounter_id': 'enc-demo-2',
      }
    ];
  }
}
