import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import 'provider_scaffold.dart';

class PlaceholderPage extends StatelessWidget {
  const PlaceholderPage({
    required this.route,
    required this.title,
    required this.onNavigate,
    this.icon = Icons.construction_outlined,
    super.key,
  });
  final AppRoute route;
  final String title;
  final ValueChanged<AppRoute> onNavigate;
  final IconData icon;

  @override
  Widget build(BuildContext context) => ProviderScaffold(
    title: title,
    route: route,
    onNavigate: onNavigate,
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: AppCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48),
              const SizedBox(height: AppSpacing.md),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: AppSpacing.sm),
              Text(
                AppLocalizations.of(context).comingLater,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
