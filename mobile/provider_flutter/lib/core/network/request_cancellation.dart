import 'dart:async';

class RequestCancellationToken {
  final Completer<void> _completer = Completer<void>();

  Future<void> get whenCancelled => _completer.future;
  bool get isCancelled => _completer.isCompleted;

  void cancel() {
    if (!_completer.isCompleted) _completer.complete();
  }
}
