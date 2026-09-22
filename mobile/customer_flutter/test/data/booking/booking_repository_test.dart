import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/core/config/app_config.dart';
import 'package:home_clean_customer/core/network/api_client.dart';
import 'package:home_clean_customer/data/booking/booking_repository_impl.dart';
import 'package:home_clean_customer/domain/booking/booking_models.dart';
import 'package:http/http.dart' as http;

class StubClient extends http.BaseClient {
  StubClient(this.handler);
  final FutureOr<http.Response> Function(http.BaseRequest request) handler;
  @override Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(Stream.value(response.bodyBytes), response.statusCode, headers: response.headers, request: request);
  }
}

void main() {
  test('booking create sends quote inputs, UTC instant and required key', () async {
    late http.BaseRequest captured;
    final repo = BookingRepositoryImpl(ApiClient(config: const AppConfig(apiBaseUrl: 'https://example.test/api/v1'), tokenReader: () => null, refreshSession: () async => false, httpClient: StubClient((request) { captured = request; return http.Response(jsonEncode({'success': true, 'data': {'id': 'b1', 'bookingNumber': 'HC-1', 'status': 'REQUESTED', 'price': '25', 'currency': 'JOD'}}), 201); })));
    final input = const BookingInput(serviceId: 's1', propertyId: 'p1', addressId: 'a1', extras: {'e1': 1}, promotionCode: 'SAVE');
    final when = DateTime(2027, 1, 2, 13, 30);
    await repo.create(input, when, 'Notes', 'q1', 'create-key');
    final body = jsonDecode((captured as http.Request).body) as Map<String, dynamic>;
    expect(captured.url.path, '/api/v1/bookings');
    expect(captured.headers['Idempotency-Key'], 'create-key');
    expect(body['quoteId'], 'q1'); expect(body['promotionCode'], 'SAVE');
    expect(body['scheduledAt'], when.toUtc().toIso8601String());
    expect(body.containsKey('total'), isFalse);
  });

  test('payment initiation uses backend boundary and key', () async {
    late http.BaseRequest captured;
    final repo = BookingRepositoryImpl(ApiClient(config: const AppConfig(apiBaseUrl: 'https://example.test/api/v1'), tokenReader: () => null, refreshSession: () async => false, httpClient: StubClient((request) { captured = request; return http.Response('{"success":true,"data":{"id":"pay1","method":"ONLINE","status":"PENDING","attempt":{"checkoutUrl":"https://mock-payments.invalid/checkout/1"}}}', 201); })));
    final payment = await repo.startOnline('b1', 'payment-key');
    expect(captured.url.path, '/api/v1/payments');
    expect(captured.headers['Idempotency-Key'], 'payment-key');
    expect(jsonDecode((captured as http.Request).body), {'bookingId': 'b1'});
    expect(payment.status, 'PENDING');
  });
}
