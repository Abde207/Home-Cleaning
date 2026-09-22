import '../../core/network/api_client.dart';
import '../../domain/customer/customer_models.dart';

class CustomerRemoteDataSource {
  const CustomerRemoteDataSource(this._client);
  final ApiClient _client;

  Future<CustomerProfile> profile() async => CustomerProfile.fromJson(await _client.get('/customers/me') as Map<String, dynamic>);

  Future<CustomerProfile> updateProfile({String? name, String? locale}) async {
    final body = <String, dynamic>{...?name == null ? null : {'name': name}, ...?locale == null ? null : {'locale': locale}};
    return CustomerProfile.fromJson(await _client.patch('/customers/me', body: body) as Map<String, dynamic>);
  }

  Future<List<CleaningService>> services() => _pages('/services', CleaningService.fromJson);
  Future<CleaningService> service(String id) async => CleaningService.fromJson(await _client.get('/services/$id') as Map<String, dynamic>);

  Future<List<CustomerAddress>> addresses() => _pages('/customers/me/addresses', CustomerAddress.fromJson);
  Future<CustomerAddress> validateAddress({required String label, required String addressText, double? latitude, double? longitude}) async => CustomerAddress.fromJson(await _client.post('/customers/me/addresses/validate', body: _addressBody(label: label, addressText: addressText, latitude: latitude, longitude: longitude)) as Map<String, dynamic>);
  Future<CustomerAddress> createAddress({required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) async => CustomerAddress.fromJson(await _client.post('/customers/me/addresses', body: _addressBody(label: label, addressText: addressText, latitude: latitude, longitude: longitude, isDefault: isDefault)) as Map<String, dynamic>);
  Future<CustomerAddress> updateAddress({required String id, required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) async => CustomerAddress.fromJson(await _client.put('/customers/me/addresses/$id', body: _addressBody(label: label, addressText: addressText, latitude: latitude, longitude: longitude, isDefault: isDefault)) as Map<String, dynamic>);
  Future<void> archiveAddress(String id) async { await _client.delete('/customers/me/addresses/$id'); }

  Future<List<BookingSummary>> bookings() => _pages('/bookings', BookingSummary.fromJson);
  Future<List<CustomerNotification>> notifications() => _pages('/notifications', CustomerNotification.fromJson);

  Future<List<T>> _pages<T>(String path, T Function(Map<String, dynamic>) parse) async {
    final all = <T>[];
    while (true) {
      final raw = await _client.get(path, query: {'limit': '100', 'offset': '${all.length}'});
      if (raw is! List) throw const FormatException('Expected a list response');
      final page = raw.map((item) => parse(item as Map<String, dynamic>)).toList(growable: false);
      all.addAll(page);
      if (page.length < 100) return all;
    }
  }
  Future<void> readNotification(String id) async { await _client.patch('/notifications/$id/read', body: const {}); }

  Map<String, dynamic> _addressBody({required String label, required String addressText, double? latitude, double? longitude, bool? isDefault}) => <String, dynamic>{
        'label': label,
        'addressText': addressText,
        ...?latitude == null ? null : {'latitude': latitude},
        ...?longitude == null ? null : {'longitude': longitude},
        ...?isDefault == null ? null : {'isDefault': isDefault},
      };

}
