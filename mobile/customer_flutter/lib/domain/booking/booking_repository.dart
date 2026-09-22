import 'booking_models.dart';

abstract interface class BookingRepository {
  Future<List<CustomerProperty>> properties();
  Future<CustomerProperty> createProperty({required String type, required String size, required int rooms, required int bathrooms});
  Future<BookingQuote> quote(BookingInput input);
  Future<BookingDetail> create(BookingInput input, DateTime scheduledAt, String instructions, String quoteId, String key);
  Future<void> confirm(String bookingId, String key);
  Future<void> selectCash(String bookingId, String key);
  Future<BookingPayment> startOnline(String bookingId, String key);
  Future<BookingPayment> retryOnline(String paymentId, String key);
  Future<BookingDetail> detail(String bookingId);
  Future<void> cancel(String bookingId, String key, {String? reason});
}
