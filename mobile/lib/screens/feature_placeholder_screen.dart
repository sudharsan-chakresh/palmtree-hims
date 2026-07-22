import 'package:flutter/material.dart';
import '../widgets/breadcrumb.dart';

class FeaturePlaceholderScreen extends StatelessWidget {
  final String title;
  final List<String> breadcrumb;
  final IconData icon;
  final Color color;

  const FeaturePlaceholderScreen({
    super.key,
    required this.title,
    required this.breadcrumb,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1e293b),
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Breadcrumb(paths: breadcrumb),
            const Spacer(),
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        shape: BoxShape.circle),
                    child: Icon(icon, size: 64, color: color),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    '$title Module',
                    style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0f172a)),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'This clinical module is being synchronized\nwith your local hospital shard.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF64748b), height: 1.5),
                  ),
                  const SizedBox(height: 32),
                  const CircularProgressIndicator(strokeWidth: 2),
                ],
              ),
            ),
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }
}
