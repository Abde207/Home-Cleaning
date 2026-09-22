import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/core/localization/app_localizations.dart';

Widget localized(Locale locale, void Function(BuildContext) inspect) =>
    MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Builder(
        builder: (context) {
          inspect(context);
          return Text(AppLocalizations.of(context).assignments);
        },
      ),
    );

void main() {
  testWidgets('English provider UI is LTR with operational labels', (
    tester,
  ) async {
    TextDirection? direction;
    await tester.pumpWidget(
      localized(
        const Locale('en'),
        (context) => direction = Directionality.of(context),
      ),
    );
    await tester.pumpAndSettle();
    expect(direction, TextDirection.ltr);
    expect(find.text('Assignments'), findsOneWidget);
  });

  testWidgets('Arabic provider UI is RTL with localized status labels', (
    tester,
  ) async {
    TextDirection? direction;
    String? status;
    await tester.pumpWidget(
      localized(const Locale('ar'), (context) {
        direction = Directionality.of(context);
        status = AppLocalizations.of(context).statusLabel('OFFERED');
      }),
    );
    await tester.pumpAndSettle();
    expect(direction, TextDirection.rtl);
    expect(status, 'معروضة');
    expect(find.text('المهام'), findsOneWidget);
  });
}
