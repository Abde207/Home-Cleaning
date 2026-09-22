import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/auth/auth_session.dart';
import '../config/app_config.dart';
import '../errors/app_exception.dart';
import '../logging/safe_logger.dart';
import '../services/request_metadata_service.dart';
import 'request_cancellation.dart';

typedef TokenReader = AuthSession? Function();
typedef RefreshSession = Future<bool> Function();

class ApiClient {
  ApiClient({
    required AppConfig config,
    required TokenReader tokenReader,
    required RefreshSession refreshSession,
    this.onAuthExpired,
    http.Client? httpClient,
    RequestMetadataService? metadataService,
    SafeLogger logger = const SilentSafeLogger(),
    this.timeout = const Duration(seconds: 20),
  }) : _config = config,
       _tokenReader = tokenReader,
       _refreshSession = refreshSession,
       _httpClient = httpClient ?? http.Client(),
       _metadataService = metadataService ?? RequestMetadataService(),
       _logger = logger;

  final AppConfig _config;
  final TokenReader _tokenReader;
  final RefreshSession _refreshSession;
  final Future<void> Function()? onAuthExpired;
  final http.Client _httpClient;
  final RequestMetadataService _metadataService;
  final SafeLogger _logger;
  final Duration timeout;

  Future<dynamic> get(
    String path, {
    Map<String, String>? query,
    RequestCancellationToken? cancellation,
  }) => _request('GET', path, query: query, cancellation: cancellation);

  Future<dynamic> post(
    String path, {
    Object? body,
    String? idempotencyKey,
    bool authenticated = true,
    RequestCancellationToken? cancellation,
  }) => _request(
    'POST',
    path,
    body: body,
    idempotencyKey: idempotencyKey,
    authenticated: authenticated,
    cancellation: cancellation,
  );

  Future<dynamic> put(
    String path, {
    Object? body,
    String? idempotencyKey,
    RequestCancellationToken? cancellation,
  }) => _request(
    'PUT',
    path,
    body: body,
    idempotencyKey: idempotencyKey,
    cancellation: cancellation,
  );

  Future<dynamic> patch(
    String path, {
    Object? body,
    String? idempotencyKey,
    RequestCancellationToken? cancellation,
  }) => _request(
    'PATCH',
    path,
    body: body,
    idempotencyKey: idempotencyKey,
    cancellation: cancellation,
  );

