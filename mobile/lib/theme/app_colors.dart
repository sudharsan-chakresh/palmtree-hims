import 'package:flutter/material.dart';

/// Jioplix Design System — Color Palette
/// All colors are semantically named for healthcare UI contexts.
class AppColors {
  AppColors._();

  // ── Brand / Primary ──────────────────────────────────────────────────────
  static const Color primary       = Color(0xFF2563EB); // Clinical Blue
  static const Color primaryLight  = Color(0xFF60A5FA);
  static const Color primaryDark   = Color(0xFF1E40AF);
  static const Color primarySurface = Color(0xFFEFF6FF);

  // ── Secondary / Medical Teal ─────────────────────────────────────────────
  static const Color secondary       = Color(0xFF10B981);
  static const Color secondaryLight  = Color(0xFF34D399);
  static const Color secondaryDark   = Color(0xFF059669);
  static const Color secondarySurface = Color(0xFFECFDF5);

  // ── Accent / Vitals Amber ────────────────────────────────────────────────
  static const Color amber       = Color(0xFFF59E0B);
  static const Color amberLight  = Color(0xFFFBBF24);
  static const Color amberDark   = Color(0xFFD97706);
  static const Color amberSurface = Color(0xFFFFF7ED);

  // ── Alert / Coral Red ────────────────────────────────────────────────────
  static const Color error       = Color(0xFFEF4444);
  static const Color errorLight  = Color(0xFFFCA5A5);
  static const Color errorDark   = Color(0xFFDC2626);
  static const Color errorSurface = Color(0xFFFEF2F2);

  // ── Indigo / Lab ─────────────────────────────────────────────────────────
  static const Color indigo       = Color(0xFF6366F1);
  static const Color indigoLight  = Color(0xFF818CF8);
  static const Color indigoSurface = Color(0xFFEEF2FF);

  // ── Purple / Voice / Telehealth ──────────────────────────────────────────
  static const Color purple       = Color(0xFF8B5CF6);
  static const Color purpleSurface = Color(0xFFF5F3FF);

  // ── Pink / Receptionist ──────────────────────────────────────────────────
  static const Color pink       = Color(0xFFEC4899);
  static const Color pinkSurface = Color(0xFFFDF2F8);

  // ── Cyan / Nursing ───────────────────────────────────────────────────────
  static const Color cyan       = Color(0xFF0891B2);
  static const Color cyanLight  = Color(0xFF22D3EE);
  static const Color cyanSurface = Color(0xFFECFEFF);

  // ── Neutrals (Slate Scale) ───────────────────────────────────────────────
  static const Color textPrimary   = Color(0xFF0F172A); // slate-900
  static const Color textSecondary = Color(0xFF1E293B); // slate-800
  static const Color textTertiary  = Color(0xFF475569); // slate-600
  static const Color textMuted     = Color(0xFF64748B); // slate-500
  static const Color textHint      = Color(0xFF94A3B8); // slate-400

  // ── Borders & Dividers ───────────────────────────────────────────────────
  static const Color border      = Color(0xFFE2E8F0); // slate-200
  static const Color borderLight = Color(0xFFF1F5F9); // slate-100
  static const Color divider     = Color(0xFFCBD5E1); // slate-300

  // ── Surfaces ─────────────────────────────────────────────────────────────
  static const Color surface        = Colors.white;
  static const Color surfaceVariant = Color(0xFFF8FAFC); // slate-50
  static const Color background     = Color(0xFFF1F5F9); // slate-100

  // ── Gradient Presets ─────────────────────────────────────────────────────
  static const LinearGradient heroGradient = LinearGradient(
    colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient tealGradient = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF10B981)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient warmGradient = LinearGradient(
    colors: [Color(0xFFF59E0B), Color(0xFFFBBF24)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ── Role-Aware Colors ────────────────────────────────────────────────────
  static Color roleColor(String role) {
    switch (role.toLowerCase()) {
      case 'doctor':       return primary;
      case 'admin':        return const Color(0xFF7C3AED);
      case 'nurse':        return amber;
      case 'pharmacist':   return secondary;
      case 'receptionist': return pink;
      case 'lab_assistant':
      case 'lab':          return indigo;
      case 'patient':      return primary;
      default:             return textTertiary;
    }
  }
}
