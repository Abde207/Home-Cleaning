import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';
import '../../core/services/request_metadata_service.dart';
import '../../domain/booking/booking_models.dart';
import '../../domain/booking/booking_repository.dart';
import '../../domain/customer/customer_models.dart';
import '../../domain/customer/customer_repository.dart';

enum BookingStep { service, location, schedule, quote, review, details }
enum PaymentChoice { cash, online }

class BookingController extends ChangeNotifier {
  BookingController(this._bookings, this._customer, {RequestMetadataService? metadata}) : _metadata = metadata ?? RequestMetadataService();
  final BookingRepository _bookings;
  final CustomerRepository _customer;
  final RequestMetadataService _metadata;
  BookingSelection selection = BookingSelection();
  BookingStep step = BookingStep.service;
  PaymentChoice paymentChoice = PaymentChoice.cash;
  List<CleaningService> services = const [];
  List<CustomerAddress> addresses = const [];
  List<CustomerProperty> properties = const [];
  BookingQuote? quote;
  BookingDetail? detail;
  BookingPayment? initiatedPayment;
  TeamTracking? tracking;
  AppException? error;
  bool loading = false;
  bool submitting = false;
  String? _createKey, _confirmKey, _paymentKey, _retryKey, _cancelKey, _detailId;
  (BookingInput, DateTime, String, String)? _pendingCreate;
  PaymentChoice? _committedPaymentChoice;
  int _sessionEpoch = 0;
  int _draftEpoch = 0;
  int _detailRequest = 0;
  bool get hasUnresolvedCreate => _createKey != null && detail == null;

  String _key() => _metadata.requestId();
  AppException _error(Object value) => value is AppException ? value : AppException(kind: AppExceptionKind.serialization, message: 'The response could not be loaded.', cause: value);

  Future<void> load() async {
    if (loading) return;
    final epoch = _sessionEpoch;
    loading = true; error = null; notifyListeners();
    try { final result = await _customer.services(); if (epoch == _sessionEpoch) services = result; } on Object catch (value) { if (epoch == _sessionEpoch) error = _error(value); }
    finally { if (epoch == _sessionEpoch) { loading = false; notifyListeners(); } }
  }

  Future<void> selectService(CleaningService service) async {
    if (hasUnresolvedCreate || submitting) return;
    final epoch = _sessionEpoch;
    final draft = ++_draftEpoch;
    loading = true; error = null; notifyListeners();
    try {
      final result = await _customer.service(service.id);
      if (epoch != _sessionEpoch || draft != _draftEpoch) return;
      selection.service = result;
      selection.extras.clear(); _invalidateQuote();
      step = BookingStep.service;
    } on Object catch (value) { if (epoch == _sessionEpoch && draft == _draftEpoch) error = _error(value); }
    finally { if (epoch == _sessionEpoch) { loading = false; notifyListeners(); } }
  }

  void setExtra(String id, bool selected, {int quantity = 1}) {
    if (hasUnresolvedCreate || submitting) return;
    if (selected) { selection.extras[id] = quantity; } else { selection.extras.remove(id); }
    _invalidateQuote(); notifyListeners();
  }

  void setPromotion(String code) { if (hasUnresolvedCreate || submitting) return; selection.promotionCode = code.trim().toUpperCase(); _invalidateQuote(); notifyListeners(); }

  Future<void> loadLocations() async {
    if (loading) return;
    final epoch = _sessionEpoch;
    loading = true; error = null; notifyListeners();
    try {
      final results = await Future.wait<dynamic>([_customer.addresses(), _bookings.properties()]);
      if (epoch != _sessionEpoch) return;
      addresses = results[0] as List<CustomerAddress>;
      properties = results[1] as List<CustomerProperty>;
      if (selection.address != null && !addresses.any((a) => a.id == selection.address!.id)) selection.address = null;
      if (selection.property != null && !properties.any((p) => p.id == selection.property!.id)) selection.property = null;
    } on Object catch (value) { if (epoch == _sessionEpoch) error = _error(value); }
    finally { if (epoch == _sessionEpoch) { loading = false; notifyListeners(); } }
  }

  Future<void> addAddress({required String label, required String addressText}) async {
    if (hasUnresolvedCreate || loading || submitting) return;
    final epoch = _sessionEpoch;
    loading = true; error = null; notifyListeners();
    try {
      final validated = await _customer.validateAddress(label: label, addressText: addressText);
      final saved = await _customer.createAddress(label: label, addressText: addressText, latitude: validated.latitude, longitude: validated.longitude);
      if (epoch != _sessionEpoch) return;
      addresses = [...addresses, saved]; selection.address = saved; _invalidateQuote();
    } on Object catch (value) { if (epoch == _sessionEpoch) error = _error(value); rethrow; }
    finally { if (epoch == _sessionEpoch) { loading = false; notifyListeners(); } }
  }

