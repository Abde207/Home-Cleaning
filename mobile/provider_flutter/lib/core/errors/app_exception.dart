enum AppExceptionKind {
  configuration,
  network,
  timeout,
  cancelled,
  validation,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  server,
  serialization,
  api,
}

class AppException implements Exception {
  const AppException({
    required this.kind,
    required this.message,
    this.code,
    this.statusCode,
    this.requestId,
    this.cause,
  });

  final AppExceptionKind kind;
  final String message;
  final String? code;
  final int? statusCode;
  final String? requestId;
  final Object? cause;

  bool get isOffline =>
      kind == AppExceptionKind.network || kind == AppExceptionKind.timeout;

  @override
  String toString() => 'AppException($kind, $code, status: $statusCode)';
}
