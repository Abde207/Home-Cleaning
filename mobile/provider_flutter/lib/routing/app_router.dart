import 'package:flutter/material.dart';

import '../application/auth/auth_controller.dart';
import '../application/provider/provider_operations_controller.dart';
import '../application/provider/provider_management_controller.dart';
import '../presentation/auth/access_denied_page.dart';
import '../presentation/auth/auth_page.dart';
import '../presentation/bootstrap/bootstrap_page.dart';
import '../presentation/home/home_page.dart';
import '../presentation/assignments/assignment_detail_page.dart';
import '../presentation/assignments/assignment_inbox_page.dart';
import '../presentation/notifications/notifications_page.dart';
import '../presentation/profile/profile_page.dart';
import '../presentation/financials/financials_page.dart';
import '../presentation/team/team_context_page.dart';
import '../domain/provider/provider_models.dart';

enum AppRoute {
  bootstrap('/'),
  auth('/auth'),
  accessDenied('/access-denied'),
  home('/home'),
  assignments('/assignments'),
  assignmentDetails('/assignments/details'),
  activeJob('/active-job'),
  team('/team'),
  notifications('/notifications'),
  profile('/profile'),
  financials('/financials');

  const AppRoute(this.path);
  final String path;

  static AppRoute fromPath(String? path) => values.firstWhere(
    (route) => route.path == path,
    orElse: () => AppRoute.home,
  );
}

class AppRouteInformationParser extends RouteInformationParser<AppRoute> {
  @override
  Future<AppRoute> parseRouteInformation(
    RouteInformation routeInformation,
  ) async => AppRoute.fromPath(routeInformation.uri.path);

  @override
  RouteInformation restoreRouteInformation(AppRoute configuration) =>
      RouteInformation(uri: Uri.parse(configuration.path));
}

class AppRouter extends RouterDelegate<AppRoute>
    with ChangeNotifier, PopNavigatorRouterDelegateMixin<AppRoute> {
  AppRouter(this.controller, this.operations, this.management) {
    controller.addListener(_authChanged);
  }

  final AuthController controller;
  final ProviderOperationsController operations;
  final ProviderManagementController management;
  AppRoute _route = AppRoute.bootstrap;
  String? _assignmentId;

  @override
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  AppRoute get route => _route;
  AppRoute get effectiveRoute {
    return switch (controller.status) {
      AuthStatus.bootstrap ||
      AuthStatus.loadingScope ||
      AuthStatus.recoverableFailure => AppRoute.bootstrap,
      AuthStatus.unauthenticated || AuthStatus.authenticating => AppRoute.auth,
      AuthStatus.unauthorized => AppRoute.accessDenied,
      AuthStatus.authenticated =>
        _route == AppRoute.bootstrap ||
                _route == AppRoute.auth ||
                _route == AppRoute.accessDenied
            ? AppRoute.home
            : _route,
    };
  }

  @override
  AppRoute? get currentConfiguration => effectiveRoute;

  @override
  Widget build(BuildContext context) {
    final effective = effectiveRoute;
    return Navigator(
      key: navigatorKey,
      pages: [
        MaterialPage(
          key: ValueKey('$effective:${_assignmentId ?? ''}'),
          child: _page(context, effective),
        ),
      ],
      onDidRemovePage: (_) {},
    );
  }

  Widget _page(BuildContext context, AppRoute route) {
    return switch (route) {
      AppRoute.bootstrap => BootstrapPage(controller: controller),
      AppRoute.auth => AuthPage(controller: controller),
      AppRoute.accessDenied => AccessDeniedPage(controller: controller),
      AppRoute.home => HomePage(
        auth: controller,
        operations: operations,
        onNavigate: navigate,
        onOpenAssignment: openAssignment,
      ),
      AppRoute.profile => ProfilePage(
        controller: controller,
        onNavigate: navigate,
      ),
      AppRoute.assignments => AssignmentInboxPage(
        controller: operations,
        onNavigate: navigate,
        onOpenAssignment: openAssignment,
      ),
      AppRoute.assignmentDetails =>
        _assignmentId == null
            ? AssignmentInboxPage(
                controller: operations,
                onNavigate: navigate,
                onOpenAssignment: openAssignment,
              )
            : AssignmentDetailPage(
                assignmentId: _assignmentId!,
                controller: operations,
                onNavigate: navigate,
                onOpenActiveJob: openActiveJob,
              ),
      AppRoute.activeJob => _assignmentId == null
          ? AssignmentInboxPage(
              controller: operations,
              onNavigate: navigate,
              onOpenAssignment: openActiveJob,
              initialView: AssignmentView.active,
            )
          : AssignmentDetailPage(
              assignmentId: _assignmentId!,
              controller: operations,
              onNavigate: navigate,
              onOpenActiveJob: openActiveJob,
              activeJob: true,
            ),
      AppRoute.team => TeamContextPage(
        auth: controller,
        controller: management,
        onNavigate: navigate,
      ),
      AppRoute.notifications => NotificationsPage(
        controller: operations,
        onNavigate: navigate,
        onOpenAssignment: openAssignment,
      ),
      AppRoute.financials => FinancialsPage(
        controller: management,
        onNavigate: navigate,
      ),
    };
  }

  void navigate(AppRoute next) {
    if (next != AppRoute.assignmentDetails) _assignmentId = null;
    _route = next;
    notifyListeners();
  }

  void openAssignment(String id) {
    _assignmentId = id;
    _route = AppRoute.assignmentDetails;
    notifyListeners();
  }

  void openActiveJob(String id) {
    _assignmentId = id;
    _route = AppRoute.activeJob;
    notifyListeners();
  }

  void _authChanged() {
    if (controller.status == AuthStatus.unauthenticated) {
      operations.clear();
      management.clear();
      _route = AppRoute.auth;
    } else if (controller.status == AuthStatus.unauthorized) {
      operations.clear();
      management.clear();
      _route = AppRoute.accessDenied;
    }
    notifyListeners();
  }

  @override
  Future<void> setNewRoutePath(AppRoute configuration) async {
    _route = configuration;
    notifyListeners();
  }

  @override
  void dispose() {
    controller.removeListener(_authChanged);
    super.dispose();
  }
}
