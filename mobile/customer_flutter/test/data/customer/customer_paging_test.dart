import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/core/config/app_config.dart';
import 'package:home_clean_customer/core/network/api_client.dart';
import 'package:home_clean_customer/data/customer/customer_remote_data_source.dart';
import 'package:http/http.dart' as http;

class StubClient extends http.BaseClient {
  StubClient(this.handler);
  final FutureOr<http.Response> Function(http.BaseRequest request) handler;
  @override Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(Stream.value(response.bodyBytes), response.statusCode, request: request);
  }
}

CustomerRemoteDataSource source(StubClient client) => CustomerRemoteDataSource(ApiClient(config: const AppConfig(apiBaseUrl: 'https://example.test/api/v1'), tokenReader: () => null, refreshSession: () async => false, httpClient: client));

void main() {
  test('customer booking history follows supported limit/offset pages', () async {
    final offsets = <String?>[];
    final remote = source(StubClient((request) {
      offsets.add(request.url.queryParameters['offset']);
      final start = int.parse(request.url.queryParameters['offset']!);
      final page = List.generate(start == 0 ? 100 : 1, (index) => {'id': 'b${start + index}', 'bookingNumber': 'HC-${start + index}', 'status': 'COMPLETED', 'price': '20.00', 'currency': 'JOD'});
      return http.Response(jsonEncode({'success': true, 'data': page}), 200);
    }));
    final bookings = await remote.bookings();
    expect(bookings.length, 101);
    expect(offsets, ['0', '100']);
  });

  test('notification history follows supported pages and read endpoint', () async {
    final offsets = <String?>[];
    var readPath = '';
    final remote = source(StubClient((request) {
      if (request.method == 'PATCH') { readPath = request.url.path; return http.Response('{"success":true,"data":{"id":"n1","readAt":"2026-09-21T10:00:00Z"}}', 200); }
      offsets.add(request.url.queryParameters['offset']);
      final start = int.parse(request.url.queryParameters['offset']!);
      final page = List.generate(start == 0 ? 100 : 1, (index) => {'id': 'n${start + index}', 'type': 'BOOKING_CREATED', 'payload': {'title': 'Booking'}});
      return http.Response(jsonEncode({'success': true, 'data': page}), 200);
    }));
    expect((await remote.notifications()).length, 101);
    await remote.readNotification('n1');
    expect(offsets, ['0', '100']);
    expect(readPath, '/api/v1/notifications/n1/read');
  });
}
