import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/notifications/device_registration_controller.dart';
import 'package:home_clean_customer/core/errors/app_exception.dart';

class DeviceRepo implements DeviceRegistrationRepository {
  String? id;
  int registered = 0, unregistered = 0;
  bool fail = false;
  @override Future<String> register({required String token, required String platform}) async { if (fail) throw const AppException(kind: AppExceptionKind.api, code: 'DEVICE_TOKEN_OWNED_BY_OTHER_USER', message: 'Owned by another user'); registered++; return 'device-$registered'; }
  @override Future<void> unregister(String id) async { unregistered++; }
  @override Future<String?> storedId() async => id;
  @override Future<void> storeId(String? id) async { this.id = id; }
}

void main() {
  const token = 'real-platform-token-1234567890';
  test('no token source leaves registration unavailable', () {
    final repo = DeviceRepo(); final controller = DeviceRegistrationController(repo);
    expect(controller.state, DeviceRegistrationState.unavailable);
    expect(repo.registered, 0);
  });
  test('real token registration persists ID and logout invalidates owned registration', () async {
    final repo = DeviceRepo(); final controller = DeviceRegistrationController(repo);
    await controller.tokenAvailable(token: token, platform: 'android');
    expect(controller.state, DeviceRegistrationState.registered); expect(repo.id, 'device-1');
    await controller.unregister();
    expect(repo.unregistered, 1); expect(repo.id, isNull);
    expect(controller.state, DeviceRegistrationState.unavailable);
  });
  test('token rotation invalidates the previous registration', () async {
    final repo = DeviceRepo(); final controller = DeviceRegistrationController(repo);
    await controller.tokenAvailable(token: token, platform: 'android');
    await controller.tokenAvailable(token: '${token}new', platform: 'android');
    expect(repo.id, 'device-2'); expect(repo.unregistered, 1);
  });
  test('foreign token conflict and invalid token do not report registration', () async {
    final repo = DeviceRepo()..fail = true; final controller = DeviceRegistrationController(repo);
    await controller.tokenAvailable(token: token, platform: 'android');
    expect(controller.state, DeviceRegistrationState.failed);
    expect(controller.error?.code, 'DEVICE_TOKEN_OWNED_BY_OTHER_USER');
    await controller.tokenAvailable(token: 'short', platform: 'android');
    expect(repo.registered, 0); expect(controller.state, DeviceRegistrationState.failed);
  });
}
