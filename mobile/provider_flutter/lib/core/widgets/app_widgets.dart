import 'package:flutter/material.dart';

import '../localization/app_localizations.dart';
import '../theme/app_theme.dart';

class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.icon,
    super.key,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton.icon(
      onPressed: busy ? null : onPressed,
      icon: busy
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon ?? Icons.arrow_forward),
      label: Text(label),
    ),
  );
}

class AppCard extends StatelessWidget {
  const AppCard({required this.child, this.color, super.key});
  final Widget child;
  final Color? color;
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    color: color,
    child: Padding(padding: const EdgeInsets.all(AppSpacing.md), child: child),
  );
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({required this.status, super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'AVAILABLE' || 'ACCEPTED' || 'COMPLETED' || 'PAID' => Colors.green,
      'BUSY' || 'OFFERED' || 'PARTIALLY_PAID' => Colors.orange,
      'REJECTED' || 'CANCELLED' || 'EXPIRED' => Colors.red,
      _ => Colors.blueGrey,
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(
          AppLocalizations.of(context).statusLabel(status),
          style: TextStyle(color: color.shade700, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class AppLoadingView extends StatelessWidget {
  const AppLoadingView({this.message, super.key});
  final String? message;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: AppSpacing.md),
        Text(message ?? AppLocalizations.of(context).loading),
      ],
    ),
  );
}

class AppErrorView extends StatelessWidget {
  const AppErrorView({required this.message, this.onRetry, super.key});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 48),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.errorTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.md),
              OutlinedButton(onPressed: onRetry, child: Text(l10n.retry)),
            ],
          ],
        ),
      ),
    );
  }
}

class AppEmptyView extends StatelessWidget {
  const AppEmptyView({this.message, super.key});
  final String? message;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Text(message ?? AppLocalizations.of(context).empty),
    ),
  );
}

Future<bool> showConfirmationDialog(
  BuildContext context, {
  required String title,
  required String message,
}) async {
  final l10n = AppLocalizations.of(context);
  return await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(l10n.cancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(l10n.confirm),
            ),
          ],
        ),
      ) ??
      false;
}

Future<T?> showProviderBottomSheet<T>(
  BuildContext context, {
  required Widget child,
}) => showModalBottomSheet<T>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  builder: (sheetContext) => SafeArea(
    child: AnimatedPadding(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: child,
      ),
    ),
  ),
);
