import 'dart:math';

class RequestMetadataService {
  RequestMetadataService({Random? random}) : _random = random ?? Random();
  final Random _random;

  String requestId() => '${DateTime.now().microsecondsSinceEpoch}-${_random.nextInt(1 << 32).toRadixString(16)}';
}
