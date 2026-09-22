import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../domain/auth/auth_session.dart';

abstract interface class SecureKeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureKeyValueStore implements SecureKeyValueStore {
  FlutterSecureKeyValueStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

abstract interface class SessionStorage {
  Future<AuthSession?> read();
  Future<void> write(AuthSession session);
  Future<void> clear();
}

class SecureSessionStorage implements SessionStorage {
  SecureSessionStorage({SecureKeyValueStore? store})
    : _store = store ?? FlutterSecureKeyValueStore();

  static const storageKey = 'home_clean.provider.session.v1';
  final SecureKeyValueStore _store;

  @override
  Future<AuthSession?> read() async {
    final raw = await _store.read(storageKey);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) throw const FormatException();
      return AuthSession.fromJson(decoded);
    } on Object {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(AuthSession session) =>
      _store.write(storageKey, jsonEncode(session.toJson()));

  @override
  Future<void> clear() => _store.delete(storageKey);
}
