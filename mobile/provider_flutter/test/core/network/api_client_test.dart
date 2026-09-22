import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/core/config/app_config.dart';
import 'package:home_clean_provider/core/errors/app_exception.dart';
import 'package:home_clean_provider/core/logging/safe_logger.dart';
import 'package:home_clean_provider/core/network/api_client.dart';
import 'package:http/http.dart' as http;

import '../../helpers/fakes.dart';

class CapturingLogger implements SafeLogger {
  final entries = <NetworkLogEntry>[];
  @override
  void network(NetworkLogEntry entry) => entries.add(entry);
}

ApiClient clientWith(
  StubClient transport, {
  String access = 'secret-access-token',
  Future<bool> Function()? refresh,
  SafeLogger logger = const SilentSafeLogger(),
  Future<void> Function()? onExpired,
}) => ApiClient(
  config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'),
  tokenReader: () => testSession(access),
  refreshSession: refresh ?? () async => false,
  httpClient: transport,
  logger: logger,
  onAuthExpired: onExpired,
);

void main() {
  test(
    'serializes JSON and sends provider auth, request and idempotency headers',
    () async {
      late http.BaseRequest sent;
      final client = clientWith(
        StubClient((request) {
          sent = request;
          return http.Response('{"success":true,"data":{"ok":true}}', 200);
        }),
      );
      final data = await client.post(
        '/assignments/a1/accept',
        body: {'value': 1},
        idempotencyKey: 'accept-1',
      );
      expect(data, {'ok': true});
      expect(sent.headers['Authorization'], 'Bearer secret-access-token');
      expect(sent.headers['Idempotency-Key'], 'accept-1');
      expect(sent.headers['X-Client-Platform'], 'flutter-provider');
      expect(jsonDecode((sent as http.Request).body), {'value': 1});
    },
  );

  test('retries a safe GET once after a transport failure', () async {
    var calls = 0;
    final client = clientWith(
      StubClient((_) {
        calls++;
        if (calls == 1) throw http.ClientException('offline');
        return http.Response('{"success":true,"data":[]}', 200);
      }),
    );
    expect(await client.get('/provider/teams'), isEmpty);
    expect(calls, 2);
  });

  test(
    'does not automatically retry commands after a transport failure',
    () async {
      var calls = 0;
      final client = clientWith(
        StubClient((_) {
          calls++;
          throw http.ClientException('offline');
        }),
      );
      await expectLater(
        client.post('/assignments/a1/accept'),
        throwsA(isA<AppException>()),
      );
      expect(calls, 1);
    },
  );

  test('refreshes once after 401 and retries with the new session', () async {
    var calls = 0;
    var access = 'old-access';
    final transport = StubClient((request) {
      calls++;
      if (calls == 1) {
        return http.Response(
          '{"success":false,"error":{"code":"AUTH_REQUIRED"}}',
          401,
        );
      }
      expect(request.headers['Authorization'], 'Bearer new-access');
      return http.Response('{"success":true,"data":{"id":"u1"}}', 200);
    });
    final client = ApiClient(
      config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'),
      tokenReader: () => testSession(access),
      refreshSession: () async {
        access = 'new-access';
        return true;
      },
      httpClient: transport,
    );
    expect(await client.get('/auth/me'), {'id': 'u1'});
    expect(calls, 2);
  });

  test('failed refresh invokes unauthorized handling', () async {
    var expired = 0;
    final client = clientWith(
      StubClient(
        (_) => http.Response(
          '{"success":false,"error":{"code":"AUTH_REQUIRED"}}',
          401,
        ),
      ),
      onExpired: () async => expired++,
    );
    await expectLater(
      client.get('/auth/me'),
      throwsA(
        isA<AppException>().having(
          (error) => error.kind,
          'kind',
          AppExceptionKind.unauthorized,
        ),
      ),
    );
    expect(expired, 1);
  });

  test('maps 403, 404 and 409 to operational error kinds', () async {
    for (final entry in {
      403: AppExceptionKind.forbidden,
      404: AppExceptionKind.notFound,
      409: AppExceptionKind.conflict,
    }.entries) {
      final client = clientWith(
        StubClient(
          (_) => http.Response(
            '{"success":false,"error":{"code":"E"},"meta":{"requestId":"r1"}}',
            entry.key,
          ),
        ),
      );
      await expectLater(
        client.post('/command'),
        throwsA(
          isA<AppException>()
              .having((error) => error.kind, 'kind', entry.value)
              .having((error) => error.requestId, 'requestId', 'r1'),
        ),
      );
    }
  });

  test(
    'maps validation and server responses without exposing server messages',
    () async {
      final validation = clientWith(
        StubClient(
          (_) => http.Response(
            '{"success":false,"error":{"code":"VALIDATION_INVALID_INPUT","message":"database detail"}}',
            400,
          ),
        ),
      );
      await expectLater(
        validation.post('/command'),
        throwsA(
          isA<AppException>()
              .having(
                (error) => error.kind,
                'kind',
                AppExceptionKind.validation,
              )
              .having(
                (error) => error.message,
                'message',
                isNot(contains('database detail')),
              ),
        ),
      );

      final server = clientWith(
        StubClient(
          (_) => http.Response(
            '{"success":false,"error":{"code":"SYSTEM_ERROR"}}',
            500,
          ),
        ),
      );
      await expectLater(
        server.get('/provider/teams'),
        throwsA(
          isA<AppException>().having(
            (error) => error.kind,
            'kind',
            AppExceptionKind.server,
          ),
        ),
      );
    },
  );

  test('rejects malformed success envelopes', () async {
    final client = clientWith(
      StubClient((_) => http.Response('{"unexpected":true}', 200)),
    );
    await expectLater(
      client.get('/provider/teams'),
      throwsA(
        isA<AppException>().having(
          (error) => error.kind,
          'kind',
          AppExceptionKind.serialization,
        ),
      ),
    );
  });

  test(
    'safe network logs never contain tokens, OTPs or request bodies',
    () async {
      final logger = CapturingLogger();
      final client = clientWith(
        StubClient((_) => http.Response('{"success":true,"data":true}', 200)),
        logger: logger,
      );
      await client.post(
        '/auth/verify-otp',
        authenticated: false,
        body: {'code': '123456', 'password': 'never-log'},
      );
      final logs = logger.entries.join('\n');
      expect(logs, isNot(contains('secret-access-token')));
      expect(logs, isNot(contains('123456')));
      expect(logs, isNot(contains('never-log')));
    },
  );
}
