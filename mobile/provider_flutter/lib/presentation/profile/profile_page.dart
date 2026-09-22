import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/provider_scaffold.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({
    required this.controller,
    required this.onNavigate,
    super.key,
  });
  final AuthController controller;
  final ValueChanged<AppRoute> onNavigate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final identity = controller.identity!;
    return ProviderScaffold(
      title: l10n.profile,
      route: AppRoute.profile,
      onNavigate: onNavigate,
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          AppCard(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(identity.name ?? identity.phone),
              subtitle: Text(identity.phone),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: l10n.logout,
            icon: Icons.logout,
            onPressed: controller.logout,
          ),
        ],
      ),
    );
  }
}
