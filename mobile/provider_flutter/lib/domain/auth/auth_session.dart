class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.accessExpiresAt,
    required this.refreshExpiresAt,
    this.tokenType = 'Bearer',
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    accessExpiresAt: DateTime.parse(json['accessExpiresAt'] as String).toUtc(),
    refreshExpiresAt: DateTime.parse(
      json['refreshExpiresAt'] as String,
    ).toUtc(),
    tokenType: json['tokenType'] as String? ?? 'Bearer',
  );

  final String accessToken;
  final String refreshToken;
  final DateTime accessExpiresAt;
  final DateTime refreshExpiresAt;
  final String tokenType;

  bool get refreshExpired => !refreshExpiresAt.isAfter(DateTime.now().toUtc());

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'accessExpiresAt': accessExpiresAt.toIso8601String(),
    'refreshExpiresAt': refreshExpiresAt.toIso8601String(),
    'tokenType': tokenType,
  };
}
