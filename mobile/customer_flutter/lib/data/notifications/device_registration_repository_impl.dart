import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../application/notifications/device_registration_controller.dart';
import '../../core/network/api_client.dart';

class DeviceRegistrationRepositoryImpl implements DeviceRegistrationRepository {
  const DeviceRegistrationRepositoryImpl(this._client, this._storage);
  final ApiClient _client;
  final FlutterSecureStorage _storage;
  static const _idKey = 'customer_device_registration_id';
  @override Future<String> register({required String token, required String platform}) async {
    final result = await _client.post('/devices', body: {'token': token, 'platform': platform}) as Map<String, dynamic>;
    return result['id'] as String;
  }
  @override Future<void> unregister(String id) async { await _client.delete('/devices/$id'); }
  @override Future<String?> storedId() => _storage.read(key: _idKey);
  @override Future<void> storeId(String? id) => id == null ? _storage.delete(key: _idKey) : _storage.write(key: _idKey, value: id);
}
