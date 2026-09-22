import 'package:flutter/material.dart';

import '../../application/customer/customer_controller.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/widgets/app_widgets.dart';
import '../../domain/customer/customer_models.dart';
import '../../routing/app_router.dart';
import '../shared/customer_scaffold.dart';
import 'booking_components.dart';
import 'booking_text.dart';

enum BookingHistoryGroup { upcoming, active, completed, cancelled, other }

BookingHistoryGroup bookingHistoryGroup(BookingSummary booking, DateTime now) {
  if (booking.status == 'CANCELLED') return BookingHistoryGroup.cancelled;
  if (const {'COMPLETED', 'REFUNDED'}.contains(booking.status)) return BookingHistoryGroup.completed;
  if (const {'NO_TEAM_AVAILABLE', 'CUSTOMER_NO_SHOW'}.contains(booking.status)) return BookingHistoryGroup.other;
  if (const {'TEAM_ON_THE_WAY', 'CLEANING_STARTED', 'CLEANING_COMPLETED', 'PAYMENT_RECONCILIATION', 'REFUND_PENDING'}.contains(booking.status)) return BookingHistoryGroup.active;
  if (booking.scheduledAt?.isAfter(now) == true) return BookingHistoryGroup.upcoming;
  return BookingHistoryGroup.active;
}

class BookingHistoryPage extends StatefulWidget {
  const BookingHistoryPage({required this.controller, required this.onNavigate, required this.onBookingTap, super.key});
  final CustomerController controller;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String> onBookingTap;
  @override State<BookingHistoryPage> createState() => _BookingHistoryPageState();
}

class _BookingHistoryPageState extends State<BookingHistoryPage> with WidgetsBindingObserver {
  @override void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); widget.controller.loadBookings(); }
  @override void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }
  @override void didChangeAppLifecycleState(AppLifecycleState state) { if (state == AppLifecycleState.resumed) widget.controller.loadBookings(); }

  @override Widget build(BuildContext context) {
    final t = BookingText(context);
    final ar = t.ar;
    String label(BookingHistoryGroup group) => switch (group) {
      BookingHistoryGroup.upcoming => ar ? 'الحجوزات القادمة' : 'Upcoming',
      BookingHistoryGroup.active => ar ? 'الحجوزات النشطة' : 'Active',
      BookingHistoryGroup.completed => ar ? 'الحجوزات المكتملة' : 'Completed',
      BookingHistoryGroup.cancelled => ar ? 'الحجوزات الملغاة' : 'Cancelled',
      BookingHistoryGroup.other => ar ? 'نتائج أخرى' : 'Other outcomes',
    };
    return CustomerScaffold(title: ar ? 'حجوزاتي' : 'My bookings', currentRoute: AppRoute.history, onNavigate: widget.onNavigate, body: RefreshIndicator(onRefresh: widget.controller.loadBookings, child: ListenableBuilder(listenable: widget.controller, builder: (context, _) {
      final c = widget.controller;
      if (c.loadingBookings && c.bookings.isEmpty) return const AppLoadingView();
      if (c.bookingsError != null && c.bookings.isEmpty) return AppErrorView(message: customerErrorText(context, c.bookingsError), onRetry: c.loadBookings);
      final now = DateTime.now();
      return ListView(padding: const EdgeInsets.all(16), children: [
        if (c.bookingsError != null) TextButton(onPressed: c.loadBookings, child: Text(customerErrorText(context, c.bookingsError))),
        if (c.bookings.isEmpty) AppEmptyView(message: ar ? 'لا توجد حجوزات بعد.' : 'No bookings yet.'),
        for (final group in BookingHistoryGroup.values) ...[
          if (c.bookings.any((b) => bookingHistoryGroup(b, now) == group)) Text(label(group), style: Theme.of(context).textTheme.titleLarge),
          for (final booking in c.bookings.where((b) => bookingHistoryGroup(b, now) == group))
            Card(child: ListTile(title: Text(booking.bookingNumber), subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(bookingDate(context, booking.scheduledAt)), BookingStatusChip(status: booking.status)]), trailing: const Icon(Icons.chevron_right), onTap: () => widget.onBookingTap(booking.id))),
        ],
        if (c.bookings.isNotEmpty) TextButton(onPressed: c.loadingBookings ? null : c.loadBookings, child: Text(t.refresh)),
      ]);
    })));
  }
}
