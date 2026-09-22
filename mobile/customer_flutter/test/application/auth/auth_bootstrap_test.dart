import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/auth/auth_controller.dart';
import 'package:home_clean_customer/domain/auth/auth_repository.dart';
import 'package:home_clean_customer/domain/auth/auth_session.dart';

class RestoringRepository implements AuthRepository {
  AuthSession? value = AuthSession(accessToken: 'a', refreshToken: 'r', accessExpiresAt: DateTime.utc(2030), refreshExpiresAt: DateTime.utc(2030));
  bool loggedOut = false;
  @override AuthSession? get session => value;
  @override Future<void> restore() async {}
  @override Future<AuthChallenge> requestOtp(String phone) async => AuthChallenge(challengeId: 'c', expiresAt: DateTime.utc(2030));
  @override Future<AuthSession> verifyOtp({required String challengeId, required String code}) async => value!;
  @override Future<bool> refreshSession() async => true;
  @override Future<void> logout() async { loggedOut = true; value = null; }
  @override Future<Map<String, dynamic>> me() async => {'id': 'customer-1', 'name': 'Maya', 'phone': '+962700000000', 'locale': 'en'};
}

void main() {
  test('bootstrap restores secure session, validates it with me, and authenticates', () async {
    final repository = RestoringRepository();
    final controller = AuthController(repository);
    await controller.bootstrap();
    expect(controller.status, AuthStatus.authenticated);
    expect(controller.profile?['id'], 'customer-1');
    expect(repository.loggedOut, isFalse);
  });
}
