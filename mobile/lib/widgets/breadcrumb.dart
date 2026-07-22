import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Animated breadcrumb navigation with slide-in segments.
class Breadcrumb extends StatelessWidget {
  final List<String> paths;

  const Breadcrumb({super.key, required this.paths});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: paths.asMap().entries.map((entry) {
            final index = entry.key;
            final path = entry.value;
            final isLast = index == paths.length - 1;

            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: Duration(milliseconds: 300 + (index * 100)),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) {
                return Transform.translate(
                  offset: Offset((1 - value) * 20, 0),
                  child: Opacity(
                    opacity: value.clamp(0.0, 1.0),
                    child: child,
                  ),
                );
              },
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: isLast
                          ? AppColors.primarySurface
                          : AppColors.background,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isLast
                            ? AppColors.primary.withValues(alpha: 0.2)
                            : AppColors.border,
                        width: 0.5,
                      ),
                    ),
                    child: Text(
                      path,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isLast ? FontWeight.w800 : FontWeight.w600,
                        color: isLast
                            ? AppColors.primaryDark
                            : AppColors.textTertiary,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                  if (!isLast)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6.0),
                      child: Icon(Icons.chevron_right_rounded,
                          size: 14, color: AppColors.textHint),
                    ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
