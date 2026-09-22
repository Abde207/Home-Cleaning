import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/core/storage/session_storage.dart';
import 'package:home_clean_customer/domain/auth/auth_session.dart';

class FakeStorage implements SessionStorage {
  AuthSession? value;
  @override Future<AuthSession?> read() async => value;
  @override Future<void> write(AuthSession session) async => value = session;
  @override Future<void> clear() async => value = null;
}

void main() {
  test('secure storage contract keeps session material separate from preferences', () async {
    final storage = FakeStorage();
    final value = AuthSession(accessToken: 'access', refreshToken: 'refresh', accessExpiresAt: DateTime.utc(2030), refreshExpiresAt: DateTime.utc(2030));
    await storage.write(value);
    expect((await storage.read())?.refreshToken, 'refresh');
    await storage.clear();
    expect(await storage.read(), isNull);
  });
}
