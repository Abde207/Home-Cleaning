import '../../core/network/api_client.dart';
import '../../domain/auth/auth_repository.dart';
import '../../domain/auth/auth_session.dart';
import '../../domain/provider/provider_models.dart';

class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._client);
  final ApiClient _client;

  Future<AuthChallenge> requestOtp(String phone) async {
    final data =
        await _client.post(
              '/auth/request-otp',
              body: {'phone': phone},
              authenticated: false,
            )
            as Map<String, dynamic>;
    return AuthChallenge(
      challengeId: data['challengeId'] as String,
      expiresAt: DateTime.parse(data['expiresAt'] as String).toUtc(),
    );
  }

  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    final data =
        await _client.post(
              '/auth/verify-otp',
              body: {'challengeId': challengeId, 'code': code},
              authenticated: false,
            )
            as Map<String, dynamic>;
    return AuthSession.fromJson(data);
  }

  Future<AuthSession> refresh(String refreshToken) async {
    final data =
        await _client.post(
              '/auth/refresh',
              body: {'refreshToken': refreshToken},
              authenticated: false,
            )
            as Map<String, dynamic>;
    return AuthSession.fromJson(data);
  }

  Future<void> logout() => _client.post('/auth/logout');

  Future<ProviderIdentity> me() async {
    final data = await _client.get('/auth/me') as Map<String, dynamic>;
    return ProviderIdentity.fromJson(data);
  }
}
