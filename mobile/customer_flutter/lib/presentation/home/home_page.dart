import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../application/auth/auth_controller.dart';
import '../../application/customer/customer_controller.dart';
import '../../domain/customer/customer_models.dart';
import '../booking/booking_components.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/customer_scaffold.dart';

class HomePage extends StatefulWidget {
  const HomePage({required this.authController, required this.customerController, required this.onNavigate, required this.onBookingTap, super.key});
  final AuthController authController;
  final CustomerController customerController;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String> onBookingTap;
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with WidgetsBindingObserver {
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); widget.customerController.loadHome(); }
  @override void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }
  @override void didChangeAppLifecycleState(AppLifecycleState state) { if (state == AppLifecycleState.resumed) widget.customerController.loadHome(); }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return CustomerScaffold(title: l10n.home, currentRoute: AppRoute.home, onNavigate: widget.onNavigate, actions: [IconButton(onPressed: () => widget.onNavigate(AppRoute.notifications), icon: Badge(isLabelVisible: widget.customerController.unreadNotifications > 0, child: const Icon(Icons.notifications_none)), tooltip: l10n.notifications), IconButton(onPressed: widget.authController.logout, icon: const Icon(Icons.logout), tooltip: l10n.logout)], body: RefreshIndicator(onRefresh: widget.customerController.loadHome, child: ListenableBuilder(listenable: widget.customerController, builder: (context, _) {
      final profile = widget.customerController.profile;
      final name = profile?.name.trim().isNotEmpty == true ? profile!.name : l10n.appName;
      final booking = widget.customerController.upcomingBooking;
      return ListView(padding: const EdgeInsets.all(AppSpacing.md), children: [
        Text('${l10n.greeting}, $name', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
        if (widget.customerController.profileError != null) TextButton(onPressed: widget.customerController.loadProfile, child: Text(customerErrorText(context, widget.customerController.profileError))),
        const SizedBox(height: AppSpacing.sm),
        Text(l10n.signInSubtitle),
        const SizedBox(height: AppSpacing.lg),
        Card(color: AppTheme.primary, child: Padding(padding: const EdgeInsets.all(AppSpacing.lg), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l10n.bookNow, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.bold)), const SizedBox(height: AppSpacing.sm), Text(l10n.viewServices, style: const TextStyle(color: Colors.white70)), const SizedBox(height: AppSpacing.md), FilledButton.tonalIcon(onPressed: () => widget.onNavigate(AppRoute.services), icon: const Icon(Icons.arrow_forward), label: Text(l10n.viewServices))]))),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.upcomingBooking, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        if (widget.customerController.loadingBookings && booking == null) const AppCard(child: SizedBox(height: 80, child: AppLoadingView())) else if (widget.customerController.bookingsError != null && booking == null) AppErrorView(message: customerErrorText(context, widget.customerController.bookingsError), onRetry: widget.customerController.loadBookings) else if (booking == null) AppCard(child: Row(children: [const Icon(Icons.event_available, size: 36, color: AppTheme.primary), const SizedBox(width: AppSpacing.md), Expanded(child: Text(l10n.noUpcomingBooking)), TextButton(onPressed: () => widget.onNavigate(AppRoute.services), child: Text(l10n.bookNow))])) else _BookingCard(booking: booking, onTap: () => widget.onBookingTap(booking.id)),
        const SizedBox(height: AppSpacing.md), OutlinedButton.icon(onPressed: () => widget.onNavigate(AppRoute.history), icon: const Icon(Icons.history), label: Text(l10n.myBookings)),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.services, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        AppCard(child: ListTile(contentPadding: EdgeInsets.zero, leading: const CircleAvatar(backgroundColor: Color(0xFFE1F2F3), child: Icon(Icons.cleaning_services, color: AppTheme.primary)), title: Text(l10n.viewServices), subtitle: Text(l10n.tapToOpen), trailing: const Icon(Icons.chevron_right), onTap: () => widget.onNavigate(AppRoute.services))),
      ]);
    })));
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking, required this.onTap});
  final BookingSummary booking;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context).languageCode;
    final date = booking.scheduledAt == null ? '-' : DateFormat.yMMMd(locale).add_jm().format(booking.scheduledAt!);
    return AppCard(child: InkWell(onTap: onTap, child: Row(children: [const Icon(Icons.calendar_month, color: AppTheme.primary, size: 36), const SizedBox(width: AppSpacing.md), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(booking.bookingNumber, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 4), Text(date), BookingStatusChip(status: booking.status)])), const Icon(Icons.chevron_right)])));
  }
}
