import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';
import '../../domain/customer/customer_models.dart';
import '../../domain/customer/customer_repository.dart';

class CustomerController extends ChangeNotifier {
  CustomerController(this._repository);
  final CustomerRepository _repository;

  CustomerProfile? profile;
  List<CleaningService> services = const [];
  List<CustomerAddress> addresses = const [];
  List<BookingSummary> bookings = const [];
  List<CustomerNotification> notifications = const [];
  bool loadingProfile = false;
  bool loadingServices = false;
  bool loadingAddresses = false;
  bool loadingBookings = false;
  bool loadingNotifications = false;
  bool saving = false;
  AppException? error;
  AppException? profileError, servicesError, addressesError, bookingsError, notificationsError;
  int _sessionEpoch = 0;
  int _addressRevision = 0;
  final Set<String> _readingNotifications = {};

  BookingSummary? get upcomingBooking {
    final upcoming = bookings.where((item) => item.scheduledAt != null && item.scheduledAt!.isAfter(DateTime.now()) && !const {'CANCELLED', 'COMPLETED', 'NO_TEAM_AVAILABLE', 'CUSTOMER_NO_SHOW', 'REFUNDED'}.contains(item.status)).toList()..sort((a, b) => a.scheduledAt!.compareTo(b.scheduledAt!));
    return upcoming.isEmpty ? null : upcoming.first;
  }

  int get unreadNotifications => notifications.where((item) => !item.isRead).length;

  void clearSession() { _sessionEpoch++; _addressRevision++; profile = null; services = const []; addresses = const []; bookings = const []; notifications = const []; loadingProfile = loadingServices = loadingAddresses = loadingBookings = loadingNotifications = saving = false; error = null; profileError = servicesError = addressesError = bookingsError = notificationsError = null; _readingNotifications.clear(); notifyListeners(); }

  Future<void> loadHome() async {
    await Future.wait<void>([loadProfile(), loadBookings(), loadNotifications()]);
  }

  Future<void> loadProfile() async {
    if (loadingProfile) return;
    final epoch = _sessionEpoch;
    loadingProfile = true;
    profileError = null;
    notifyListeners();
    try {
      final result = await _repository.profile();
      if (epoch == _sessionEpoch) profile = result;
    } on Object catch (value) {
      if (epoch == _sessionEpoch) profileError = _asException(value);
    } finally {
      if (epoch == _sessionEpoch) { loadingProfile = false; notifyListeners(); }
    }
  }

  Future<void> updateProfile({required String name, required String locale}) async {
    if (saving) return;
    final epoch = _sessionEpoch;
    saving = true;
    error = null;
    notifyListeners();
    try {
      final result = await _repository.updateProfile(name: name, locale: locale);
      if (epoch == _sessionEpoch) profile = result;
    } on Object catch (value) {
      if (epoch == _sessionEpoch) error = _asException(value);
      rethrow;
    } finally {
      if (epoch == _sessionEpoch) { saving = false; notifyListeners(); }
    }
  }

  Future<void> loadServices() async {
    if (loadingServices) return;
    final epoch = _sessionEpoch;
    loadingServices = true;
    servicesError = null;
    notifyListeners();
    try {
      final result = await _repository.services();
      if (epoch == _sessionEpoch) services = result;
    } on Object catch (value) {
      if (epoch == _sessionEpoch) servicesError = _asException(value);
    } finally {
      if (epoch == _sessionEpoch) { loadingServices = false; notifyListeners(); }
    }
  }

  Future<CleaningService?> loadService(String id) async {
    try {
      return await _repository.service(id);
    } on Object catch (value) {
      error = _asException(value);
      notifyListeners();
      return null;
    }
  }

  Future<void> loadAddresses() async {
    if (loadingAddresses) return;
    final epoch = _sessionEpoch;
    final revision = _addressRevision;
    loadingAddresses = true;
    addressesError = null;
    notifyListeners();
    try {
      final result = await _repository.addresses();
      if (epoch == _sessionEpoch && revision == _addressRevision) addresses = result;
    } on Object catch (value) {
      if (epoch == _sessionEpoch) addressesError = _asException(value);
    } finally {
      if (epoch == _sessionEpoch) { loadingAddresses = false; notifyListeners(); }
    }
  }