  Future<void> addProperty({required String type, required String size, required int rooms, required int bathrooms}) async {
    if (hasUnresolvedCreate || loading || submitting) return;
    final epoch = _sessionEpoch;
    loading = true; error = null; notifyListeners();
    try {
      final saved = await _bookings.createProperty(type: type, size: size, rooms: rooms, bathrooms: bathrooms);
      if (epoch != _sessionEpoch) return;
      properties = [...properties, saved]; selection.property = saved; _invalidateQuote();
    } on Object catch (value) { if (epoch == _sessionEpoch) error = _error(value); rethrow; }
    finally { if (epoch == _sessionEpoch) { loading = false; notifyListeners(); } }
  }

  void selectAddress(CustomerAddress address) { if (hasUnresolvedCreate || submitting) return; selection.address = address; _invalidateQuote(); notifyListeners(); }
  void selectProperty(CustomerProperty property) { if (hasUnresolvedCreate || submitting) return; selection.property = property; _invalidateQuote(); notifyListeners(); }
  void choosePayment(PaymentChoice choice) { if (_createKey != null || submitting || detail != null) return; paymentChoice = choice; notifyListeners(); }

  void schedule(DateTime localTime) {
    if (hasUnresolvedCreate || submitting) return;
    selection.scheduledAt = localTime;
    _invalidateQuote();
    notifyListeners();
  }
  void nextFromSchedule() { if (selection.scheduledAt?.isAfter(DateTime.now()) == true) { step = BookingStep.quote; error = null; notifyListeners(); } }

  void nextFromLocation() { if (selection.property != null && selection.address != null) { step = BookingStep.schedule; error = null; notifyListeners(); } }
  Future<void> nextFromService() async { if (selection.service != null) { step = BookingStep.location; notifyListeners(); await loadLocations(); } }
  void back() { if (hasUnresolvedCreate) { error = const AppException(kind: AppExceptionKind.timeout, message: 'Retry the booking request to resolve its result.'); notifyListeners(); return; } step = switch (step) { BookingStep.location => BookingStep.service, BookingStep.schedule => BookingStep.location, BookingStep.quote => BookingStep.schedule, BookingStep.review => BookingStep.quote, _ => step }; notifyListeners(); }

  void _invalidateQuote() { _draftEpoch++; quote = null; _createKey = null; _pendingCreate = null; }

  Future<void> requestQuote() async {
    if (loading || submitting) return;
    if (_createKey != null && detail == null) { error = const AppException(kind: AppExceptionKind.timeout, message: 'Retry the booking request to resolve its result.'); notifyListeners(); return; }
    final input = selection.input;
    if (input == null || selection.scheduledAt == null || !selection.scheduledAt!.isAfter(DateTime.now())) {
      error = const AppException(kind: AppExceptionKind.api, message: 'Select a future date and time, address and property.'); notifyListeners(); return;
    }
    loading = true; error = null; notifyListeners();
    final epoch = _sessionEpoch, draft = _draftEpoch;
    try { final result = await _bookings.quote(input); if (epoch == _sessionEpoch && draft == _draftEpoch) { quote = result; step = BookingStep.review; _createKey = null; } }
    on Object catch (value) { if (epoch == _sessionEpoch && draft == _draftEpoch) error = _error(value); }
    finally { if (epoch == _sessionEpoch) { loading = false; notifyListeners(); } }
  }

  Future<void> submit() async {
    if (submitting || detail != null && step == BookingStep.details) return;
    if (detail == null && _createKey == null && (quote == null || quote!.expired)) { error = const AppException(kind: AppExceptionKind.api, code: 'QUOTE_EXPIRED', message: 'The quote has expired. Refresh it to continue.'); notifyListeners(); return; }
    submitting = true; error = null; notifyListeners();
    final epoch = _sessionEpoch;
    try {
      if (detail == null) {
        _pendingCreate ??= (selection.input!, selection.scheduledAt!, selection.instructions, quote!.id);
        _committedPaymentChoice ??= paymentChoice;
        final pending = _pendingCreate!;
        final created = await _bookings.create(pending.$1, pending.$2, pending.$3, pending.$4, _createKey ??= _key());
        if (epoch != _sessionEpoch) return;
        detail = created;
      }
      await _continueExisting();
    } on Object catch (value) {
      if (epoch != _sessionEpoch) return;
      error = _error(value);
      if (error?.statusCode == 400 || error?.statusCode == 404 || error?.statusCode == 409) {
        _createKey = null;
        _pendingCreate = null;
        _committedPaymentChoice = null;
        if (error?.code?.startsWith('QUOTE_') == true || error?.code == 'PROMOTION_UNAVAILABLE') quote = null;
      }
    }
    finally { if (epoch == _sessionEpoch) { submitting = false; notifyListeners(); } }
  }

  Future<void> resume() async {
    if (submitting || detail == null) return;
    submitting = true; error = null; notifyListeners();
    final epoch = _sessionEpoch;
    try { final result = await _bookings.detail(detail!.id); if (epoch != _sessionEpoch) return; detail = result; await _continueExisting(); }
    on Object catch (value) { if (epoch == _sessionEpoch) error = _error(value); }
    finally { if (epoch == _sessionEpoch) { submitting = false; notifyListeners(); } }
  }

