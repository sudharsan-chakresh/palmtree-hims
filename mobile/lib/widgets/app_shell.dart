import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'animated_nav_bar.dart';

/// Unified app shell providing bottom navigation for each role.
/// Wraps dashboard pages with role-specific tabs and fade transitions.
class AppShell extends StatefulWidget {
  final String role;
  final List<AppShellTab> tabs;
  final int initialIndex;
  final Color? activeColor;

  const AppShell({
    super.key,
    required this.role,
    required this.tabs,
    this.initialIndex = 0,
    this.activeColor,
  });

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late int _currentIndex;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onTabTapped(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        onPageChanged: (index) => setState(() => _currentIndex = index),
        children: widget.tabs.map((tab) => tab.body).toList(),
      ),
      bottomNavigationBar: AnimatedNavBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        activeColor: widget.activeColor ?? AppColors.roleColor(widget.role),
        items: widget.tabs.map((tab) {
          return NavBarItem(
            icon: tab.icon,
            activeIcon: tab.activeIcon,
            label: tab.label,
            badgeCount: tab.badgeCount,
          );
        }).toList(),
      ),
    );
  }
}

/// Configuration for a single tab in the AppShell.
class AppShellTab {
  final IconData icon;
  final IconData? activeIcon;
  final String label;
  final Widget body;
  final int? badgeCount;

  const AppShellTab({
    required this.icon,
    this.activeIcon,
    required this.label,
    required this.body,
    this.badgeCount,
  });
}
