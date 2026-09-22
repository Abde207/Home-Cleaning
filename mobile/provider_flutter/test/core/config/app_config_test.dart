import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/core/config/app_config.dart';

void main() {
  test('mobile environment requires a safe API endpoint', () {
    const AppConfig(apiBaseUrl: 'http://10.0.2.2:3001/api/v1').validate();
    const AppConfig(apiBaseUrl: 'https://staging.example.test/api/v1', environment: 'staging').validate();
    expect(() => const AppConfig(apiBaseUrl: '').validate(), throwsStateError);
    expect(() => const AppConfig(apiBaseUrl: 'http://staging.example.test/api/v1', environment: 'staging').validate(), throwsStateError);
    expect(() => const AppConfig(apiBaseUrl: 'https://user:pass@example.test/api/v1').validate(), throwsStateError);
    expect(() => const AppConfig(apiBaseUrl: 'https://example.test/api/v1?key=bad').validate(), throwsStateError);
    expect(() => const AppConfig(apiBaseUrl: 'https://example.test/api/v1', environment: 'unknown').validate(), throwsStateError);
  });
}
