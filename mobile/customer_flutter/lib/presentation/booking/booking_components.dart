import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../domain/booking/booking_models.dart';
import '../../domain/customer/customer_models.dart';
import 'booking_text.dart';

String bookingDate(BuildContext context, DateTime? date) => date == null ? '—' : DateFormat.yMMMd(Localizations.localeOf(context).languageCode).add_jm().format(date);

class BookingPriceCard extends StatelessWidget {
  const BookingPriceCard({required this.quote, this.service, super.key});
  final BookingQuote quote;
  final CleaningService? service;
  @override Widget build(BuildContext context) {
    final t = BookingText(context);
    Widget row(String label, String value) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Expanded(child: Text(label)), Text('$value ${quote.currency}')]));
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      row(t.base, quote.basePrice),
      for (final extra in quote.extras) row('${t.ar ? service?.extras.where((item) => item.id == extra.serviceExtraId).firstOrNull?.nameAr ?? extra.name : extra.name} × ${extra.quantity}', extra.lineTotal),
      for (final line in quote.adjustments) row(line.name, line.amount),
      for (final line in quote.fees) row(line.name, line.amount),
      row(t.discount, quote.discount),
      const Divider(), row(t.total, quote.total),
      if (quote.promotion != null) Text('${t.promotion}: ${quote.promotion}'),
      Text('${t.expires}: ${bookingDate(context, quote.expiresAt.toLocal())}'),
    ])));
  }
}

class BookingStatusChip extends StatelessWidget {
  const BookingStatusChip({required this.status, super.key});
  final String status;
  @override Widget build(BuildContext context) {
    final color = switch (status) {
      'COMPLETED' || 'PAYMENT_CONFIRMED' || 'CONFIRMED' || 'RECONCILED' => Colors.green,
      'CANCELLED' || 'FAILED' || 'NO_TEAM_AVAILABLE' || 'REJECTED' || 'CUSTOMER_NO_SHOW' || 'TEAM_NO_SHOW' => Colors.red,
      'PAYMENT_PENDING' || 'PENDING' || 'REFUND_PENDING' => Colors.orange,
      _ => Colors.blue,
    };
    return Chip(label: Text(BookingText(context).status(status)), backgroundColor: color.withValues(alpha: .12), side: BorderSide(color: color));
  }
}

class BookingDetailCard extends StatelessWidget {
  const BookingDetailCard({required this.booking, super.key});
  final BookingDetail booking;
  @override Widget build(BuildContext context) {
    final t = BookingText(context);
    Widget line(String label, String value) => Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Text(label)), Expanded(child: Text(value, textAlign: TextAlign.end))]));
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(booking.number, style: Theme.of(context).textTheme.titleLarge),
      line(t.bookingStatus, t.status(booking.status)),
      line(t.service, t.ar ? booking.serviceNameAr : booking.serviceName),
      line(t.address, booking.address),
      line(t.property, '${t.propertyType('${booking.property['type'] ?? ''}')} · ${booking.property['size'] ?? ''}'),
      line(t.chooseTime, bookingDate(context, booking.scheduledAt)),
      for (final extra in booking.extras) line('${extra['name']} × ${extra['quantity']}', '${extra['price']} ${booking.currency}'),
      line(t.total, '${booking.price} ${booking.currency}'),
      line(t.paymentMethod, t.status(booking.paymentMethod ?? 'PENDING')),
      if (booking.latestPayment != null) line(t.paymentStatus, t.status(booking.latestPayment!.status)),
      if (booking.assignmentStatus != null) line(t.assignment, t.status(booking.assignmentStatus!)),
      for (final payment in booking.payments)
        for (final refund in payment.refunds) line(t.refund, '${refund.amount} ${booking.currency} · ${t.status(refund.status)}'),
    ])));
  }
}

class BookingTimeline extends StatelessWidget {
  const BookingTimeline({required this.booking, super.key});
  final BookingDetail booking;
  @override Widget build(BuildContext context) {
    final t = BookingText(context);
    if (booking.statusHistory.isEmpty) return const SizedBox.shrink();
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(t.timeline, style: Theme.of(context).textTheme.titleMedium),
      for (final event in booking.statusHistory) ListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.check_circle_outline),
        title: Text(t.status(event.status)),
        subtitle: Text(bookingDate(context, event.createdAt)),
      ),
    ])));
  }
}
