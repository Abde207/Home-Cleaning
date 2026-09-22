import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';

abstract interface class DeviceRegistrationRepository {
  Future<String> register({required String token, required String platform});
  Future<void> unregister(String id);
  Future<String?> storedId();
  Future<void> storeId(String? id);
}

enum DeviceRegistrationState { unavailable, registering, registered, failed }

/// A platform push adapter must supply a real token; no synthetic token is sent.
class DeviceRegistrationController extends ChangeNotifier {
  DeviceRegistrationController(this._repository);
  final DeviceRegistrationRepository _repository;
  DeviceRegistrationState state = DeviceRegistrationState.unavailable;
  AppException? error;
  Future<void>? _registration;
  Future<void>? _removal;

  Future<void> tokenAvailable({required String token, required String platform}) async {
    if (_registration != null) return _registration;
    final work = _register(token: token, platform: platform);
    _registration = work;
    try { await work; } finally { if (identical(_registration, work)) _registration = null; }
  }

  Future<void> _register({required String token, required String platform}) async {
    if (token.length < 20 || token.length > 4096 || !const {'ios', 'android', 'web'}.contains(platform)) {
      error = const AppException(kind: AppExceptionKind.api, message: 'Invalid device token.');
      state = DeviceRegistrationState.failed;
      notifyListeners();
      return;
    }
    state = DeviceRegistrationState.registering; error = null; notifyListeners();
    try {
      final previous = await _repository.storedId();
      final id = await _repository.register(token: token, platform: platform);
      await _repository.storeId(id);
      if (previous != null && previous != id) {
        try { await _repository.unregister(previous); } on Object catch (_) { /* The new registration remains valid. */ }
      }
      state = DeviceRegistrationState.registered;
    } on AppException catch (value) { error = value; state = DeviceRegistrationState.failed; }
    on Object catch (value) { error = AppException(kind: AppExceptionKind.network, message: 'Device registration failed.', cause: value); state = DeviceRegistrationState.failed; }
    notifyListeners();
  }

  Future<void> unregister() async {
    if (_removal != null) return _removal;
    final work = _unregister();
    _removal = work;
    try { await work; } finally { if (identical(_removal, work)) _removal = null; }
  }

  Future<void> _unregister() async {
    if (_registration != null) await _registration;
    final id = await _repository.storedId();
    if (id == null) { state = DeviceRegistrationState.unavailable; notifyListeners(); return; }
    try {
      await _repository.unregister(id);
      await _repository.storeId(null);
      state = DeviceRegistrationState.unavailable; error = null;
    } on AppException catch (value) { error = value; state = DeviceRegistrationState.failed; }
    on Object catch (value) { error = AppException(kind: AppExceptionKind.network, message: 'Device cleanup failed.', cause: value); state = DeviceRegistrationState.failed; }
    notifyListeners();
  }
}
