import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/customer/customer_controller.dart';
import 'package:home_clean_customer/core/localization/app_localizations.dart';
import 'package:home_clean_customer/domain/booking/booking_models.dart';
import 'package:home_clean_customer/domain/customer/customer_models.dart';
import 'package:home_clean_customer/domain/customer/customer_repository.dart';
import 'package:home_clean_customer/presentation/booking/booking_components.dart';
import 'package:home_clean_customer/presentation/booking/booking_history_page.dart';

import '../../application/booking/booking_controller_test.dart' as fixture;

Widget app(Widget child, {String locale = 'en'}) => MaterialApp(key: UniqueKey(), locale: Locale(locale), supportedLocales: AppLocalizations.supportedLocales, localizationsDelegates: const [AppLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate], home: child);

class HistoryRepo extends Fake implements CustomerRepository {
  List<BookingSummary> items = [];
  bool fail = false;
  int calls = 0;
  @override Future<List<BookingSummary>> bookings() async { calls++; if (fail) throw StateError('offline'); return items; }
}

BookingSummary summary(String id, String status, DateTime when) => BookingSummary(id: id, bookingNumber: 'HC-$id', status: status, scheduledAt: when, price: '25', currency: 'JOD');

void main() {
  test('history groups only backend booking states and schedule', () {
    final now = DateTime.now();
    expect(bookingHistoryGroup(summary('1', 'REQUESTED', now.add(const Duration(days: 1))), now), BookingHistoryGroup.upcoming);
    expect(bookingHistoryGroup(summary('2', 'CLEANING_STARTED', now.add(const Duration(days: 1))), now), BookingHistoryGroup.active);
    expect(bookingHistoryGroup(summary('3', 'COMPLETED', now), now), BookingHistoryGroup.completed);
    expect(bookingHistoryGroup(summary('4', 'CANCELLED', now), now), BookingHistoryGroup.cancelled);
    expect(bookingHistoryGroup(summary('5', 'NO_TEAM_AVAILABLE', now), now), BookingHistoryGroup.other);
  });

  testWidgets('history opens a selected booking and refreshes', (tester) async {
    final repo = HistoryRepo()..items = [summary('1', 'CANCELLED', DateTime.now())];
    final controller = CustomerController(repo);
    String? opened;
    await tester.pumpWidget(app(BookingHistoryPage(controller: controller, onNavigate: (_) {}, onBookingTap: (id) => opened = id)));
    await tester.pumpAndSettle();
    expect(find.text('Cancelled'), findsWidgets);
    await tester.tap(find.text('HC-1')); await tester.pump();
    expect(opened, '1');
    await tester.tap(find.text('Refresh status')); await tester.pumpAndSettle();
    expect(repo.calls, 2);
  });

  testWidgets('history has Arabic RTL, empty, and retry states', (tester) async {
    final repo = HistoryRepo(); final controller = CustomerController(repo);
    await tester.pumpWidget(app(BookingHistoryPage(controller: controller, onNavigate: (_) {}, onBookingTap: (_) {}), locale: 'ar'));
    await tester.pumpAndSettle();
    expect(find.text('لا توجد حجوزات بعد.'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('حجوزاتي'))), TextDirection.rtl);
    repo.fail = true; await controller.loadBookings(); await tester.pumpAndSettle();
    expect(find.text('وصلت استجابة غير متوقعة. حاول مرة أخرى.'), findsOneWidget);
  });

  test('detail parses authoritative history, assignment and refunds', () {
    final detail = BookingDetail.fromJson({'id': 'b1', 'bookingNumber': 'HC-1', 'status': 'REFUND_PENDING', 'paymentMethod': 'ONLINE', 'price': '25.00', 'currency': 'JOD', 'serviceSnapshot': {'name': 'Clean', 'nameAr': 'تنظيف'}, 'addressSnapshot': {'addressText': 'Amman'}, 'propertySnapshot': {'type': 'APARTMENT'}, 'history': [{'newStatus': 'REQUESTED', 'createdAt': '2026-09-20T12:00:00Z'}, {'newStatus': 'REFUND_PENDING', 'createdAt': '2026-09-21T12:00:00Z'}], 'assignments': [{'status': 'COMPLETED', 'teamId': 'private-team'}], 'payments': [{'id': 'p1', 'method': 'ONLINE', 'status': 'PARTIALLY_REFUNDED', 'refunds': [{'amount': '5.00', 'status': 'PENDING'}]}]});
    expect(detail.statusHistory.map((e) => e.status), ['REQUESTED', 'REFUND_PENDING']);
    expect(detail.assignmentStatus, 'COMPLETED');
    expect(detail.latestPayment!.refunds.single.amount, '5.00');
  });

  testWidgets('timeline and payment/refund display use server values without private team details', (tester) async {
    final base = fixture.detailFixture(status: 'REFUND_PENDING', method: 'ONLINE', payments: const [BookingPayment(id: 'p1', method: 'ONLINE', status: 'PARTIALLY_REFUNDED', refunds: [BookingRefund(amount: '5.00', status: 'PENDING')])]);
    final detail = BookingDetail(id: base.id, number: base.number, status: base.status, paymentMethod: base.paymentMethod, price: base.price, currency: base.currency, scheduledAt: base.scheduledAt, serviceName: base.serviceName, serviceNameAr: base.serviceNameAr, address: base.address, property: base.property, extras: base.extras, priceSnapshot: base.priceSnapshot, payments: base.payments, assignmentStatus: 'COMPLETED', statusHistory: [BookingStatusEvent(status: 'REQUESTED', createdAt: DateTime.now()), BookingStatusEvent(status: 'REFUND_PENDING', createdAt: DateTime.now())]);
    expect(detail.statusHistory, hasLength(2));
    await tester.pumpWidget(app(Scaffold(body: BookingTimeline(booking: detail))));
    await tester.pumpAndSettle();
    expect(find.byType(BookingTimeline), findsOneWidget);
    expect(find.text('Booking timeline'), findsOneWidget);
    await tester.pumpWidget(app(Scaffold(body: BookingDetailCard(booking: detail))));
    await tester.pumpAndSettle();
    expect(find.text('5.00 JOD · Pending'), findsOneWidget);
    expect(find.text('Assignment status'), findsOneWidget);
    expect(find.textContaining('private-team'), findsNothing);
    await tester.pumpWidget(app(Scaffold(body: BookingTimeline(booking: detail)), locale: 'ar'));
    await tester.pumpAndSettle();
    expect(find.text('تسلسل حالة الحجز'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('تسلسل حالة الحجز'))), TextDirection.rtl);
  });
}
