import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:home_clean_customer/core/localization/app_localizations.dart';

void main() {
  test('provides Arabic and English domain-neutral display strings', () {
    expect(AppLocalizations(const Locale('en')).services, 'Services');
    expect(AppLocalizations(const Locale('ar')).services, 'الخدمات');
    expect(AppLocalizations.supportedLocales.map((locale) => locale.languageCode), containsAll(<String>['ar', 'en']));
  });

  testWidgets('Material direction follows the selected locale', (tester) async {
    const delegates = <LocalizationsDelegate<dynamic>>[AppLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate];
    await tester.pumpWidget(const MaterialApp(locale: Locale('ar'), supportedLocales: AppLocalizations.supportedLocales, localizationsDelegates: delegates, home: Text('probe')));
    await tester.pumpAndSettle();
    expect(Directionality.of(tester.element(find.text('probe'))), TextDirection.rtl);
    await tester.pumpWidget(const MaterialApp(locale: Locale('en'), supportedLocales: AppLocalizations.supportedLocales, localizationsDelegates: delegates, home: Text('probe')));
    await tester.pumpAndSettle();
    expect(Directionality.of(tester.element(find.text('probe'))), TextDirection.ltr);
  });
}
