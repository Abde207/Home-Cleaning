import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/booking/booking_controller.dart';
import 'package:home_clean_customer/core/errors/app_exception.dart';
import 'package:home_clean_customer/domain/booking/booking_models.dart';
import 'package:home_clean_customer/domain/booking/booking_repository.dart';
import 'package:home_clean_customer/domain/customer/customer_models.dart';
import 'package:home_clean_customer/domain/customer/customer_repository.dart';

const serviceFixture = CleaningService(id: 'service-1', code: 'CLEAN', name: 'Clean', nameAr: 'تنظيف', description: 'Details', basePrice: '20', durationMinutes: 60, extras: [ServiceExtra(id: 'extra-1', name: 'Windows', nameAr: 'نوافذ', price: '5')]);
const address = CustomerAddress(id: 'address-1', label: 'Home', addressText: 'Main Street', latitude: 31, longitude: 35, isDefault: true, validationStatus: 'VALID');
const property = CustomerProperty(id: 'property-1', type: 'APARTMENT', size: '90', rooms: 2, bathrooms: 1);

BookingQuote quoteFixture({DateTime? expires}) => BookingQuote(id: 'quote-1', basePrice: '20', extrasTotal: '5', adjustments: const [], fees: const [], discount: '0', total: '25', currency: 'JOD', expiresAt: expires ?? DateTime.now().add(const Duration(minutes: 5)), extras: const [QuoteExtra(name: 'Windows', quantity: 1, lineTotal: '5')], promotion: null);
BookingDetail detailFixture({String status = 'REQUESTED', String? method, List<BookingPayment> payments = const []}) => BookingDetail(id: 'booking-1', number: 'HC-1', status: status, paymentMethod: method, price: '25', currency: 'JOD', scheduledAt: DateTime.now().add(const Duration(days: 1)), serviceName: 'Clean', serviceNameAr: 'تنظيف', address: 'Main Street', property: const {'type': 'APARTMENT', 'size': '90'}, extras: const [], priceSnapshot: const {}, payments: payments, assignmentStatus: null);

class CustomerStub extends Fake implements CustomerRepository {
  int validations = 0, creations = 0;
  @override Future<List<CleaningService>> services() async => [serviceFixture];
  @override Future<CleaningService> service(String id) async => serviceFixture;
  @override Future<List<CustomerAddress>> addresses() async => [address];
  @override Future<CustomerAddress> validateAddress({required String label, required String addressText, double? latitude, double? longitude}) async { validations++; return address; }
  @override Future<CustomerAddress> createAddress({required String label, required String addressText, double? latitude, double? longitude, bool isDefault = false}) async { creations++; expect(latitude, 31); expect(longitude, 35); return address; }
}

