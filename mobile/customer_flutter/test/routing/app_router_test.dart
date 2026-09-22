import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:home_clean_customer/routing/app_router.dart';

void main() {
  test('parses all foundation route paths', () async {
    final parser = AppRouteInformationParser();
    expect((await parser.parseRouteInformation(RouteInformation(uri: Uri.parse('/addresses')))), AppRoute.addresses);
    expect((await parser.parseRouteInformation(RouteInformation(uri: Uri.parse('/booking/details')))), AppRoute.bookingDetails);
    expect(parser.restoreRouteInformation(AppRoute.notifications).uri.path, '/notifications');
  });
}
