import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/auth/auth_controller.dart';
import 'package:home_clean_customer/core/localization/app_localizations.dart';
import 'package:home_clean_customer/domain/auth/auth_repository.dart';
import 'package:home_clean_customer/domain/auth/auth_session.dart';
import 'package:home_clean_customer/presentation/auth/auth_page.dart';

class UiAuthRepository implements AuthRepository {
  AuthSession? value;
  @override AuthSession? get session => value;
  @override Future<void> restore() async {}
  @override Future<AuthChallenge> requestOtp(String phone) async => AuthChallenge(challengeId: 'challenge-ui', expiresAt: DateTime.utc(2030));
  @override Future<AuthSession> verifyOtp({required String challengeId, required String code}) async => value = AuthSession(accessToken: 'a', refreshToken: 'r', accessExpiresAt: DateTime.utc(2030), refreshExpiresAt: DateTime.utc(2030));
  @override Future<bool> refreshSession() async => true;
  @override Future<void> logout() async {}
  @override Future<Map<String, dynamic>> me() async => {'id': 'c1'};
}

void main() {
  testWidgets('authentication UI moves from phone entry to OTP verification', (tester) async {
    final controller = AuthController(UiAuthRepository());
    await tester.pumpWidget(MaterialApp(localizationsDelegates: const [AppLocalizations.delegate], supportedLocales: AppLocalizations.supportedLocales, home: AuthPage(authController: controller)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, '+962700000000');
    await tester.tap(find.text('Send verification code'));
    await tester.pump();
    expect(find.text('Verification code'), findsOneWidget);
    expect(find.text('Verify and continue'), findsOneWidget);
  });
}