class BookingStub extends Fake implements BookingRepository {
  final calls = <String>[];
  final keys = <String>[];
  BookingQuote nextQuote = quoteFixture();
  BookingDetail current = detailFixture();
  AppException? createError;
  Completer<void>? createGate;
  int createCount = 0;
  @override Future<List<CustomerProperty>> properties() async => [property];
  @override Future<CustomerProperty> createProperty({required String type, required String size, required int rooms, required int bathrooms}) async => property;
  @override Future<BookingQuote> quote(BookingInput input) async { calls.add('quote'); expect(input.toJson()['extras'], [{'serviceExtraId': 'extra-1', 'quantity': 1}]); return nextQuote; }
  @override Future<BookingDetail> create(BookingInput input, DateTime scheduledAt, String instructions, String quoteId, String key) async {
    createCount++; calls.add('create'); keys.add(key); await createGate?.future;
    if (createError != null) throw createError!;
    current = detailFixture(); return current;
  }
  @override Future<void> confirm(String bookingId, String key) async { calls.add('confirm'); keys.add(key); current = detailFixture(status: 'PRICE_CONFIRMED'); }
  @override Future<void> selectCash(String bookingId, String key) async { calls.add('cash'); keys.add(key); current = detailFixture(status: 'CASH_SELECTED', method: 'CASH', payments: const [BookingPayment(id: 'payment-1', method: 'CASH', status: 'CASH_SELECTED')]); }
  @override Future<BookingPayment> startOnline(String bookingId, String key) async { calls.add('online'); keys.add(key); current = detailFixture(status: 'PAYMENT_PENDING', method: 'ONLINE', payments: const [BookingPayment(id: 'payment-1', method: 'ONLINE', status: 'PENDING')]); return const BookingPayment(id: 'payment-1', method: 'ONLINE', status: 'PENDING', checkoutUrl: 'https://mock-payments.invalid/checkout/1'); }
  @override Future<BookingPayment> retryOnline(String paymentId, String key) async { calls.add('retryOnline'); keys.add(key); current = detailFixture(status: 'PAYMENT_PENDING', method: 'ONLINE', payments: const [BookingPayment(id: 'payment-1', method: 'ONLINE', status: 'PENDING')]); return current.latestPayment!; }
  @override Future<BookingDetail> detail(String bookingId) async { calls.add('detail'); return current; }
  @override Future<void> cancel(String bookingId, String key, {String? reason}) async { calls.add('cancel'); keys.add(key); current = detailFixture(status: 'CANCELLED'); }
}

Future<BookingController> ready(BookingStub repo) async {
  final c = BookingController(repo, CustomerStub());
  await c.load(); await c.selectService(serviceFixture);
  c.setExtra('extra-1', true);
  await c.nextFromService();
  c.selectProperty(property); c.selectAddress(address); c.nextFromLocation();
  c.schedule(DateTime.now().add(const Duration(days: 1)));
  await c.requestQuote();
  return c;
}

