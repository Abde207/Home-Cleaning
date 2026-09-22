import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../application/provider/provider_operations_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/provider_scaffold.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    required this.controller,
    required this.onNavigate,
    required this.onOpenAssignment,
    super.key,
  });
  final ProviderOperationsController controller;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String> onOpenAssignment;
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.loadNotifications(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ProviderScaffold(
      title: l10n.notifications,
      route: AppRoute.notifications,
      onNavigate: widget.onNavigate,
      actions: [
        IconButton(
          onPressed: widget.controller.loadNotifications,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          if (controller.notificationsLoading) {
            return const AppLoadingView();
          }
          if (controller.notificationsError != null) {
            return AppErrorView(
              message: providerErrorText(
                context,
                controller.notificationsError,
              ),
              onRetry: controller.loadNotifications,
            );
          }
          if (controller.notifications.isEmpty) {
            return AppEmptyView(message: l10n.noNotifications);
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: controller.notifications.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, index) {
              final notification = controller.notifications[index];
              final linked =
                  notification.type.startsWith('ASSIGNMENT_') &&
                  notification.referenceId != null;
              return AppCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    notification.readAt == null
                        ? Icons.notifications_active_outlined
                        : Icons.notifications_none,
                  ),
                  title: Text(l10n.notificationLabel(notification.type)),
                  subtitle: Text(
                    DateFormat.yMMMd(
                      Localizations.localeOf(context).toLanguageTag(),
                    ).add_jm().format(notification.createdAt.toLocal()),
                  ),
                  trailing: linked ? const Icon(Icons.chevron_right) : null,
                  onTap: linked
                      ? () async {
                          final id = await controller.openNotification(
                            notification,
                          );
                          if (id != null) widget.onOpenAssignment(id);
                        }
                      : null,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
