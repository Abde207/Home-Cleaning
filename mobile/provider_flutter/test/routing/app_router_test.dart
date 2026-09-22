import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/application/auth/auth_controller.dart';
import 'package:home_clean_provider/routing/app_router.dart';
import 'package:home_clean_provider/application/provider/provider_operations_controller.dart';
import 'package:home_clean_provider/application/provider/provider_management_controller.dart';

import '../helpers/fakes.dart';

void main() {
  test('parses every prepared provider route', () async {
    final parser = AppRouteInformationParser();
    for (final route in AppRoute.values) {
      expect(
        await parser.parseRouteInformation(
          RouteInformation(uri: Uri.parse(route.path)),
        ),
        route,
      );
      expect(parser.restoreRouteInformation(route).uri.path, route.path);
    }
  });

  test('bootstrap state always guards requested provider routes', () {
    final controller = AuthController(
      FakeAuthRepository(),
      FakeProviderRepository(),
    );
    final router = AppRouter(
      controller,
      ProviderOperationsController(FakeProviderRepository()),
      ProviderManagementController(FakeProviderRepository()),
    )..navigate(AppRoute.assignments);
    expect(router.effectiveRoute, AppRoute.bootstrap);
    router.dispose();
  });

  test('unauthenticated state guards provider routes with authentication', () {
    final controller = AuthController(
      FakeAuthRepository(),
      FakeProviderRepository(),
    )..status = AuthStatus.unauthenticated;
    final router = AppRouter(
      controller,
      ProviderOperationsController(FakeProviderRepository()),
      ProviderManagementController(FakeProviderRepository()),
    )..navigate(AppRoute.financials);
    expect(router.effectiveRoute, AppRoute.auth);
    router.dispose();
  });

  test('unauthorized role is forced to access denied', () {
    final controller = AuthController(
      FakeAuthRepository(),
      FakeProviderRepository(),
    )..status = AuthStatus.unauthorized;
    final router = AppRouter(
      controller,
      ProviderOperationsController(FakeProviderRepository()),
      ProviderManagementController(FakeProviderRepository()),
    )..navigate(AppRoute.team);
    expect(router.effectiveRoute, AppRoute.accessDenied);
    router.dispose();
  });

  test('authenticated provider may enter a prepared provider route', () {
    final controller = AuthController(
      FakeAuthRepository(),
      FakeProviderRepository(),
    )..status = AuthStatus.authenticated;
    final router = AppRouter(
      controller,
      ProviderOperationsController(FakeProviderRepository()),
      ProviderManagementController(FakeProviderRepository()),
    )..navigate(AppRoute.assignments);
    expect(router.effectiveRoute, AppRoute.assignments);
    router.dispose();
  });
}
