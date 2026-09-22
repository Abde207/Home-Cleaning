import 'dart:math';

class RequestMetadataService {
  RequestMetadataService({Random? random})
    : _random = random ?? Random.secure();
  final Random _random;

  String requestId() {
    final timestamp = DateTime.now().toUtc().microsecondsSinceEpoch;
    final suffix = _random.nextInt(0x7fffffff).toRadixString(16);
    return 'provider-$timestamp-$suffix';
  }

  String idempotencyKey(String operation) {
    final safe = operation.replaceAll(RegExp(r'[^A-Za-z0-9._:-]'), '-');
    return '$safe-${requestId()}';
  }
}
