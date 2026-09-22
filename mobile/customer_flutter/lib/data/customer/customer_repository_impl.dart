import '../../domain/customer/customer_models.dart';
import '../../domain/customer/customer_repository.dart';
import 'customer_remote_data_source.dart';

class CustomerRepositoryImpl implements CustomerRepository {
  const CustomerRepositoryImpl(this._remote);
  final CustomerRemoteDataSource _remote;
  @override Future<CustomerProfile> profile() => _remote.profile();
  @override Future<CustomerProfile> updateProfile({String? name, String? locale}) => _remote.updateProfile(name: name, locale: locale);
  @override Future<List<CleaningService>> services() => _remote.services();
  @override Future<CleaningService> service(String id) => _remote.service(id);
  @override Future<List<CustomerAddress>> addresses() => _remote.addresses();
  @override Future<CustomerAddress> validateAddress({required String label, required String addressText, double? latitude, double? longitude}) => _remote.validateAddress(label: label, addressText: addressText, latitude: latitude, longitude: longitude);
  @override Future<CustomerAddress> createAddress({required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) => _remote.createAddress(label: label, addressText: addressText, latitude: latitude, longitude: longitude, isDefault: isDefault);
  @override Future<CustomerAddress> updateAddress({required String id, required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) => _remote.updateAddress(id: id, label: label, addressText: addressText, latitude: latitude, longitude: longitude, isDefault: isDefault);
  @override Future<void> archiveAddress(String id) => _remote.archiveAddress(id);
  @override Future<List<BookingSummary>> bookings() => _remote.bookings();
  @override Future<List<CustomerNotification>> notifications() => _remote.notifications();
  @override Future<void> readNotification(String id) => _remote.readNotification(id);
}
