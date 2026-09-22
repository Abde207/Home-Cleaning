import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';
import '../../domain/auth/auth_repository.dart';
import '../../domain/provider/provider_models.dart';
import '../../domain/provider/provider_repository.dart';

enum AuthStatus {
  bootstrap,
  unauthenticated,
  authenticating,
  loadingScope,
  authenticated,
  unauthorized,
  recoverableFailure,
}

class AuthController extends ChangeNotifier {
  AuthController(this._auth, this._providers);

  final AuthRepository _auth;
  final ProviderRepository _providers;

  AuthStatus status = AuthStatus.bootstrap;
  AppException? error;
  String? challengeId;
  DateTime? otpExpiresAt;
  ProviderIdentity? identity;
  ProviderContext? providerContext;

  bool get isAuthenticated =>
      status == AuthStatus.authenticated &&
      _auth.session != null &&
      providerContext != null;

  void sessionExpired() {
    identity = null;
    providerContext = null;
    challengeId = null;
    otpExpiresAt = null;
    error = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    status = AuthStatus.bootstrap;
    error = null;
    notifyListeners();
    try {
      await _auth.restore();
      if (_auth.session == null) {
        status = AuthStatus.unauthenticated;
      } else {
        await _loadProviderScope();
      }
    } on AppException catch (value) {
      await _handleBootstrapFailure(value);
    } on Object catch (value) {
      error = AppException(
        kind: AppExceptionKind.serialization,
        message: 'Could not restore the provider session.',
        cause: value,
      );
      status = AuthStatus.recoverableFailure;
    }
    notifyListeners();
  }

  Future<void> _handleBootstrapFailure(AppException value) async {
    error = value;
    if (value.kind == AppExceptionKind.unauthorized) {
      await _auth.invalidateSession();
      status = AuthStatus.unauthenticated;
    } else if (value.kind == AppExceptionKind.forbidden &&
        identity?.isProviderAuthorized == true) {
      status = AuthStatus.unauthorized;
    } else {
      status = AuthStatus.recoverableFailure;
    }
  }

  Future<void> _loadProviderScope() async {
    status = AuthStatus.loadingScope;
    error = null;
    notifyListeners();
    final current = await _auth.me();
    identity = current;
    if (!current.isProviderAuthorized) {
      providerContext = null;
      status = AuthStatus.unauthorized;
      return;
    }
    providerContext = await _providers.loadContext(current);
    status = AuthStatus.authenticated;
  }

  Future<void> requestOtp(String phone) async {
    if (status == AuthStatus.authenticating) return;
    challengeId = null;
    otpExpiresAt = null;
    error = null;
    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(phone)) {
      error = const AppException(
        kind: AppExceptionKind.validation,
        code: 'PHONE_INVALID',
        message: 'Enter a valid international phone number.',
      );
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    status = AuthStatus.authenticating;
    notifyListeners();
    try {
      final challenge = await _auth.requestOtp(phone);
      challengeId = challenge.challengeId;
      otpExpiresAt = challenge.expiresAt;
      status = AuthStatus.unauthenticated;
    } on AppException catch (value) {
      error = value;
      status = AuthStatus.unauthenticated;
    } on Object catch (value) {
      error = AppException(
        kind: AppExceptionKind.serialization,
        message: 'The response could not be loaded.',
        cause: value,
      );
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    if (status == AuthStatus.authenticating) return;
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      error = const AppException(
        kind: AppExceptionKind.validation,
        code: 'OTP_INVALID',
        message: 'Enter the six-digit verification code.',
      );
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    status = AuthStatus.authenticating;
    error = null;
    notifyListeners();
    try {
      await _auth.verifyOtp(challengeId: challengeId, code: code);
      await _loadProviderScope();
    } on AppException catch (value) {
      error = value;
      if (value.kind == AppExceptionKind.forbidden &&
          identity?.isProviderAuthorized == true) {
        status = AuthStatus.unauthorized;
      } else {
        if (_auth.session != null) await _auth.invalidateSession();
        status = AuthStatus.unauthenticated;
      }
    } on Object catch (value) {
      if (_auth.session != null) await _auth.invalidateSession();
      error = AppException(
        kind: AppExceptionKind.serialization,
        message: 'The response could not be loaded.',
        cause: value,
      );
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> logout() async {
    await _auth.logout();
    identity = null;
    providerContext = null;
    challengeId = null;
    otpExpiresAt = null;
    error = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
