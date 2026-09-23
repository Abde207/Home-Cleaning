import '../../core/network/api_client.dart';
import '../../domain/booking/booking_models.dart';
import '../../domain/booking/booking_repository.dart';

class BookingRepositoryImpl implements BookingRepository {
  const BookingRepositoryImpl(this.client);
  final ApiClient client;
  @override Future<List<CustomerProperty>> properties() async {
    final all = <CustomerProperty>[];
    while (true) {
      final raw = await client.get('/customers/me/properties', query: {'limit': '100', 'offset': '${all.length}'});
      if (raw is! List) throw const FormatException('Expected a list response');
      final page = raw.map((item) => CustomerProperty.fromJson(item as Map<String, dynamic>)).toList();
      all.addAll(page);
      if (page.length < 100) return all;
    }
  }
  @override Future<CustomerProperty> createProperty({required String type, required String size, required int rooms, required int bathrooms}) async => CustomerProperty.fromJson(await client.post('/customers/me/properties', body: {'type': type, 'size': size, 'rooms': rooms, 'bathrooms': bathrooms}) as Map<String, dynamic>);
  @override Future<BookingQuote> quote(BookingInput input) async => BookingQuote.fromJson(await client.post('/bookings/quote', body: input.toJson()) as Map<String, dynamic>);
  @override Future<BookingDetail> create(BookingInput input, DateTime scheduledAt, String instructions, String quoteId, String key) async => BookingDetail.fromJson(await client.post('/bookings', idempotencyKey: key, body: {...input.toJson(), 'quoteId': quoteId, 'scheduledAt': scheduledAt.toUtc().toIso8601String(), if (instructions.isNotEmpty) 'instructions': instructions}) as Map<String, dynamic>);
  @override Future<void> confirm(String bookingId, String key) async { await client.post('/bookings/$bookingId/confirm', idempotencyKey: key); }
  @override Future<void> selectCash(String bookingId, String key) async { await client.post('/bookings/$bookingId/select-cash', idempotencyKey: key); }
  @override Future<BookingPayment> startOnline(String bookingId, String key) async => BookingPayment.fromJson(await client.post('/payments', body: {'bookingId': bookingId}, idempotencyKey: key) as Map<String, dynamic>);
  @override Future<BookingPayment> retryOnline(String paymentId, String key) async => BookingPayment.fromJson(await client.post('/payments/$paymentId/retry', idempotencyKey: key) as Map<String, dynamic>);
  @override Future<BookingDetail> detail(String bookingId) async => BookingDetail.fromJson(await client.get('/bookings/$bookingId') as Map<String, dynamic>);
  @override Future<TeamTracking> tracking(String bookingId) async => TeamTracking.fromJson(await client.get('/tracking/bookings/$bookingId') as Map<String, dynamic>);
  @override Future<void> cancel(String bookingId, String key, {String? reason}) async { await client.post('/bookings/$bookingId/cancel', idempotencyKey: key, body: {if (reason != null && reason.isNotEmpty) 'reason': reason}); }
}
