import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../widgets/breadcrumb.dart';

class VoiceNoteScreen extends StatefulWidget {
  final String? patientName;
  final String? patientId;
  final String? doctorId;
  final String? appointmentId;
  final String? encounterId;

  const VoiceNoteScreen({
    super.key,
    this.patientName,
    this.patientId,
    this.doctorId,
    this.appointmentId,
    this.encounterId,
  });

  @override
  State<VoiceNoteScreen> createState() => _VoiceNoteScreenState();
}

class _VoiceNoteScreenState extends State<VoiceNoteScreen> {
  final SpeechToText _speech = SpeechToText();
  final TextEditingController _transcriptController = TextEditingController();
  bool _isAvailable = false;
  bool _isListening = false;
  bool _isInitializing = true;
  bool _isPosting = false;
  String? _statusMessage;
  String _generatedNote = '';
  String? _currentEncounterId;

  @override
  void initState() {
    super.initState();
    _initializeSpeech();
    _currentEncounterId = widget.encounterId;
  }

  @override
  void dispose() {
    _speech.stop();
    _transcriptController.dispose();
    super.dispose();
  }

  Future<void> _initializeSpeech() async {
    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          if (!mounted) return;
          setState(() {
            _isListening = status == 'listening';
            _statusMessage = _friendlyStatus(status);
          });
        },
        onError: (error) {
          if (!mounted) return;
          setState(() {
            _isListening = false;
            _statusMessage = error.errorMsg.isEmpty
                ? 'Speech recognition stopped'
                : error.errorMsg;
          });
        },
      );

      if (!mounted) return;
      setState(() {
        _isAvailable = available;
        _isInitializing = false;
        _statusMessage = available
            ? 'Ready to capture clinical dictation'
            : 'Speech recognition is not available on this device';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isAvailable = false;
        _isInitializing = false;
        _statusMessage = 'Unable to initialize microphone: $e';
      });
    }
  }

  Future<void> _toggleListening() async {
    if (_isInitializing) return;

    if (!_isAvailable) {
      await _initializeSpeech();
      return;
    }

    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }

    await _speech.listen(
      listenOptions: SpeechListenOptions(
        listenMode: ListenMode.dictation,
        partialResults: true,
        listenFor: const Duration(minutes: 3),
        pauseFor: const Duration(seconds: 8),
      ),
      onResult: _onSpeechResult,
    );

    if (mounted) {
      setState(() {
        _isListening = true;
        _statusMessage = 'Listening...';
      });
    }
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    setState(() {
      _transcriptController.text = result.recognizedWords;
      _transcriptController.selection = TextSelection.collapsed(
        offset: _transcriptController.text.length,
      );
    });
  }

  void _generateClinicalNote() {
    final transcript = _transcriptController.text.trim();
    if (transcript.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Capture or type a voice transcript first')),
      );
      return;
    }

    final now = DateTime.now();
    final patient = widget.patientName ?? 'Patient';
    setState(() {
      _generatedNote = '''
Clinical Voice Note
Patient: $patient
Recorded: ${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}

Subjective:
$transcript

Assessment:
Clinical dictation reviewed. Please confirm diagnosis and severity before final sign-off.

Plan:
- Continue/adjust medicines as clinically appropriate.
- Order investigations if symptoms persist or worsen.
- Document follow-up advice and red-flag instructions.
''';
    });
  }

  Future<void> _copyNote() async {
    final text = _generatedNote.trim().isNotEmpty
        ? _generatedNote
        : _transcriptController.text.trim();
    if (text.isEmpty) return;

    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Voice note copied')),
    );
  }

  Future<void> _postToConsultation() async {
    final transcript = _transcriptController.text.trim();
    if (transcript.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Capture or type a transcript first')),
      );
      return;
    }

    final patientId = widget.patientId;
    final doctorId = widget.doctorId;
    if (patientId == null || patientId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Patient ID missing for this note')),
      );
      return;
    }

    if (_generatedNote.isEmpty) {
      _generateClinicalNote();
    }

    setState(() => _isPosting = true);
    try {
      if (_isListening) await _speech.stop();
      final api = ApiService();
      final note = _generatedNote.trim().isEmpty ? transcript : _generatedNote;

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');

      if (token == null || token.isEmpty) {
        // Public patient submission (no auth) -> use public complaints endpoint
        await api.postPatientComplaint(patientId, {
          'complaint': transcript,
          'notes': note,
        });
      } else {
        // Authenticated flow (doctor / user)
        if (_currentEncounterId != null) {
          await api.updateEncounter(_currentEncounterId!, {
            'status': 'Completed',
            'notes': note,
            'diagnosis': 'Clinical review completed',
          });
        } else {
          final response = await api.createEncounter({
            'patientId': patientId,
            'doctorId': doctorId,
            'diagnosis': '',
            'notes': note,
            'vitals': null,
            'complaints': [transcript],
            'prescriptions': const <Map<String, dynamic>>[],
          });
          _currentEncounterId = response.data['encounterId']?.toString();
        }
      }

      if (widget.appointmentId != null && widget.appointmentId!.isNotEmpty) {
        await api.updateAppointmentStatus(widget.appointmentId!, 'Completed');
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Consultation posted successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to post consultation: $e')),
      );
    } finally {
      if (mounted) setState(() => _isPosting = false);
    }
  }

  Future<void> _showPrescribeDialog() async {
    final medController = TextEditingController();
    final doseController = TextEditingController();
    final qtyController = TextEditingController();

    final res = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Prescribe Medicine'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: medController, decoration: const InputDecoration(labelText: 'Medicine name')),
            TextField(controller: doseController, decoration: const InputDecoration(labelText: 'Dosage')),
            TextField(controller: qtyController, decoration: const InputDecoration(labelText: 'Duration')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Send')),
        ],
      ),
    );

    if (res != true) return;
    final api = ApiService();
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    if (token == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Doctor must be authenticated to prescribe')));
      return;
    }
    final encounterId = _currentEncounterId;
    if (encounterId == null || encounterId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Create an encounter first by posting this consultation')));
      return;
    }
    try {
      final items = [
        { 'name': medController.text.trim(), 'dosage': doseController.text.trim(), 'duration': qtyController.text.trim(), 'frequency': '' }
      ];
      await api.createPrescription(encounterId, items);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Prescription created')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to create prescription: $e')));
    }
  }

  Future<void> _showOrderLabDialog() async {
    final testController = TextEditingController();
    final res = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Order Lab Test'),
        content: TextField(controller: testController, decoration: const InputDecoration(labelText: 'Test name (e.g. CBC)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Order')),
        ],
      ),
    );
    if (res != true) return;
    final api = ApiService();
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    if (token == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Doctor must be authenticated to order labs')));
      return;
    }
    final encounterId = _currentEncounterId;
    if (encounterId == null || encounterId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Create an encounter first by posting this consultation')));
      return;
    }
    try {
      await api.createLabOrders(encounterId, [testController.text.trim()]);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lab order created')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to create lab order: $e')));
    }
  }

  Future<void> _showAdmitDialog() async {
    if (widget.doctorId == null || widget.doctorId!.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Doctor context is required to admit a patient')));
      return;
    }
    if (widget.patientId == null || widget.patientId!.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Patient ID missing for admission')));
      return;
    }

    final api = ApiService();
    List<dynamic> wards = [];
    try {
      final bedMapRes = await api.getBedMap();
      if (bedMapRes.statusCode == 200) {
        wards = List<dynamic>.from(bedMapRes.data ?? []);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Unable to load ward map: $e')));
      return;
    }

    String? selectedWardId;
    String? selectedBedId;
    final reasonController = TextEditingController();
    String? dialogError;
    List<dynamic> wardBeds = [];

    if (!mounted) return;
    final res = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setState) {
          return AlertDialog(
            title: const Text('Create Admission'),
            content: SizedBox(
              width: 340,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (wards.isEmpty) ...[
                    const SizedBox(height: 12),
                    const Text('No wards found. Admission will auto-assign a bed if available.'),
                  ] else ...[
                    DropdownButtonFormField<String>(
                      initialValue: selectedWardId,
                      hint: const Text('Select ward (optional)'),
                      items: wards.map((ward) {
                        final name = ward['name'] ?? ward['label'] ?? 'Ward';
                        return DropdownMenuItem<String>(
                          value: ward['id']?.toString(),
                          child: Text(name.toString()),
                        );
                      }).toList(),
                      onChanged: (value) async {
                        setState(() {
                          selectedWardId = value;
                          selectedBedId = null;
                          wardBeds = [];
                          dialogError = null;
                        });
                        if (value != null) {
                          try {
                            final bedsRes = await api.getWardBeds(value);
                            if (bedsRes.statusCode == 200) {
                              setState(() {
                                wardBeds = List<dynamic>.from(bedsRes.data ?? []);
                              });
                            }
                          } catch (e) {
                            setState(() {
                              dialogError = 'Unable to load beds for this ward';
                            });
                          }
                        }
                      },
                    ),
                    if (wardBeds.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: selectedBedId,
                        hint: const Text('Select bed (optional)'),
                        items: wardBeds.map((bed) {
                          final label = bed['bed_number'] ?? bed['number'] ?? 'Bed';
                          final status = bed['status'] ?? 'Unknown';
                          return DropdownMenuItem<String>(
                            value: bed['id']?.toString(),
                            child: Text('$label (${status.toString().toLowerCase()})'),
                          );
                        }).toList(),
                        onChanged: (value) {
                          setState(() {
                            selectedBedId = value;
                          });
                        },
                      ),
                    ],
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonController,
                    decoration: const InputDecoration(labelText: 'Admission reason'),
                    minLines: 1,
                    maxLines: 3,
                  ),
                  if (dialogError != null) ...[
                    const SizedBox(height: 12),
                    Text(dialogError!, style: const TextStyle(color: Colors.red)),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
              ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Admit')),
            ],
          );
        },
      ),
    );

    if (res != true) return;

    try {
      final data = {
        'patientId': widget.patientId,
        'wardId': selectedWardId,
        'bedId': selectedBedId,
        'admittingDoctorId': widget.doctorId,
        'admissionReason': reasonController.text.trim(),
        'dailyCharge': 1500,
      };
      await api.createAdmission(data);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Admission created')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to create admission: $e')));
    }
  }

  void _clear() {
    setState(() {
      _transcriptController.clear();
      _generatedNote = '';
      _statusMessage =
          _isAvailable ? 'Ready to capture clinical dictation' : _statusMessage;
    });
  }

  String _friendlyStatus(String status) {
    switch (status) {
      case 'listening':
        return 'Listening...';
      case 'notListening':
        return 'Paused';
      case 'done':
        return 'Capture complete';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final patientName = widget.patientName;

    return Scaffold(
      backgroundColor: const Color(0xFFf8fafc),
      appBar: AppBar(
        title: const Text('Voice Clinical Note'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1e293b),
        actions: [
          IconButton(
            onPressed: _copyNote,
            icon: const Icon(Icons.copy, color: Color(0xFF2563EB)),
            tooltip: 'Copy note',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Breadcrumb(paths: [
              'Dashboard',
              'Clinical',
              patientName ?? 'Voice Notes',
            ]),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: _isListening ? 96 : 80,
                    height: _isListening ? 96 : 80,
                    decoration: BoxDecoration(
                      color: (_isListening ? const Color(0xFFEF4444) : const Color(0xFF2563EB))
                          .withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: (_isListening ? const Color(0xFFEF4444) : const Color(0xFF2563EB))
                            .withValues(alpha: _isListening ? 0.3 : 0.15),
                        width: _isListening ? 4 : 2,
                      ),
                    ),
                    child: Icon(
                      _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                      size: 36,
                      color: _isListening ? const Color(0xFFEF4444) : const Color(0xFF2563EB),
                    ),
                  ),
                  const SizedBox(height: 20),
                  AudioWaveformWidget(isListening: _isListening),
                  const SizedBox(height: 20),
                  Text(
                    _statusMessage ?? 'Preparing microphone...',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _isInitializing ? null : _toggleListening,
                    icon: Icon(_isListening ? Icons.stop_rounded : Icons.mic_rounded),
                    label: Text(_isListening ? 'STOP CAPTURE' : 'START CAPTURE'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isListening ? const Color(0xFFEF4444) : const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 54),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'LIVE TRANSCRIPT',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 13,
                color: Color(0xFF64748b),
                letterSpacing: 1.1,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _transcriptController,
              minLines: 6,
              maxLines: 10,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                hintText: 'Dictated text will appear here. You can edit it before generating the note.',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _clear,
                    icon: const Icon(Icons.delete_outline_rounded),
                    label: const Text('CLEAR'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _generateClinicalNote,
                    icon: const Icon(Icons.auto_awesome_rounded),
                    label: const Text('GENERATE'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E293B),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _isPosting ? null : _postToConsultation,
              icon: _isPosting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.upload_file_rounded),
              label: Text(_isPosting ? 'POSTING...' : 'POST TO CONSULTATION'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
            if (_currentEncounterId != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF7DD3FC)),
                ),
                child: Text(
                  'Encounter created: $_currentEncounterId',
                  style: const TextStyle(
                    color: Color(0xFF0369A1),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                ElevatedButton.icon(
                  onPressed: _showPrescribeDialog,
                  icon: const Icon(Icons.medical_services_outlined),
                  label: const Text('Prescribe'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: _showOrderLabDialog,
                  icon: const Icon(Icons.biotech_outlined),
                  label: const Text('Order Lab'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: _showAdmitDialog,
                  icon: const Icon(Icons.hotel_rounded),
                  label: const Text('Admit'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],
            ),
            if (widget.patientId == null || widget.doctorId == null) ...[
              const SizedBox(height: 8),
              const Text(
                'Posting is enabled when voice note is opened from a live patient queue item.',
                style: TextStyle(
                  color: Color(0xFF64748b),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
            if (_generatedNote.isNotEmpty) ...[
              const SizedBox(height: 24),
              const Text(
                'GENERATED NOTE',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  color: Color(0xFF64748b),
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFe2e8f0)),
                ),
                child: Text(
                  _generatedNote,
                  style: const TextStyle(
                    color: Color(0xFF334155),
                    height: 1.45,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AudioWaveformWidget extends StatefulWidget {
  final bool isListening;
  const AudioWaveformWidget({super.key, required this.isListening});

  @override
  State<AudioWaveformWidget> createState() => _AudioWaveformWidgetState();
}

class _AudioWaveformWidgetState extends State<AudioWaveformWidget> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<double> _baseHeights = [10, 18, 28, 14, 22, 36, 26, 12, 20, 30, 16, 8];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isListening) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(
          _baseHeights.length,
          (index) => Container(
            margin: const EdgeInsets.symmetric(horizontal: 2.0),
            width: 3.0,
            height: 6,
            decoration: BoxDecoration(
              color: const Color(0xFF94A3B8),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
      );
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            _baseHeights.length,
            (index) {
              final multiplier = 0.3 + (0.7 * (1.0 - (index % 3) * 0.25));
              final currentHeight = _baseHeights[index] * (_controller.value * multiplier + 0.3);
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 2.0),
                width: 3.0,
                height: currentHeight.clamp(4.0, 36.0),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEF4444), Color(0xFFF59E0B)],
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
