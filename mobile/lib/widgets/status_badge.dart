import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Semantic status badge with consistent colors across the app.
class StatusBadge extends StatelessWidget {
  final String label;
  final StatusType? type;
  final Color? customColor;
  final Color? customBackground;
  final bool pulse;

  const StatusBadge({
    super.key,
    required this.label,
    this.type,
    this.customColor,
    this.customBackground,
    this.pulse = false,
  });

  /// Factory for auto-detecting status from string
  factory StatusBadge.fromStatus(String status) {
    final normalized = status.toLowerCase().trim();
    StatusType type;
    bool shouldPulse = false;

    if (normalized.contains('active') || normalized.contains('check')) {
      type = StatusType.active;
    } else if (normalized.contains('queue') || normalized.contains('pending') || normalized.contains('waiting')) {
      type = StatusType.pending;
    } else if (normalized.contains('completed') || normalized.contains('done') || normalized.contains('published')) {
      type = StatusType.completed;
    } else if (normalized.contains('urgent') || normalized.contains('critical') || normalized.contains('emergency')) {
      type = StatusType.urgent;
      shouldPulse = true;
    } else if (normalized.contains('cancelled') || normalized.contains('rejected')) {
      type = StatusType.cancelled;
    } else {
      type = StatusType.info;
    }

    return StatusBadge(
      label: status,
      type: type,
      pulse: shouldPulse,
    );
  }

  Color get _bgColor {
    if (customBackground != null) return customBackground!;
    switch (type ?? StatusType.info) {
      case StatusType.active:    return AppColors.secondarySurface;
      case StatusType.pending:   return AppColors.primarySurface;
      case StatusType.completed: return const Color(0xFFF1F5F9);
      case StatusType.urgent:    return AppColors.errorSurface;
      case StatusType.cancelled: return const Color(0xFFF1F5F9);
      case StatusType.info:      return AppColors.primarySurface;
    }
  }

  Color get _textColor {
    if (customColor != null) return customColor!;
    switch (type ?? StatusType.info) {
      case StatusType.active:    return AppColors.secondaryDark;
      case StatusType.pending:   return AppColors.primaryDark;
      case StatusType.completed: return AppColors.textTertiary;
      case StatusType.urgent:    return AppColors.errorDark;
      case StatusType.cancelled: return AppColors.textMuted;
      case StatusType.info:      return AppColors.primaryDark;
    }
  }

  @override
  Widget build(BuildContext context) {
    final badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: _textColor,
          letterSpacing: 0.3,
        ),
      ),
    );

    if (!pulse) return badge;

    return _PulsingBadge(child: badge);
  }
}

enum StatusType {
  active,
  pending,
  completed,
  urgent,
  cancelled,
  info,
}

class _PulsingBadge extends StatefulWidget {
  final Widget child;
  const _PulsingBadge({required this.child});

  @override
  State<_PulsingBadge> createState() => _PulsingBadgeState();
}

class _PulsingBadgeState extends State<_PulsingBadge>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: 0.6 + (_controller.value * 0.4),
          child: widget.child,
        );
      },
    );
  }
}
