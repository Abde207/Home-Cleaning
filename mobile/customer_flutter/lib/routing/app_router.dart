import 'package:flutter/material.dart';

import '../application/auth/auth_controller.dart';
import '../application/customer/customer_controller.dart';
import '../application/booking/booking_controller.dart';
import '../presentation/auth/auth_page.dart';
import '../presentation/bootstrap/bootstrap_page.dart';
import '../presentation/home/home_page.dart';
import '../presentation/services/services_page.dart';
import '../presentation/addresses/addresses_page.dart';
import '../presentation/notifications/notifications_page.dart';
import '../presentation/profile/profile_page.dart';
import '../presentation/booking/booking_page.dart';
import '../presentation/booking/booking_history_page.dart';
import '../domain/customer/customer_models.dart';

enum AppRoute {
  bootstrap('/'), auth('/auth'), home('/home'), services('/services'), addresses('/addresses'), booking('/booking'), bookingDetails('/booking/details'), history('/bookings'), notifications('/notifications'), profile('/profile');
  const AppRoute(this.path);
  final String path;
  static AppRoute fromPath(String? path) => values.firstWhere((route) => route.path == path, orElse: () => AppRoute.home);
}

class AppRouteInformationParser extends RouteInformationParser<AppRoute> {
  @override
  Future<AppRoute> parseRouteInformation(RouteInformation routeInformation) async => AppRoute.fromPath(routeInformation.uri.path);
  @override
  RouteInformation restoreRouteInformation(AppRoute configuration) => RouteInformation(uri: Uri.parse(configuration.path));
}

class AppRouter extends RouterDelegate<AppRoute> with ChangeNotifier, PopNavigatorRouterDelegateMixin<AppRoute> {
  AppRouter(this.authController, this.customerController, this.bookingController) { authController.addListener(_authChanged); }
  final AuthController authController;
  final CustomerController customerController;
  final BookingController bookingController;
  AppRoute _route = AppRoute.bootstrap;
  @override
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  AppRoute get route => _route;
  @override
  AppRoute? get currentConfiguration => _route;

  @override
  Widget build(BuildContext context) {
    final auth = authController.status;
    final effective = auth == AuthStatus.bootstrap ? AppRoute.bootstrap : authController.isAuthenticated ? (_route == AppRoute.auth ? AppRoute.home : _route) : AppRoute.auth;
    return Navigator(key: navigatorKey, pages: [MaterialPage(key: ValueKey(effective), child: _page(context, effective))], onDidRemovePage: (_) {});
  }

  Widget _page(BuildContext context, AppRoute route) {
    if (route == AppRoute.bootstrap) return BootstrapPage(controller: authController);
    if (route == AppRoute.auth) return AuthPage(authController: authController);
    if (route == AppRoute.home) return HomePage(authController: authController, customerController: customerController, onNavigate: _navigate, onBookingTap: _openBooking);
    if (route == AppRoute.services) return ServicesPage(controller: customerController, onNavigate: _navigate, onBook: _bookService);
    if (route == AppRoute.addresses) return AddressesPage(controller: customerController, onNavigate: _navigate);
    if (route == AppRoute.notifications) return NotificationsPage(controller: customerController, onNavigate: _navigate, onBookingTap: _openBooking);
    if (route == AppRoute.history) return BookingHistoryPage(controller: customerController, onNavigate: _navigate, onBookingTap: _openBooking);
    if (route == AppRoute.profile) return ProfilePage(controller: customerController, authController: authController, onNavigate: _navigate);
    if (route == AppRoute.booking || route == AppRoute.bookingDetails) return BookingPage(controller: bookingController, onHome: () => _navigate(AppRoute.home));
    return HomePage(authController: authController, customerController: customerController, onNavigate: _navigate, onBookingTap: _openBooking);
  }

  void _navigate(AppRoute next) { _route = next; notifyListeners(); }
  void _bookService(CleaningService service) { if (bookingController.hasUnresolvedCreate) { _navigate(AppRoute.booking); return; } bookingController.newBooking(); bookingController.selectService(service); _navigate(AppRoute.booking); }
  void _openBooking(String id) { bookingController.openDetail(id); _navigate(AppRoute.bookingDetails); }
  void _authChanged() { if (authController.status == AuthStatus.unauthenticated) { bookingController.clearSession(); customerController.clearSession(); _route = AppRoute.auth; } notifyListeners(); }

  @override void dispose() { authController.removeListener(_authChanged); super.dispose(); }

  @override
  Future<void> setNewRoutePath(AppRoute configuration) async { _route = configuration; notifyListeners(); }
}