  Future<void> saveAddress({String? id, required String label, required String addressText, double? latitude, double? longitude, required bool isDefault}) async {
    if (saving) return;
    final epoch = _sessionEpoch;
    saving = true;
    error = null;
    notifyListeners();
    try {
      final validated = await _repository.validateAddress(label: label, addressText: addressText, latitude: latitude, longitude: longitude);
      final resolvedLatitude = validated.latitude ?? latitude;
      final resolvedLongitude = validated.longitude ?? longitude;
      final saved = id == null
          ? await _repository.createAddress(label: label, addressText: addressText, latitude: resolvedLatitude, longitude: resolvedLongitude, isDefault: isDefault)
          : await _repository.updateAddress(id: id, label: label, addressText: addressText, latitude: resolvedLatitude, longitude: resolvedLongitude, isDefault: isDefault);
      if (epoch == _sessionEpoch) {
        _addressRevision++;
        addresses = [for (final item in addresses.where((item) => item.id != saved.id)) saved.isDefault && item.isDefault ? CustomerAddress(id: item.id, label: item.label, addressText: item.addressText, latitude: item.latitude, longitude: item.longitude, isDefault: false, validationStatus: item.validationStatus) : item, saved];
        notifyListeners();
        await loadAddresses();
      }
    } on Object catch (value) {
      if (epoch == _sessionEpoch) error = _asException(value);
      rethrow;
    } finally {
      if (epoch == _sessionEpoch) { saving = false; notifyListeners(); }
    }
  }

  Future<void> archiveAddress(CustomerAddress address) async {
    if (saving) return;
    final epoch = _sessionEpoch;
    saving = true;
    error = null;
    notifyListeners();
    try {
      await _repository.archiveAddress(address.id);
      if (epoch == _sessionEpoch) {
        _addressRevision++;
        addresses = addresses.where((item) => item.id != address.id).toList(growable: false);
        notifyListeners();
        await loadAddresses();
      }
    } on Object catch (value) {
      if (epoch == _sessionEpoch) error = _asException(value);
      rethrow;
    } finally {
      if (epoch == _sessionEpoch) { saving = false; notifyListeners(); }
    }
  }

  Future<void> loadBookings() async {
    if (loadingBookings) return;
    final epoch = _sessionEpoch;
    loadingBookings = true;
    bookingsError = null;
    notifyListeners();
    try {
      final result = await _repository.bookings();
      if (epoch == _sessionEpoch) bookings = result;
    } on Object catch (value) {
      if (epoch == _sessionEpoch) bookingsError = _asException(value);
    } finally {
      if (epoch == _sessionEpoch) { loadingBookings = false; notifyListeners(); }
    }
  }

  Future<void> loadNotifications() async {
    if (loadingNotifications) return;
    final epoch = _sessionEpoch;
    loadingNotifications = true;
    notificationsError = null;
    notifyListeners();
    try {
      final result = await _repository.notifications();
      if (epoch == _sessionEpoch) notifications = result;
    } on Object catch (value) {
      if (epoch == _sessionEpoch) notificationsError = _asException(value);
    } finally {
      if (epoch == _sessionEpoch) { loadingNotifications = false; notifyListeners(); }
    }
  }

  Future<void> readNotification(CustomerNotification item) async {
    if (item.isRead || !_readingNotifications.add(item.id)) return;
    final epoch = _sessionEpoch;
    try {
      await _repository.readNotification(item.id);
      if (epoch == _sessionEpoch) await loadNotifications();
    } on Object catch (value) {
      if (epoch == _sessionEpoch) { notificationsError = _asException(value); notifyListeners(); }
    } finally {
      _readingNotifications.remove(item.id);
    }
  }

  AppException _asException(Object value) => value is AppException ? value : AppException(kind: AppExceptionKind.serialization, message: 'The response could not be loaded.', cause: value);
}
