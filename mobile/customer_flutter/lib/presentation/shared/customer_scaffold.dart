import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../routing/app_router.dart';

class CustomerScaffold extends StatelessWidget {
  const CustomerScaffold({required this.title, required this.body, required this.currentRoute, required this.onNavigate, this.actions = const [], super.key});
  final String title;
  final Widget body;
  final AppRoute currentRoute;
  final ValueChanged<AppRoute> onNavigate;
  final List<Widget> actions;

  int get _index => switch (currentRoute) { AppRoute.home => 0, AppRoute.services => 1, AppRoute.addresses => 2, AppRoute.profile => 3, _ => 0 };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final destinations = <(AppRoute, String, IconData)>[(AppRoute.home, l10n.home, Icons.home_outlined), (AppRoute.services, l10n.services, Icons.cleaning_services_outlined), (AppRoute.addresses, l10n.addresses, Icons.location_on_outlined), (AppRoute.profile, l10n.profile, Icons.person_outline)];
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: body,
      bottomNavigationBar: NavigationBar(selectedIndex: _index, onDestinationSelected: (index) => onNavigate(destinations[index].$1), destinations: [for (final item in destinations) NavigationDestination(icon: Icon(item.$3), label: item.$2)]),
      backgroundColor: AppTheme.surface,
    );
  }
}
