import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/auth/auth_controller.dart';
import 'package:home_clean_customer/domain/auth/auth_repository.dart';
import 'package:home_clean_customer/domain/auth/auth_session.dart';

class FakeAuthRepository implements AuthRepository {
  AuthSession? stored;
  @override AuthSession? get session => stored;
  @override Future<void> restore() async {}
  @override Future<AuthChallenge> requestOtp(String phone) async => AuthChallenge(challengeId: 'challenge-1', expiresAt: DateTime.utc(2030));
  @override Future<AuthSession> verifyOtp({required String challengeId, required String code}) async => stored = AuthSession(accessToken: 'a', refreshToken: 'r', accessExpiresAt: DateTime.utc(2030), refreshExpiresAt: DateTime.utc(2030));
  @override Future<bool> refreshSession() async => true;
  @override Future<void> logout() async => stored = null;
  @override Future<Map<String, dynamic>> me() async => {'id': 'customer-1'};
}

void main() {
  test('moves through OTP authentication and logout states', () async {
    final repository = FakeAuthRepository();
    final controller = AuthController(repository);
    await controller.bootstrap();
    expect(controller.status, AuthStatus.unauthenticated);
    await controller.requestOtp('+962700000000');
    expect(controller.challengeId, 'challenge-1');
    await controller.verifyOtp(challengeId: controller.challengeId!, code: '123456');
    expect(controller.status, AuthStatus.authenticated);
    expect(controller.profile?['id'], 'customer-1');
    await controller.logout();
    expect(controller.status, AuthStatus.unauthenticated);
  });

  test('device cleanup runs while the authenticated session is still available', () async {
    final repository = FakeAuthRepository()..stored = AuthSession(accessToken: 'a', refreshToken: 'r', accessExpiresAt: DateTime.utc(2030), refreshExpiresAt: DateTime.utc(2030));
    var cleanupSawSession = false;
    final controller = AuthController(repository, beforeLogout: () async { cleanupSawSession = repository.session != null; });
    await controller.logout();
    expect(cleanupSawSession, isTrue);
    expect(repository.session, isNull);
  });
}
