import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/customer/customer_controller.dart';
import 'package:home_clean_customer/core/localization/app_localizations.dart';
import 'package:home_clean_customer/domain/customer/customer_models.dart';
import 'package:home_clean_customer/domain/customer/customer_repository.dart';
import 'package:home_clean_customer/presentation/notifications/notifications_page.dart';

class NotificationRepo extends Fake implements CustomerRepository {
  List<CustomerNotification> items = [];
  bool fail = false;
  int loads = 0, reads = 0;
  @override Future<List<CustomerNotification>> notifications() async { loads++; if (fail) throw StateError('offline'); return items; }
  @override Future<void> readNotification(String id) async { reads++; items = [for (final n in items) CustomerNotification(id: n.id, type: n.type, title: n.title, body: n.body, readAt: DateTime.now(), createdAt: n.createdAt, bookingId: n.bookingId, status: n.status)]; }
}

Widget app(Widget child, {String locale = 'en'}) => MaterialApp(locale: Locale(locale), supportedLocales: AppLocalizations.supportedLocales, localizationsDelegates: const [AppLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate], home: child);

void main() {
  test('outbox payload supplies booking reference and status', () {
    final item = CustomerNotification.fromJson({'id': 'n1', 'type': 'BOOKING_STATUS_CHANGED', 'payload': {'title': 'BOOKING STATUS CHANGED', 'body': 'BOOKING STATUS CHANGED: TEAM_ASSIGNED', 'payload': {'bookingId': 'b1', 'newStatus': 'TEAM_ASSIGNED'}}});
    expect(item.bookingId, 'b1'); expect(item.status, 'TEAM_ASSIGNED'); expect(item.isRead, isFalse);
  });

  testWidgets('unread notification marks read and opens referenced booking', (tester) async {
    final repo = NotificationRepo()..items = [CustomerNotification.fromJson({'id': 'n1', 'type': 'BOOKING_STATUS_CHANGED', 'payload': {'title': 'BOOKING STATUS CHANGED', 'payload': {'bookingId': 'b1', 'newStatus': 'TEAM_ASSIGNED'}}})];
    final controller = CustomerController(repo); String? opened;
    await tester.pumpWidget(app(NotificationsPage(controller: controller, onNavigate: (_) {}, onBookingTap: (id) => opened = id)));
    await tester.pumpAndSettle();
    expect(controller.unreadNotifications, 1);
    await tester.tap(find.text('Booking update')); await tester.pumpAndSettle();
    expect(repo.reads, 1); expect(controller.unreadNotifications, 0); expect(opened, 'b1');
  });

  testWidgets('notification without booking only marks read', (tester) async {
    final repo = NotificationRepo()..items = [const CustomerNotification(id: 'n1', type: 'PAYMENT_STATUS_CHANGED', title: 'Payment', body: '', readAt: null, createdAt: null)];
    final controller = CustomerController(repo); String? opened;
    await tester.pumpWidget(app(NotificationsPage(controller: controller, onNavigate: (_) {}, onBookingTap: (id) => opened = id)));
    await tester.pumpAndSettle(); await tester.tap(find.text('Payment update')); await tester.pumpAndSettle();
    expect(opened, isNull); expect(repo.reads, 1);
  });

  testWidgets('Arabic notification copy is RTL and empty state supports refresh', (tester) async {
    final repo = NotificationRepo(); final controller = CustomerController(repo);
    await tester.pumpWidget(app(NotificationsPage(controller: controller, onNavigate: (_) {}, onBookingTap: (_) {}), locale: 'ar'));
    await tester.pumpAndSettle();
    expect(find.text('لا توجد إشعارات جديدة.'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('لا توجد إشعارات جديدة.'))), TextDirection.rtl);
    repo.items = [const CustomerNotification(id: 'n1', type: 'BOOKING_CREATED', title: 'Booking', body: '', readAt: null, createdAt: null, bookingId: 'b1', status: 'REQUESTED')];
    await controller.loadNotifications(); await tester.pumpAndSettle();
    expect(find.text('تحديث الحجز'), findsOneWidget);
  });

  testWidgets('notification error offers retry', (tester) async {
    final repo = NotificationRepo()..fail = true; final controller = CustomerController(repo);
    await tester.pumpWidget(app(NotificationsPage(controller: controller, onNavigate: (_) {}, onBookingTap: (_) {})));
    await tester.pumpAndSettle();
    expect(find.text('The service returned an unexpected response. Try again.'), findsOneWidget);
    repo.fail = false; await tester.tap(find.text('Try again')); await tester.pumpAndSettle();
    expect(repo.loads, 2);
  });
}
