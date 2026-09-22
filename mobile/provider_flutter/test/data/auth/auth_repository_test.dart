import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/core/config/app_config.dart';
import 'package:home_clean_provider/core/network/api_client.dart';
import 'package:home_clean_provider/core/storage/session_storage.dart';
import 'package:home_clean_provider/data/auth/auth_remote_data_source.dart';
import 'package:home_clean_provider/data/auth/auth_repository_impl.dart';
import 'package:home_clean_provider/domain/auth/auth_session.dart';
import 'package:http/http.dart' as http;

import '../../helpers/fakes.dart';

class MemorySessionStorage implements SessionStorage {
  AuthSession? value;
  int writes = 0;
  int clears = 0;
  @override
  Future<AuthSession?> read() async => value;
  @override
  Future<void> write(AuthSession session) async {
    value = session;
    writes++;
  }

  @override
  Future<void> clear() async {
    value = null;
    clears++;
  }
}

Map<String, dynamic> tokenJson(String access) => {
  'accessToken': access,
  'refreshToken': 'next-refresh-token-with-enough-characters-1234567890',
  'accessExpiresAt': '2030-01-01T00:00:00Z',
  'refreshExpiresAt': '2030-02-01T00:00:00Z',
  'tokenType': 'Bearer',
};

void main() {
  test(
    'refresh rotation is serialized and securely stores one new session',
    () async {
      var refreshCalls = 0;
      final gate = Completer<void>();
      final storage = MemorySessionStorage()..value = testSession('old-access');
      late AuthRepositoryImpl repository;
      final api = ApiClient(
        config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'),
        tokenReader: () => repository.session,
        refreshSession: () => repository.refreshSession(),
        httpClient: StubClient((request) async {
          if (request.url.path == '/api/v1/auth/refresh') {
            refreshCalls++;
            await gate.future;
            return http.Response(
              jsonEncode({'success': true, 'data': tokenJson('new-access')}),
              200,
            );
          }
          throw StateError(request.url.path);
        }),
      );
      repository = AuthRepositoryImpl(
        remote: AuthRemoteDataSource(api),
        storage: storage,
      );
      await repository.restore();
      final first = repository.refreshSession();
      final second = repository.refreshSession();
      gate.complete();
      expect(await Future.wait([first, second]), [true, true]);
      expect(refreshCalls, 1);
      expect(storage.value?.accessToken, 'new-access');
      expect(storage.writes, 1);
    },
  );

  test(
    'logout calls backend then always clears local secure session',
    () async {
      var logoutCalls = 0;
      final storage = MemorySessionStorage()..value = testSession();
      late AuthRepositoryImpl repository;
      final api = ApiClient(
        config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'),
        tokenReader: () => repository.session,
        refreshSession: () => repository.refreshSession(),
        httpClient: StubClient((request) {
          if (request.url.path == '/api/v1/auth/logout') {
            logoutCalls++;
            return http.Response(
              '{"success":true,"data":{"revoked":true}}',
              200,
            );
          }
          throw StateError(request.url.path);
        }),
      );
      repository = AuthRepositoryImpl(
        remote: AuthRemoteDataSource(api),
        storage: storage,
      );
      await repository.restore();
      await repository.logout();
      expect(logoutCalls, 1);
      expect(repository.session, isNull);
      expect(storage.clears, 1);
    },
  );
}
