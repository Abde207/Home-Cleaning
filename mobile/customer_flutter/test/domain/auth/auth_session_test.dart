import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/domain/auth/auth_session.dart';

void main() {
  test('serializes and restores opaque session tokens without changing timestamps', () {
    final original = AuthSession(accessToken: 'a', refreshToken: 'r', accessExpiresAt: DateTime.utc(2030, 1, 1), refreshExpiresAt: DateTime.utc(2030, 2, 1));
    final restored = AuthSession.fromJson(original.toJson());
    expect(restored.accessToken, 'a');
    expect(restored.refreshToken, 'r');
    expect(restored.accessExpiresAt, original.accessExpiresAt);
    expect(restored.refreshExpiresAt, original.refreshExpiresAt);
  });
}
