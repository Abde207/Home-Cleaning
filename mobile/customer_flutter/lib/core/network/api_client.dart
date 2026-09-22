import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/auth/auth_session.dart';
import '../config/app_config.dart';
import '../errors/app_exception.dart';
import '../services/request_metadata_service.dart';

typedef TokenReader = AuthSession? Function();
typedef RefreshSession = Future<bool> Function();

class ApiClient {
  ApiClient({required AppConfig config, required TokenReader tokenReader, required RefreshSession refreshSession, this.onAuthExpired, http.Client? httpClient, RequestMetadataService? metadataService, this.timeout = const Duration(seconds: 20)})
      : _config = config,
        _tokenReader = tokenReader,
        _refreshSession = refreshSession,
        _httpClient = httpClient ?? http.Client(),
        _metadataService = metadataService ?? RequestMetadataService();

  final AppConfig _config;
  final TokenReader _tokenReader;
  final RefreshSession _refreshSession;
  final Future<void> Function()? onAuthExpired;
  final http.Client _httpClient;
  final Duration timeout;
  final RequestMetadataService _metadataService;

  Future<dynamic> get(String path, {Map<String, String>? query}) => _request('GET', path, query: query);
  Future<dynamic> post(String path, {Object? body, String? idempotencyKey, bool authenticated = true}) => _request('POST', path, body: body, idempotencyKey: idempotencyKey, authenticated: authenticated);
  Future<dynamic> put(String path, {Object? body, String? idempotencyKey}) => _request('PUT', path, body: body, idempotencyKey: idempotencyKey);
  Future<dynamic> patch(String path, {Object? body, String? idempotencyKey}) => _request('PATCH', path, body: body, idempotencyKey: idempotencyKey);
  Future<dynamic> delete(String path) => _request('DELETE', path);

  Future<dynamic> _request(String method, String path, {Object? body, Map<String, String>? query, String? idempotencyKey, bool authenticated = true, bool allowRefresh = true}) async {
    Uri uri;
    try {
      uri = _config.resolve(path).replace(queryParameters: query);
    } on StateError catch (error) {
      throw AppException(kind: AppExceptionKind.configuration, message: error.message);
    }
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Platform': 'flutter-customer',
      'X-Request-ID': _metadataService.requestId(),
    };
    headers.addAll({...?idempotencyKey == null ? null : {'Idempotency-Key': idempotencyKey}});
    final sentSession = authenticated ? _tokenReader() : null;
    if (authenticated) {
      final session = sentSession;
      final authHeaders = switch (session) {
        final value? => {'Authorization': '${value.tokenType} ${value.accessToken}'},
        null => null,
      };
      headers.addAll({...?authHeaders});
    }

    late http.Response response;
    try {
      response = await _send(method, uri, headers, body);
    } on AppException {
      if (method == 'GET') {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        response = await _send(method, uri, headers, body);
      } else {
        rethrow;
      }
    }
    if (response.statusCode == 401 && authenticated && allowRefresh) {
      final latest = _tokenReader();
      if (sentSession != null && latest != null && latest.accessToken != sentSession.accessToken) {
        return _request(method, path, body: body, query: query, idempotencyKey: idempotencyKey, authenticated: authenticated, allowRefresh: false);
      }
      if (latest != null && await _refreshSession()) {
        return _request(method, path, body: body, query: query, idempotencyKey: idempotencyKey, authenticated: authenticated, allowRefresh: false);
      }
      final afterRefresh = _tokenReader();
      if (afterRefresh == null || afterRefresh.accessToken == latest?.accessToken) await onAuthExpired?.call();
      throw const AppException(kind: AppExceptionKind.unauthorized, message: 'Authentication has expired.', statusCode: 401);
    }
    if (response.statusCode == 401 && authenticated && _tokenReader()?.accessToken == sentSession?.accessToken) await onAuthExpired?.call();
    return _decode(response);
  }

  Future<http.Response> _send(String method, Uri uri, Map<String, String> headers, Object? body) async {
    try {
      final request = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) request.body = jsonEncode(body);
      return await _httpClient.send(request).timeout(timeout).then(http.Response.fromStream);
    } on TimeoutException catch (error) {
      throw AppException(kind: AppExceptionKind.timeout, message: 'The request timed out.', cause: error);
    } on http.ClientException catch (error) {
      throw AppException(kind: AppExceptionKind.network, message: 'The network is unavailable.', cause: error);
    } on AppException {
      rethrow;
    } on Object catch (error) {
      throw AppException(kind: AppExceptionKind.network, message: 'The network is unavailable.', cause: error);
    }
  }

  dynamic _decode(http.Response response) {
    Map<String, dynamic> json;
    try {
      json = jsonDecode(response.body) as Map<String, dynamic>;
    } on Object catch (error) {
      throw AppException(kind: AppExceptionKind.serialization, message: 'The server returned an invalid response.', statusCode: response.statusCode, cause: error);
    }
    final meta = json['meta'] is Map<String, dynamic> ? json['meta'] as Map<String, dynamic> : const <String, dynamic>{};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = json['error'] is Map<String, dynamic> ? json['error'] as Map<String, dynamic> : const <String, dynamic>{};
      throw AppException(kind: response.statusCode == 401 ? AppExceptionKind.unauthorized : AppExceptionKind.api, code: error['code'] is String ? error['code'] as String : null, message: 'The request could not be completed.', statusCode: response.statusCode, requestId: meta['requestId'] is String ? meta['requestId'] as String : null);
    }
    if (json['success'] != true || !json.containsKey('data')) throw AppException(kind: AppExceptionKind.serialization, message: 'The server returned an invalid response.', statusCode: response.statusCode);
    return json['data'];
  }

}
