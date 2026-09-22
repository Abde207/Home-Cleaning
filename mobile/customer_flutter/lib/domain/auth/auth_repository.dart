import 'auth_session.dart';

class AuthChallenge {
  const AuthChallenge({required this.challengeId, required this.expiresAt});
  final String challengeId;
  final DateTime expiresAt;
}

abstract interface class AuthRepository {
  AuthSession? get session;
  Future<void> restore();
  Future<AuthChallenge> requestOtp(String phone);
  Future<AuthSession> verifyOtp({required String challengeId, required String code});
  Future<bool> refreshSession();
  Future<void> logout();
  Future<Map<String, dynamic>> me();
}
