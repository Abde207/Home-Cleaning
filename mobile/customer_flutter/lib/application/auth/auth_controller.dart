import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';
import '../../domain/auth/auth_repository.dart';

enum AuthStatus { bootstrap, unauthenticated, authenticating, authenticated, failure }

class AuthController extends ChangeNotifier {
  AuthController(this._repository, {this.beforeLogout});
  final AuthRepository _repository;
  final Future<void> Function()? beforeLogout;
  AuthStatus status = AuthStatus.bootstrap;
  AppException? error;
  Map<String, dynamic>? profile;
  String? challengeId;
  DateTime? otpExpiresAt;
  bool get isAuthenticated => status == AuthStatus.authenticated && _repository.session != null;

  void sessionExpired() { profile = null; challengeId = null; otpExpiresAt = null; error = null; status = AuthStatus.unauthenticated; notifyListeners(); }

  Future<void> bootstrap() async {
    status = AuthStatus.bootstrap;
    error = null;
    notifyListeners();
    try {
      await _repository.restore();
      if (_repository.session == null) {
        status = AuthStatus.unauthenticated;
      } else {
        profile = await _repository.me();
        status = AuthStatus.authenticated;
      }
    } on AppException catch (value) {
      error = value;
      if (value.isOffline) {
        status = AuthStatus.bootstrap;
      } else {
        await _repository.logout();
        status = AuthStatus.unauthenticated;
      }
    } on Object catch (value) {
      error = AppException(kind: AppExceptionKind.serialization, message: 'Could not restore the session.', cause: value);
      await _repository.logout();
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> requestOtp(String phone) async {
    if (status == AuthStatus.authenticating) return;
    challengeId = null;
    otpExpiresAt = null;
    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(phone)) {
      error = const AppException(kind: AppExceptionKind.api, code: 'PHONE_INVALID', message: 'Enter a valid international phone number.');
      status = AuthStatus.failure;
      notifyListeners();
      return;
    }
    status = AuthStatus.authenticating;
    error = null;
    notifyListeners();
    try {
      final challenge = await _repository.requestOtp(phone);
      challengeId = challenge.challengeId;
      otpExpiresAt = challenge.expiresAt;
      status = AuthStatus.unauthenticated;
    } on AppException catch (value) {
      error = value;
      status = AuthStatus.failure;
    } on Object catch (value) {
      error = AppException(kind: AppExceptionKind.serialization, message: 'The response could not be loaded.', cause: value);
      status = AuthStatus.failure;
    }
    notifyListeners();
  }

  Future<void> verifyOtp({required String challengeId, required String code}) async {
    if (status == AuthStatus.authenticating) return;
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      error = const AppException(kind: AppExceptionKind.api, code: 'OTP_INVALID', message: 'Enter the six-digit verification code.');
      status = AuthStatus.failure;
      notifyListeners();
      return;
    }
    status = AuthStatus.authenticating;
    error = null;
    notifyListeners();
    try {
      await _repository.verifyOtp(challengeId: challengeId, code: code);
      profile = await _repository.me();
      status = AuthStatus.authenticated;
    } on AppException catch (value) {
      if (_repository.session != null) await _repository.logout();
      error = value;
      status = AuthStatus.failure;
    } on Object catch (value) {
      if (_repository.session != null) await _repository.logout();
      error = AppException(kind: AppExceptionKind.serialization, message: 'The response could not be loaded.', cause: value);
      status = AuthStatus.failure;
    }
    notifyListeners();
  }

  Future<void> logout() async {
    try { await beforeLogout?.call(); } on Object catch (_) { /* Logout still revokes the session. */ }
    await _repository.logout();
    profile = null;
    challengeId = null;
    otpExpiresAt = null;
    error = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
