import 'package:flutter/material.dart';

import '../localization/app_localizations.dart';
import '../theme/app_theme.dart';

class AppButton extends StatelessWidget {
  const AppButton({required this.label, required this.onPressed, this.busy = false, super.key});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  @override
  Widget build(BuildContext context) => SizedBox(width: double.infinity, child: FilledButton(onPressed: busy ? null : onPressed, child: busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(label)));
}

class AppCard extends StatelessWidget {
  const AppCard({required this.child, super.key});
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(margin: EdgeInsets.zero, child: Padding(padding: const EdgeInsets.all(AppSpacing.md), child: child));
}

class AppLoadingView extends StatelessWidget {
  const AppLoadingView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}

class AppErrorView extends StatelessWidget {
  const AppErrorView({required this.message, this.onRetry, super.key});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) { final l10n = AppLocalizations.of(context); return Center(child: Padding(padding: const EdgeInsets.all(AppSpacing.lg), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.error_outline, size: 48), const SizedBox(height: AppSpacing.md), Text(l10n.errorTitle, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: AppSpacing.sm), Text(message, textAlign: TextAlign.center), if (onRetry != null) ...[const SizedBox(height: AppSpacing.md), OutlinedButton(onPressed: onRetry, child: Text(l10n.retry))]]))); }
}

class AppEmptyView extends StatelessWidget {
  const AppEmptyView({this.message, super.key});
  final String? message;
  @override
  Widget build(BuildContext context) => Center(child: Text(message ?? AppLocalizations.of(context).emptyTitle));
}
