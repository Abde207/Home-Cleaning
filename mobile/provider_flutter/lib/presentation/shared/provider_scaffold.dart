import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../routing/app_router.dart';

class ProviderScaffold extends StatelessWidget {
  const ProviderScaffold({
    required this.title,
    required this.route,
    required this.onNavigate,
    required this.body,
    this.actions,
    super.key,
  });
  final String title;
  final AppRoute route;
  final ValueChanged<AppRoute> onNavigate;
  final Widget body;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    const routes = [
      AppRoute.home,
      AppRoute.assignments,
      AppRoute.team,
      AppRoute.notifications,
      AppRoute.profile,
    ];
    final index = routes.indexOf(route);
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index < 0 ? 0 : index,
        onDestinationSelected: (value) => onNavigate(routes[value]),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.dashboard_outlined),
            label: l10n.home,
          ),
          NavigationDestination(
            icon: const Icon(Icons.assignment_outlined),
            label: l10n.assignments,
          ),
          NavigationDestination(
            icon: const Icon(Icons.groups_outlined),
            label: l10n.team,
          ),
          NavigationDestination(
            icon: const Icon(Icons.notifications_outlined),
            label: l10n.notifications,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            label: l10n.profile,
          ),
        ],
      ),
    );
  }
}
