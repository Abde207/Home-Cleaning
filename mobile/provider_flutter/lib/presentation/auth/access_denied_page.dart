import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';

class AccessDeniedPage extends StatelessWidget {
  const AccessDeniedPage({required this.controller, super.key});
  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_person_outlined, size: 64),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    l10n.accessDeniedTitle,
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(l10n.accessDeniedBody, textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: l10n.logout,
                    icon: Icons.logout,
                    onPressed: controller.logout,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
