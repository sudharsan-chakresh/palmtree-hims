class Appointment {
  final String id;
  final String? patientId;
  final String? doctorId;
  final String? doctorName;
  final String patientName;
  final String time;
  final String type; // OPD, IPD, Emergency
  final String status;
  final String symptoms;

  Appointment({
    required this.id,
    this.patientId,
    this.doctorId,
    this.doctorName,
    required this.patientName,
    required this.time,
    required this.type,
    required this.status,
    required this.symptoms,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id']?.toString() ?? '',
      patientId:
          json['patient_id']?.toString() ?? json['patientId']?.toString(),
      doctorId: json['doctor_id']?.toString() ?? json['doctorId']?.toString(),
      doctorName: json['doctor_name']?.toString(),
      patientName: json['patient_name']?.toString() ??
          json['patient']?['name']?.toString() ??
          'Unknown Patient',
      time: _formatTime(json['appointment_time']?.toString()),
      type: json['type']?.toString() ?? 'OPD',
      status: json['status']?.toString() ?? 'Scheduled',
      symptoms: json['reason']?.toString() ??
          json['symptoms']?.toString() ??
          'No complaints listed',
    );
  }

  static String _formatTime(String? raw) {
    if (raw == null || raw.isEmpty) return 'N/A';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    final hour = parsed.hour % 12 == 0 ? 12 : parsed.hour % 12;
    final minute = parsed.minute.toString().padLeft(2, '0');
    final suffix = parsed.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }
}
