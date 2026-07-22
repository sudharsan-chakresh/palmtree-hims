import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:hims_mobile/screens/login_screen.dart';
import 'package:hims_mobile/screens/patient_auth_screen.dart';

void main() {
  testWidgets('renders the Jioplix login shell',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tenantsProvider.overrideWith((ref) async {
            return [
              {'id': '1', 'name': 'City Clinic'},
            ];
          }),
        ],
        child: const MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Jioplix HIMS'), findsOneWidget);
    expect(find.text('Clinical Operations Portal'), findsOneWidget);
  });

  testWidgets('renders the Jioplix patient auth portal',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          patientTenantsProvider.overrideWith((ref) async {
            return [
              {'id': '1', 'name': 'City Clinic'},
            ];
          }),
        ],
        child: const MaterialApp(
          home: PatientAuthScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Patient Portal Onboarding'), findsOneWidget);
    expect(find.text('Sign In / Lookup'), findsOneWidget);
    expect(find.text('Register Profile'), findsOneWidget);
  });
}
