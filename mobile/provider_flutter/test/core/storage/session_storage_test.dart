import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/core/storage/session_storage.dart';

import '../../helpers/fakes.dart';

class MemorySecureStore implements SecureKeyValueStore {
  final values = <String, String>{};
  final operations = <String>[];
  @override
  Future<String?> read(String key) async {
    operations.add('read:$key');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    operations.add('write:$key');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    operations.add('delete:$key');
    values.remove(key);
  }
}

void main() {
  test(
    'session tokens round-trip only through the secure store abstraction',
    () async {
      final store = MemorySecureStore();
      final storage = SecureSessionStorage(store: store);
      await storage.write(testSession('secret-access'));
      final restored = await storage.read();
      expect(restored?.accessToken, 'secret-access');
      expect(store.operations, [
        'write:${SecureSessionStorage.storageKey}',
        'read:${SecureSessionStorage.storageKey}',
      ]);
    },
  );

  test('malformed secure data is removed and not restored', () async {
    final store = MemorySecureStore()
      ..values[SecureSessionStorage.storageKey] = 'not-json';
    final storage = SecureSessionStorage(store: store);
    expect(await storage.read(), isNull);
    expect(store.values, isEmpty);
  });

  test('logout storage clear deletes the provider session key', () async {
    final store = MemorySecureStore();
    final storage = SecureSessionStorage(store: store);
    await storage.write(testSession());
    await storage.clear();
    expect(store.values, isEmpty);
    expect(store.operations.last, 'delete:${SecureSessionStorage.storageKey}');
  });
}
