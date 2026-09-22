class NetworkLogEntry {
  const NetworkLogEntry({
    required this.method,
    required this.path,
    required this.outcome,
    this.statusCode,
    this.requestId,
  });

  final String method;
  final String path;
  final String outcome;
  final int? statusCode;
  final String? requestId;

  @override
  String toString() =>
      '$method $path $outcome ${statusCode ?? '-'} ${requestId ?? '-'}';
}

abstract interface class SafeLogger {
  void network(NetworkLogEntry entry);
}

class SilentSafeLogger implements SafeLogger {
  const SilentSafeLogger();
  @override
  void network(NetworkLogEntry entry) {}
}