void main() {
  test('service, extra, property, address and future schedule reach quote with server total', () async {
    final repo = BookingStub(); final c = await ready(repo);
    expect(c.selection.service?.id, serviceFixture.id);
    expect(c.selection.extras, {'extra-1': 1});
    expect(c.selection.input!.propertyId, property.id);
    expect(c.selection.input!.addressId, address.id);
    expect(c.step, BookingStep.review);
    expect(c.quote!.total, '25');
  });

  test('changing an extra invalidates the quote', () async {
    final c = await ready(BookingStub());
    c.setExtra('extra-1', false);
    expect(c.quote, isNull);
  });

  test('new address is validated and saved before selection', () async {
    final customer = CustomerStub(); final c = BookingController(BookingStub(), customer);
    await c.addAddress(label: 'Home', addressText: 'Main Street');
    expect(customer.validations, 1); expect(customer.creations, 1);
    expect(c.selection.address?.id, address.id);
  });

  test('new property is saved and selected', () async {
    final c = BookingController(BookingStub(), CustomerStub());
    await c.addProperty(type: 'APARTMENT', size: '90', rooms: 2, bathrooms: 1);
    expect(c.selection.property?.id, property.id);
  });

  test('expired quote prevents creation', () async {
    final repo = BookingStub()..nextQuote = quoteFixture(expires: DateTime.now().subtract(const Duration(seconds: 1)));
    final c = await ready(repo); await c.submit();
    expect(c.error?.code, 'QUOTE_EXPIRED'); expect(repo.createCount, 0);
  });

  test('cash flow creates, confirms and selects cash without recording collection', () async {
    final repo = BookingStub(); final c = await ready(repo); await c.submit();
    expect(repo.calls.where((x) => x != 'detail').toList(), ['quote', 'create', 'confirm', 'cash']);
    expect(c.detail?.status, 'CASH_SELECTED');
    expect(c.detail?.latestPayment?.status, 'CASH_SELECTED');
    expect(repo.keys.length, 3);
  });

  test('online flow remains pending until server state changes', () async {
    final repo = BookingStub(); final c = await ready(repo); c.choosePayment(PaymentChoice.online); await c.submit();
    expect(repo.calls, contains('online'));
    expect(c.detail?.status, 'PAYMENT_PENDING');
    expect(c.detail?.latestPayment?.status, 'PENDING');
    repo.current = detailFixture(status: 'PAYMENT_CONFIRMED', method: 'ONLINE', payments: const [BookingPayment(id: 'payment-1', method: 'ONLINE', status: 'CONFIRMED')]);
    await c.refreshDetail(); expect(c.detail?.status, 'PAYMENT_CONFIRMED');
  });

  test('failed online payment uses backend retry and returns to pending', () async {
    final repo = BookingStub(); final c = await ready(repo); c.choosePayment(PaymentChoice.online); await c.submit();
    repo.current = detailFixture(status: 'PAYMENT_PENDING', method: 'ONLINE', payments: const [BookingPayment(id: 'payment-1', method: 'ONLINE', status: 'FAILED')]);
    await c.refreshDetail(); await c.retryPayment();
    expect(repo.calls, contains('retryOnline')); expect(c.detail?.latestPayment?.status, 'PENDING');
  });

  test('double tap sends one create command', () async {
    final repo = BookingStub()..createGate = Completer<void>(); final c = await ready(repo);
    final first = c.submit(); final second = c.submit();
    expect(repo.createCount, 1);
    repo.createGate!.complete(); await Future.wait([first, second]);
    expect(repo.createCount, 1);
  });

  test('timeout retries creation with same key', () async {
    final repo = BookingStub()..createError = const AppException(kind: AppExceptionKind.timeout, message: 'timeout');
    final c = await ready(repo); await c.submit();
    expect(c.error?.kind, AppExceptionKind.timeout);
    expect(c.hasUnresolvedCreate, isTrue);
    c.back(); expect(c.step, BookingStep.review);
    repo.createError = null; await c.submit();
    expect(repo.keys[0], repo.keys[1]); expect(c.detail?.status, 'CASH_SELECTED');
  });

  test('backend conflict is shown and allows editing the request', () async {
    final repo = BookingStub()..createError = const AppException(kind: AppExceptionKind.api, code: 'QUOTE_INPUT_MISMATCH', message: 'Mismatch', statusCode: 409);
    final c = await ready(repo); await c.submit();
    expect(c.error?.code, 'QUOTE_INPUT_MISMATCH'); expect(c.hasUnresolvedCreate, isFalse);
    expect(c.quote, isNull);
    c.back(); expect(c.step, BookingStep.quote);
  });

  test('backend quote expiration is surfaced and clears old quote', () async {
    final repo = BookingStub()..createError = const AppException(kind: AppExceptionKind.api, code: 'QUOTE_EXPIRED', message: 'Expired', statusCode: 409);
    final c = await ready(repo); await c.submit();
    expect(c.quote, isNull); expect(c.error?.code, 'QUOTE_EXPIRED');
  });

  test('detail and cancellation refresh backend state', () async {
    final repo = BookingStub()..current = detailFixture(status: 'TEAM_ASSIGNED');
    final c = BookingController(repo, CustomerStub()); await c.openDetail('booking-1');
    expect(c.detail?.canCancel, isTrue);
    await c.cancel(); expect(c.detail?.status, 'CANCELLED'); expect(repo.calls, contains('cancel'));
  });

  test('past time is rejected before quote request', () async {
    final repo = BookingStub(); final c = await ready(repo);
    c.schedule(DateTime.now().subtract(const Duration(minutes: 1)));
    await c.requestQuote();
    expect(c.error, isNotNull); expect(repo.calls.where((x) => x == 'quote').length, 1);
  });

  test('cancellation affordance follows backend transition states', () {
    expect(detailFixture(status: 'PAYMENT_PENDING').canCancel, isTrue);
    expect(detailFixture(status: 'TEAM_ASSIGNED').canCancel, isTrue);
    expect(detailFixture(status: 'CASH_SELECTED').canCancel, isFalse);
    expect(detailFixture(status: 'COMPLETED').canCancel, isFalse);
  });
}
