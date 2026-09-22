class AppConfig {
  const AppConfig({required this.apiBaseUrl, this.environment = 'development'});

  factory AppConfig.fromEnvironment() => const AppConfig(
        apiBaseUrl: String.fromEnvironment('API_BASE_URL'),
        environment: String.fromEnvironment('APP_ENVIRONMENT', defaultValue: 'development'),
      );

  final String apiBaseUrl;
  final String environment;

  bool get hasApiBaseUrl => apiBaseUrl.trim().isNotEmpty;

  void validate() {
    if (!const {'development', 'test', 'staging', 'production'}.contains(environment)) {
      throw StateError('APP_ENVIRONMENT must be development, test, staging, or production.');
    }
    final uri = Uri.tryParse(apiBaseUrl);
    if (uri == null || !uri.hasAuthority || !{'http', 'https'}.contains(uri.scheme) ||
        uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment ||
        uri.path.replaceFirst(RegExp(r'/$'), '') != '/api/v1') {
      throw StateError('API_BASE_URL must be an absolute HTTP(S) URL ending in /api/v1 without credentials, query, or fragment.');
    }
    if ((environment == 'staging' || environment == 'production') && uri.scheme != 'https') {
      throw StateError('API_BASE_URL must use HTTPS in staging and production.');
    }
  }

  Uri resolve(String path) {
    if (!hasApiBaseUrl) {
      throw StateError('API_BASE_URL is not configured. Run Flutter with --dart-define=API_BASE_URL=...');
    }
    validate();
    final base = apiBaseUrl.endsWith('/') ? apiBaseUrl : '$apiBaseUrl/';
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return Uri.parse(base).resolve(cleanPath);
  }
}
