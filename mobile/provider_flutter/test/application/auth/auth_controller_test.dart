import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/application/auth/auth_controller.dart';

import '../../helpers/fakes.dart';

void main() {
  test('bootstrap restores session and loads backend provider scope', () async {
    final auth = FakeAuthRepository()..value = testSession();
    final providers = FakeProviderRepository();
    final controller = AuthController(auth, providers);
    await controller.bootstrap();
    expect(auth.restored, isTrue);
    expect(providers.loadCalls, 1);
    expect(controller.status, AuthStatus.authenticated);
    expect(controller.providerContext?.teams.single.id, 'team-1');
  });

  test('bootstrap routes an empty secure session to authentication', () async {
    final auth = FakeAuthRepository();
    final controller = AuthController(auth, FakeProviderRepository());
    await controller.bootstrap();
    expect(controller.status, AuthStatus.unauthenticated);
  });

  test('customer-only account reaches provider access denied', () async {
    final auth = FakeAuthRepository()
      ..value = testSession()
      ..identity = customerIdentity();
    final providers = FakeProviderRepository();
    final controller = AuthController(auth, providers);
    await controller.bootstrap();
    expect(controller.status, AuthStatus.unauthorized);
    expect(controller.providerContext, isNull);
    expect(providers.loadCalls, 0);
  });

  test(
    'OTP verification validates provider scope before authenticating',
    () async {
      final auth = FakeAuthRepository();
      final providers = FakeProviderRepository();
      final controller = AuthController(auth, providers);
      await controller.verifyOtp(challengeId: 'challenge-1', code: '123456');
      expect(controller.status, AuthStatus.authenticated);
      expect(controller.identity?.providerScopes, isNotEmpty);
      expect(providers.loadCalls, 1);
    },
  );

  test(
    'logout clears provider state and secure session through repository',
    () async {
      final auth = FakeAuthRepository()..value = testSession();
      final controller = AuthController(auth, FakeProviderRepository());
      await controller.bootstrap();
      await controller.logout();
      expect(auth.loggedOut, isTrue);
      expect(auth.session, isNull);
      expect(controller.providerContext, isNull);
      expect(controller.status, AuthStatus.unauthenticated);
    },
  );

  test(
    'session expiration immediately removes access to provider state',
    () async {
      final auth = FakeAuthRepository()..value = testSession();
      final controller = AuthController(auth, FakeProviderRepository());
      await controller.bootstrap();
      controller.sessionExpired();
      expect(controller.isAuthenticated, isFalse);
      expect(controller.identity, isNull);
      expect(controller.status, AuthStatus.unauthenticated);
    },
  );
}
