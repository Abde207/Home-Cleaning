import '../../core/storage/session_storage.dart';
import '../../domain/auth/auth_repository.dart';
import '../../domain/auth/auth_session.dart';
import '../../domain/provider/provider_models.dart';
import 'auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required SessionStorage storage,
  }) : _remote = remote,
       _storage = storage;

  final AuthRemoteDataSource _remote;
  final SessionStorage _storage;
  AuthSession? _session;
  Future<bool>? _refreshing;
  Future<void> _storageQueue = Future<void>.value();
  int _sessionEpoch = 0;

  @override
  AuthSession? get session => _session;

  @override
  Future<void> restore() async => _session = await _storage.read();

  @override
  Future<AuthChallenge> requestOtp(String phone) => _remote.requestOtp(phone);

  @override
  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    final next = await _remote.verifyOtp(challengeId: challengeId, code: code);
    await _save(next);
    return next;
  }

  @override
  Future<bool> refreshSession() async {
    if (_refreshing != null) return _refreshing!;
    final pending = _refreshOnce();
    _refreshing = pending;
    try {
      return await pending;
    } finally {
      if (identical(_refreshing, pending)) _refreshing = null;
    }
  }

  Future<bool> _refreshOnce() async {
    final current = _session;
    if (current == null) return false;
    final epoch = _sessionEpoch;
    if (current.refreshExpired) {
      await _clear();
      return false;
    }
    try {
      final next = await _remote.refresh(current.refreshToken);
      if (epoch != _sessionEpoch || !identical(_session, current)) return false;
      await _save(next);
      return true;
    } on Object {
      if (epoch == _sessionEpoch && identical(_session, current)) {
        await _clear();
      }
      return false;
    }
  }

  @override
  Future<void> invalidateSession() => _clear();

  @override
  Future<void> logout() async {
    _sessionEpoch++;
    try {
      if (_session != null) await _remote.logout();
    } on Object {
      // Local logout must complete even when the service is unavailable.
    } finally {
      await _clear();
    }
  }

  @override
  Future<ProviderIdentity> me() => _remote.me();

  Future<void> _save(AuthSession next) async {
    final epoch = ++_sessionEpoch;
    _session = next;
    _storageQueue = _storageQueue.catchError((Object _) {}).then((_) async {
      if (epoch == _sessionEpoch) await _storage.write(next);
    });
    await _storageQueue;
  }

  Future<void> _clear() async {
    ++_sessionEpoch;
    _session = null;
    _storageQueue = _storageQueue
        .catchError((Object _) {})
        .then((_) => _storage.clear());
    await _storageQueue;
  }
}
