import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../application/customer/customer_controller.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/customer_scaffold.dart';
import '../booking/booking_text.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({required this.controller, required this.onNavigate, required this.onBookingTap, super.key});
  final CustomerController controller;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String> onBookingTap;
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> with WidgetsBindingObserver {
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); widget.controller.loadNotifications(); }
  @override void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }
  @override void didChangeAppLifecycleState(AppLifecycleState state) { if (state == AppLifecycleState.resumed) widget.controller.loadNotifications(); }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final t = BookingText(context);
    return CustomerScaffold(title: l10n.notifications, currentRoute: AppRoute.notifications, onNavigate: widget.onNavigate, body: RefreshIndicator(onRefresh: widget.controller.loadNotifications, child: ListenableBuilder(listenable: widget.controller, builder: (context, _) {
      if (widget.controller.loadingNotifications && widget.controller.notifications.isEmpty) return const AppLoadingView();
      if (widget.controller.notificationsError != null && widget.controller.notifications.isEmpty) return AppErrorView(message: customerErrorText(context, widget.controller.notificationsError), onRetry: widget.controller.loadNotifications);
      if (widget.controller.notifications.isEmpty) return ListView(children: [SizedBox(height: MediaQuery.sizeOf(context).height * .3), AppEmptyView(message: l10n.noNotifications)]);
      return ListView(padding: const EdgeInsets.all(8), children: [
        if (widget.controller.notificationsError != null) Card(child: ListTile(title: Text(customerErrorText(context, widget.controller.notificationsError)), trailing: TextButton(onPressed: widget.controller.loadNotifications, child: Text(t.retry)))),
        for (final item in widget.controller.notifications) Builder(builder: (context) {
        final date = item.createdAt == null ? '' : DateFormat.yMMMd(locale).format(item.createdAt!);
        final title = item.type.startsWith('BOOKING_') || item.type == 'DISPATCH_NO_TEAM_AVAILABLE' ? (t.ar ? 'تحديث الحجز' : 'Booking update') : item.type.startsWith('PAYMENT_') || item.type == 'CASH_COLLECTED' ? (t.ar ? 'تحديث الدفع' : 'Payment update') : item.type.startsWith('REFUND_') ? (t.ar ? 'تحديث الاسترداد' : 'Refund update') : item.title;
        final body = item.status == null ? (t.ar ? '' : item.body) : t.status(item.status!);
        return Card(child: ListTile(tileColor: item.isRead ? null : Theme.of(context).colorScheme.primaryContainer, leading: Icon(item.isRead ? Icons.notifications_none : Icons.notifications_active), title: Text(title), subtitle: Text([body, date].where((value) => value.isNotEmpty).join('\n')), trailing: item.bookingId == null ? null : const Icon(Icons.chevron_right), onTap: () async { await widget.controller.readNotification(item); if (item.bookingId != null && context.mounted) widget.onBookingTap(item.bookingId!); }));
        }),
      ]);
    })));
  }
}