  Future<dynamic> delete(
    String path, {
    RequestCancellationToken? cancellation,
  }) => _request('DELETE', path, cancellation: cancellation);

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
    String? idempotencyKey,
    bool authenticated = true,
    bool allowRefresh = true,
    RequestCancellationToken? cancellation,
  }) async {
    late final Uri uri;
    try {
      uri = _config.resolve(path, query);
    } on StateError catch (error) {
      throw AppException(
        kind: AppExceptionKind.configuration,
        message: error.message,
      );
    }

    final requestId = _metadataService.requestId();
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Platform': 'flutter-provider',
      'X-Request-ID': requestId,
      'Idempotency-Key': ?idempotencyKey,
    };
    final sentSession = authenticated ? _tokenReader() : null;
    if (authenticated && sentSession != null) {
      headers['Authorization'] =
          '${sentSession.tokenType} ${sentSession.accessToken}';
    }

    late http.Response response;
    try {
      response = await _send(method, uri, headers, body, cancellation);
    } on AppException catch (error) {
      if (method != 'GET' || error.kind == AppExceptionKind.cancelled) rethrow;
      response = await _send(method, uri, headers, body, cancellation);
    }

    if (response.statusCode == 401 && authenticated && allowRefresh) {
      final latest = _tokenReader();
      if (sentSession != null &&
          latest != null &&
          latest.accessToken != sentSession.accessToken) {
        return _request(
          method,
          path,
          body: body,
          query: query,
          idempotencyKey: idempotencyKey,
          authenticated: true,
          allowRefresh: false,
          cancellation: cancellation,
        );
      }
      if (latest != null && await _refreshSession()) {
        return _request(
          method,
          path,
          body: body,
          query: query,
          idempotencyKey: idempotencyKey,
          authenticated: true,
          allowRefresh: false,
          cancellation: cancellation,
        );
      }
      await onAuthExpired?.call();
      throw const AppException(
        kind: AppExceptionKind.unauthorized,
        message: 'Authentication has expired.',
        statusCode: 401,
      );
    }

    if (response.statusCode == 401 &&
        authenticated &&
        _tokenReader()?.accessToken == sentSession?.accessToken) {
      await onAuthExpired?.call();
    }
    return _decode(method, path, requestId, response);
  }

  Future<http.Response> _send(
    String method,
    Uri uri,
    Map<String, String> headers,
    Object? body,
    RequestCancellationToken? cancellation,
  ) async {
    try {
      final request = http.AbortableRequest(
        method,
        uri,
        abortTrigger: cancellation?.whenCancelled,
      )..headers.addAll(headers);
      if (body != null) request.body = jsonEncode(body);
      return await _httpClient
          .send(request)
          .timeout(timeout)
          .then(http.Response.fromStream);
    } on TimeoutException catch (error) {
      throw AppException(
        kind: AppExceptionKind.timeout,
        message: 'The request timed out.',
        cause: error,
      );
    } on http.RequestAbortedException catch (error) {
      throw AppException(
        kind: AppExceptionKind.cancelled,
        message: 'The request was cancelled.',
        cause: error,
      );
    } on http.ClientException catch (error) {
      throw AppException(
        kind: AppExceptionKind.network,
        message: 'The network is unavailable.',
        cause: error,
      );
    } on AppException {
      rethrow;
    } on Object catch (error) {
      throw AppException(
        kind: AppExceptionKind.network,
        message: 'The network is unavailable.',
        cause: error,
      );
    }
  }

  dynamic _decode(
    String method,
    String path,
    String requestId,
    http.Response response,
  ) {
    late final Map<String, dynamic> json;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) throw const FormatException();
      json = decoded;
    } on Object catch (error) {
      _logger.network(
        NetworkLogEntry(
          method: method,
          path: path,
          outcome: 'malformed-response',
          statusCode: response.statusCode,
          requestId: requestId,
        ),
      );
      throw AppException(
        kind: AppExceptionKind.serialization,
        message: 'The server returned an invalid response.',
        statusCode: response.statusCode,
        cause: error,
      );
    }

    final meta = json['meta'] is Map<String, dynamic>
        ? json['meta'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final responseRequestId = meta['requestId'] is String
        ? meta['requestId'] as String
        : requestId;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = json['error'] is Map<String, dynamic>
          ? json['error'] as Map<String, dynamic>
          : const <String, dynamic>{};
      final kind = switch (response.statusCode) {
        400 || 413 || 422 => AppExceptionKind.validation,
        401 => AppExceptionKind.unauthorized,
        403 => AppExceptionKind.forbidden,
        404 => AppExceptionKind.notFound,
        409 => AppExceptionKind.conflict,
        >= 500 => AppExceptionKind.server,
        _ => AppExceptionKind.api,
      };
      _logger.network(
        NetworkLogEntry(
          method: method,
          path: path,
          outcome: 'api-error',
          statusCode: response.statusCode,
          requestId: responseRequestId,
        ),
      );
      throw AppException(
        kind: kind,
        code: error['code'] is String ? error['code'] as String : null,
        message: 'The request could not be completed.',
        statusCode: response.statusCode,
        requestId: responseRequestId,
      );
    }
    if (json['success'] != true || !json.containsKey('data')) {
      throw AppException(
        kind: AppExceptionKind.serialization,
        message: 'The server returned an invalid response.',
        statusCode: response.statusCode,
      );
    }
    _logger.network(
      NetworkLogEntry(
        method: method,
        path: path,
        outcome: 'success',
        statusCode: response.statusCode,
        requestId: responseRequestId,
      ),
    );
    return json['data'];
  }

  void close() => _httpClient.close();
}
