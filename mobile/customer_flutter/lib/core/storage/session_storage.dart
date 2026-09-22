import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../domain/auth/auth_session.dart';

abstract interface class SessionStorage {
  Future<AuthSession?> read();
  Future<void> write(AuthSession session);
  Future<void> clear();
}

class SecureSessionStorage implements SessionStorage {
  SecureSessionStorage({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();
  static const _key = 'home_clean.customer.session';
  final FlutterSecureStorage _storage;

  @override
  Future<AuthSession?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      return AuthSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(AuthSession session) => _storage.write(key: _key, value: jsonEncode(session.toJson()));
  @override
  Future<void> clear() => _storage.delete(key: _key);
}
