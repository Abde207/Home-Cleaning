import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/customer/customer_controller.dart';
import 'package:home_clean_customer/domain/customer/customer_models.dart';
import 'package:home_clean_customer/domain/customer/customer_repository.dart';

class FakeCustomerRepository implements CustomerRepository {
  CustomerProfile currentProfile = const CustomerProfile(id: 'c1', name: 'Maya', phone: '+962700000000', locale: 'en');
  List<CleaningService> currentServices = const [CleaningService(id: 's1', code: 'STANDARD', name: 'Standard clean', nameAr: 'تنظيف عادي', description: 'A complete clean', basePrice: '20.00', durationMinutes: 120, extras: [])];
  List<CustomerAddress> currentAddresses = const [];
  @override Future<CustomerProfile> profile() async => currentProfile;
  @override Future<CustomerProfile> updateProfile({String? name, String? locale}) async => currentProfile = CustomerProfile(id: 'c1', name: name ?? currentProfile.name, phone: currentProfile.phone, locale: locale ?? currentProfile.locale);
  @override Future<List<CleaningService>> services() async => currentServices;
  @override Future<CleaningService> service(String id) async => currentServices.first;
  @override Future<List<CustomerAddress>> addresses() async => currentAddresses;
  @override Future<CustomerAddress> validateAddress({required String label, required String addressText, double? latitude, double? longitude}) async => CustomerAddress(id: '', label: label, addressText: addressText, latitude: latitude ?? 31.95, longitude: longitude ?? 35.91, isDefault: false, validationStatus: 'VERIFIED');
  @override Future<CustomerAddress> createAddress({required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) async { final value = CustomerAddress(id: 'a1', label: label, addressText: addressText, latitude: latitude, longitude: longitude, isDefault: isDefault, validationStatus: 'VERIFIED'); currentAddresses = [value]; return value; }
  @override Future<CustomerAddress> updateAddress({required String id, required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) async => CustomerAddress(id: id, label: label, addressText: addressText, latitude: latitude, longitude: longitude, isDefault: isDefault, validationStatus: 'VERIFIED');
  @override Future<void> archiveAddress(String id) async {}
  @override Future<List<BookingSummary>> bookings() async => const [];
  @override Future<List<CustomerNotification>> notifications() async => const [];
  @override Future<void> readNotification(String id) async {}
}

void main() {
  test('service state loads catalog and exposes backend models', () async {
    final controller = CustomerController(FakeCustomerRepository());
    await controller.loadServices();
    expect(controller.services.single.code, 'STANDARD');
    expect(controller.services.single.durationMinutes, 120);
    expect(controller.loadingServices, isFalse);
  });

  test('address state validates before saving and updates local source of truth', () async {
    final controller = CustomerController(FakeCustomerRepository());
    await controller.saveAddress(label: 'Home', addressText: 'Amman', isDefault: true);
    expect(controller.addresses.single.isDefault, isTrue);
    expect(controller.addresses.single.validationStatus, 'VERIFIED');
  });

  test('profile state persists the backend locale preference', () async {
    final controller = CustomerController(FakeCustomerRepository());
    await controller.loadProfile();
    await controller.updateProfile(name: 'Maya Alia', locale: 'ar');
    expect(controller.profile?.name, 'Maya Alia');
    expect(controller.profile?.locale, 'ar');
  });
}
