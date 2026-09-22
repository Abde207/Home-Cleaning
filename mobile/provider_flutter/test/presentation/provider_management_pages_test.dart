import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/application/auth/auth_controller.dart';
import 'package:home_clean_provider/application/provider/provider_management_controller.dart';
import 'package:home_clean_provider/core/localization/app_localizations.dart';
import 'package:home_clean_provider/presentation/financials/financials_page.dart';
import 'package:home_clean_provider/presentation/team/team_context_page.dart';

import '../helpers/fakes.dart';

Widget app(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
  locale: locale,
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: child,
);

AuthController managerAuth(FakeProviderRepository repository) =>
    AuthController(FakeAuthRepository(), repository)
      ..status = AuthStatus.authenticated
      ..identity = managerIdentity()
      ..providerContext = managerContext();

void main() {
  testWidgets('manager team screen loads list then authoritative details', (tester) async {
    final repository = FakeProviderRepository();
    await tester.pumpWidget(app(TeamContextPage(auth: managerAuth(repository), controller: ProviderManagementController(repository), onNavigate: (_) {})));
    await tester.pumpAndSettle();
    expect(find.text('Team One'), findsOneWidget);
    expect(find.byTooltip('Create team'), findsOneWidget);
    await tester.tap(find.text('Team One'));
    await tester.pumpAndSettle();
    expect(find.text('Team members'), findsOneWidget);
    expect(find.text('Cleaner'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Deep clean'), 300);
    expect(find.text('Deep clean'), findsOneWidget);
    expect(find.textContaining('31.95000'), findsOneWidget);
  });

  testWidgets('Arabic team management is RTL and localized', (tester) async {
    final repository = FakeProviderRepository();
    await tester.pumpWidget(app(TeamContextPage(auth: managerAuth(repository), controller: ProviderManagementController(repository), onNavigate: (_) {}), locale: const Locale('ar')));
    await tester.pumpAndSettle();
    expect(Directionality.of(tester.element(find.text('إدارة الفرق'))), TextDirection.rtl);
    expect(find.byTooltip('إنشاء فريق'), findsOneWidget);
  });

  testWidgets('financial screen navigates from settlement to safe read-only detail', (tester) async {
    final repository = FakeProviderRepository()
      ..settlementRows = [testSettlementSummary()]
      ..settlementValue = testSettlementDetail();
    await tester.pumpWidget(app(FinancialsPage(controller: ProviderManagementController(repository), onNavigate: (_) {})));
    await tester.pumpAndSettle();
    expect(find.text('HC-SET-1'), findsOneWidget);
    expect(find.textContaining('72.00 JOD'), findsWidgets);
    await tester.tap(find.text('HC-SET-1'));
    await tester.pumpAndSettle();
    expect(find.text('Completed-work context'), findsOneWidget);
    expect(find.textContaining('HC-1'), findsOneWidget);
    expect(find.textContaining('PAYOUT-1'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('read-only'), 300);
    expect(find.textContaining('read-only'), findsOneWidget);
  });

  testWidgets('Arabic financial projection is RTL and localized', (tester) async {
    final repository = FakeProviderRepository()..settlementRows = [testSettlementSummary()];
    await tester.pumpWidget(app(FinancialsPage(controller: ProviderManagementController(repository), onNavigate: (_) {}), locale: const Locale('ar')));
    await tester.pumpAndSettle();
    expect(Directionality.of(tester.element(find.text('التسويات'))), TextDirection.rtl);
    expect(find.textContaining('المبلغ المستحق'), findsOneWidget);
  });
}
