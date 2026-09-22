import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/core/config/app_config.dart';
import 'package:home_clean_customer/core/errors/app_exception.dart';
import 'package:home_clean_customer/core/network/api_client.dart';
import 'package:home_clean_customer/domain/auth/auth_session.dart';
import 'package:http/http.dart' as http;

class StubClient extends http.BaseClient {
  StubClient(this.handler);
  final FutureOr<http.Response> Function(http.BaseRequest request) handler;
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(Stream.value(response.bodyBytes), response.statusCode, headers: response.headers, request: request);
  }
}

AuthSession session(String accessToken) => AuthSession(accessToken: accessToken, refreshToken: 'refresh-token', accessExpiresAt: DateTime.utc(2030), refreshExpiresAt: DateTime.utc(2030));

void main() {
  test('unwraps the backend success envelope and sends auth/idempotency headers', () async {
    late http.BaseRequest request;
    final client = ApiClient(config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'), tokenReader: () => session('access-1'), refreshSession: () async => false, httpClient: StubClient((value) { request = value; return http.Response('{"success":true,"data":{"ok":true},"meta":{"requestId":"r1"}}', 200); }));
    final data = await client.post('/bookings', body: {'serviceId': 's1'}, idempotencyKey: 'command-1');
    expect(data, {'ok': true});
    expect(request.headers['Authorization'], 'Bearer access-1');
    expect(request.headers['Idempotency-Key'], 'command-1');
    expect(request.url.path, '/api/v1/bookings');
  });

  test('refreshes once after 401 and retries with the new access token', () async {
    var calls = 0;
    var current = session('old');
    final client = ApiClient(config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'), tokenReader: () => current, refreshSession: () async { current = session('new'); return true; }, httpClient: StubClient((request) { calls++; final status = calls == 1 ? 401 : 200; return http.Response(status == 200 ? '{"success":true,"data":"ok"}' : '{"success":false,"error":{"code":"AUTH_REQUIRED","message":"expired"}}', status); }));
    expect(await client.get('/auth/me'), 'ok');
    expect(calls, 2);
  });

  test('maps the backend error envelope into a structured exception', () async {
    final client = ApiClient(config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'), tokenReader: () => null, refreshSession: () async => false, httpClient: StubClient((_) => http.Response('{"success":false,"error":{"code":"BOOKING_CONFLICT","message":"Not allowed"},"meta":{"requestId":"req-7"}}', 409)));
    await expectLater(client.post('/bookings'), throwsA(isA<AppException>().having((e) => e.code, 'code', 'BOOKING_CONFLICT').having((e) => e.requestId, 'requestId', 'req-7')));
  });

  test('failed refresh reports authentication expiration to the app', () async {
    var expired = 0;
    final client = ApiClient(config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'), tokenReader: () => session('expired'), refreshSession: () async => false, onAuthExpired: () async { expired++; }, httpClient: StubClient((_) => http.Response('{"success":false,"error":{"code":"AUTH_REQUIRED","message":"expired"}}', 401)));
    await expectLater(client.get('/bookings'), throwsA(isA<AppException>().having((e) => e.kind, 'kind', AppExceptionKind.unauthorized)));
    expect(expired, 1);
  });
}
