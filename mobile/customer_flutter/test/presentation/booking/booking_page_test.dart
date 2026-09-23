import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_customer/application/booking/booking_controller.dart';
import 'package:home_clean_customer/core/errors/app_exception.dart';
import 'package:home_clean_customer/core/localization/app_localizations.dart';
import 'package:home_clean_customer/domain/booking/booking_models.dart';
import 'package:home_clean_customer/presentation/booking/booking_components.dart';
import 'package:home_clean_customer/presentation/booking/booking_page.dart';
import 'package:home_clean_customer/presentation/booking/booking_text.dart';

import '../../application/booking/booking_controller_test.dart' as fixture;

Widget app(Widget child, {String locale = 'en'}) => MaterialApp(locale: Locale(locale), supportedLocales: AppLocalizations.supportedLocales, localizationsDelegates: const [AppLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate], home: child);

void main() {
  testWidgets('service details and extras are selectable', (tester) async {
    final c = BookingController(fixture.BookingStub(), fixture.CustomerStub());
    await c.load(); await c.selectService(fixture.serviceFixture);
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}))); await tester.pumpAndSettle();
    expect(find.text('Clean'), findsOneWidget);
    expect(find.text('Windows'), findsOneWidget);
    await tester.tap(find.byType(CheckboxListTile)); await tester.pump();
    expect(c.selection.extras, {'extra-1': 1});
  });

  testWidgets('review shows server quote and cash/online choice', (tester) async {
    final c = await fixture.ready(fixture.BookingStub());
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}))); await tester.pumpAndSettle();
    expect(find.text('25 JOD'), findsOneWidget);
    expect(find.text('Pay cash later. No cash has been collected yet.'), findsOneWidget);
    expect(find.text('Online'), findsOneWidget);
  });

  testWidgets('Arabic booking labels use RTL', (tester) async {
    final c = await fixture.ready(fixture.BookingStub());
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}), locale: 'ar')); await tester.pumpAndSettle();
    expect(find.text('مراجعة الحجز'), findsOneWidget);
    expect(find.text('تأكيد الحجز'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('مراجعة الحجز'))), TextDirection.rtl);
  });

  testWidgets('backend status and cash pending state are shown on details', (tester) async {
    final repo = fixture.BookingStub()..current = fixture.detailFixture(status: 'CASH_SELECTED', method: 'CASH');
    final c = BookingController(repo, fixture.CustomerStub()); await c.openDetail('booking-1');
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}))); await tester.pumpAndSettle();
    expect(find.byType(BookingStatusChip), findsOneWidget);
    expect(find.text('Cash selected'), findsWidgets);
    expect(find.text('Pay cash later. No cash has been collected yet.'), findsOneWidget);
  });

  testWidgets('on-the-way booking states that live location and ETA are unavailable', (tester) async {
    final repo = fixture.BookingStub()
      ..current = fixture.detailFixture(status: 'TEAM_ON_THE_WAY')
      ..nextTracking = const TeamTracking(active: true, etaStale: false, etaUnavailable: true);
    final c = BookingController(repo, fixture.CustomerStub()); await c.openDetail('booking-1');
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}))); await tester.pumpAndSettle();
    expect(find.text('Team location and arrival time are currently unavailable.'), findsOneWidget);
  });

  testWidgets('on-the-way booking shows latest location, ETA and stale warning', (tester) async {
    final repo = fixture.BookingStub()
      ..current = fixture.detailFixture(status: 'TEAM_ON_THE_WAY')
      ..nextTracking = TeamTracking(active: true, latitude: 31.95, longitude: 35.91,
        updatedAt: DateTime(2026), etaSeconds: 600, locationStale: true, etaStale: true, etaUnavailable: false);
    final c = BookingController(repo, fixture.CustomerStub()); await c.openDetail('booking-1');
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}))); await tester.pumpAndSettle();
    expect(find.text('31.950000, 35.910000'), findsOneWidget);
    expect(find.textContaining('About 10 min'), findsOneWidget);
    expect(find.text('Location and ETA are stale'), findsOneWidget);
  });

  testWidgets('booking and payment states have English and Arabic labels', (tester) async {
    await tester.pumpWidget(app(const Scaffold(body: Text('labels')))); await tester.pumpAndSettle();
    final context = tester.element(find.text('labels'));
    expect(BookingText(context).status('PAYMENT_PENDING'), 'Payment pending');
    await tester.pumpWidget(app(const Scaffold(body: Text('labels')), locale: 'ar')); await tester.pumpAndSettle();
    expect(BookingText(tester.element(find.text('labels'))).status('PAYMENT_PENDING'), 'الدفع قيد الانتظار');
  });

  testWidgets('backend conflict is mapped to a localizable review error', (tester) async {
    final repo = fixture.BookingStub()..createError = const AppException(kind: AppExceptionKind.api, code: 'QUOTE_INPUT_MISMATCH', message: 'Mismatch', statusCode: 409);
    final c = await fixture.ready(repo); await c.submit();
    await tester.pumpWidget(app(BookingPage(controller: c, onHome: () {}), locale: 'ar')); await tester.pumpAndSettle();
    expect(find.textContaining('QUOTE_INPUT_MISMATCH'), findsNothing);
    expect(find.textContaining('تغيرت حالة الحجز'), findsOneWidget);
  });
}