  Future<void> _continueExisting() async {
    final epoch = _sessionEpoch;
    final id = detail!.id;
    if (detail!.status == 'REQUESTED') {
      await _bookings.confirm(id, _confirmKey ??= _key());
      final result = await _bookings.detail(id);
      if (epoch != _sessionEpoch) return;
      detail = result;
    }
    if (detail!.status == 'PRICE_CONFIRMED') {
      if ((_committedPaymentChoice ?? paymentChoice) == PaymentChoice.cash) {
        await _bookings.selectCash(id, _paymentKey ??= _key());
      } else {
        initiatedPayment = await _bookings.startOnline(id, _paymentKey ??= _key());
      }
      if (epoch != _sessionEpoch) return;
      final result = await _bookings.detail(id);
      if (epoch != _sessionEpoch) return;
      detail = result;
    }
    step = BookingStep.details;
  }

  Future<void> openDetail(String id) async {
    final epoch = _sessionEpoch;
    final request = ++_detailRequest;
    _detailId = id; step = BookingStep.details; loading = true; error = null; detail = null; notifyListeners();
    try { final result = await _bookings.detail(id); if (epoch == _sessionEpoch && request == _detailRequest) { detail = result; tracking = await _tracking(result); } }
    on Object catch (value) { if (epoch == _sessionEpoch && request == _detailRequest) error = _error(value); }
    finally { if (epoch == _sessionEpoch && request == _detailRequest) { loading = false; notifyListeners(); } }
  }
  Future<void> retryDetail() async { if (_detailId != null) await openDetail(_detailId!); }

  Future<void> refreshDetail() async {
    if (detail == null || loading || submitting) return;
    final epoch = _sessionEpoch;
    final request = _detailRequest;
    final id = detail!.id;
    loading = true; error = null; notifyListeners();
    try { final result = await _bookings.detail(id); if (epoch == _sessionEpoch && request == _detailRequest && detail?.id == id) { detail = result; tracking = await _tracking(result); if (detail!.latestPayment?.status != 'FAILED') _retryKey = null; } }
    on Object catch (value) { if (epoch == _sessionEpoch && request == _detailRequest) error = _error(value); }
    finally { if (epoch == _sessionEpoch && request == _detailRequest) { loading = false; notifyListeners(); } }
  }

  Future<void> retryPayment() async {
    final payment = detail?.latestPayment;
    if (payment == null || payment.status != 'FAILED' || submitting) return;
    submitting = true; error = null; notifyListeners();
    final epoch = _sessionEpoch;
    final id = detail!.id;
    try { final result = await _bookings.retryOnline(payment.id, _retryKey ??= _key()); if (epoch != _sessionEpoch) return; initiatedPayment = result; final refreshed = await _bookings.detail(id); if (epoch != _sessionEpoch) return; detail = refreshed; _retryKey = null; }
    on Object catch (value) { if (epoch == _sessionEpoch) error = _error(value); }
    finally { if (epoch == _sessionEpoch) { submitting = false; notifyListeners(); } }
  }

  Future<TeamTracking?> _tracking(BookingDetail booking) async {
    if (booking.status != 'TEAM_ON_THE_WAY') return null;
    try { return await _bookings.tracking(booking.id); }
    on Object { return const TeamTracking(active: true, etaStale: false, etaUnavailable: true); }
  }

  Future<void> cancel({String? reason}) async {
    if (detail == null || submitting) return;
    submitting = true; error = null; notifyListeners();
    final epoch = _sessionEpoch;
    final id = detail!.id;
    try { await _bookings.cancel(id, _cancelKey ??= _key(), reason: reason); if (epoch != _sessionEpoch) return; final refreshed = await _bookings.detail(id); if (epoch == _sessionEpoch) detail = refreshed; }
    on Object catch (value) { if (epoch == _sessionEpoch) { final caught = _error(value); try { final refreshed = await _bookings.detail(id); if (epoch == _sessionEpoch) detail = refreshed; } on Object catch (_) {} if (epoch == _sessionEpoch) error = caught; } }
    finally { if (epoch == _sessionEpoch) { submitting = false; notifyListeners(); } }
  }

  void newBooking() { if (hasUnresolvedCreate || submitting) { error = const AppException(kind: AppExceptionKind.timeout, message: 'Retry the booking request to resolve its result.'); notifyListeners(); return; } _draftEpoch++; _detailRequest++; selection = BookingSelection(); detail = null; tracking = null; initiatedPayment = null; quote = null; _pendingCreate = null; _committedPaymentChoice = null; _createKey = null; _confirmKey = null; _paymentKey = null; _retryKey = null; _cancelKey = null; _detailId = null; paymentChoice = PaymentChoice.cash; step = BookingStep.service; notifyListeners(); }
  void clearSession() { _sessionEpoch++; _draftEpoch++; _detailRequest++; selection = BookingSelection(); services = const []; addresses = const []; properties = const []; detail = null; tracking = null; initiatedPayment = null; quote = null; error = null; loading = submitting = false; _pendingCreate = null; _committedPaymentChoice = null; _createKey = null; _confirmKey = null; _paymentKey = null; _retryKey = null; _cancelKey = null; _detailId = null; paymentChoice = PaymentChoice.cash; step = BookingStep.service; notifyListeners(); }
}
