import 'customer_models.dart';

abstract interface class CustomerRepository {
  Future<CustomerProfile> profile();
  Future<CustomerProfile> updateProfile({String? name, String? locale});
  Future<List<CleaningService>> services();
  Future<CleaningService> service(String id);
  Future<List<CustomerAddress>> addresses();
  Future<CustomerAddress> validateAddress({required String label, required String addressText, double? latitude, double? longitude});
  Future<CustomerAddress> createAddress({required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false});
  Future<CustomerAddress> updateAddress({required String id, required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false});
  Future<void> archiveAddress(String id);
  Future<List<BookingSummary>> bookings();
  Future<List<CustomerNotification>> notifications();
  Future<void> readNotification(String id);
}
