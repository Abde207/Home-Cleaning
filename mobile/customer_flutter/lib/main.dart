import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'application/auth/auth_controller.dart';
import 'application/customer/customer_controller.dart';
import 'application/booking/booking_controller.dart';
import 'application/notifications/device_registration_controller.dart';
import 'core/config/app_config.dart';
import 'core/localization/app_localizations.dart';
import 'core/network/api_client.dart';
import 'core/storage/session_storage.dart';
import 'core/theme/app_theme.dart';
import 'data/auth/auth_remote_data_source.dart';
import 'data/auth/auth_repository_impl.dart';
import 'data/customer/customer_remote_data_source.dart';
import 'data/customer/customer_repository_impl.dart';
import 'data/booking/booking_repository_impl.dart';
import 'data/notifications/device_registration_repository_impl.dart';
import 'routing/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storage = SecureSessionStorage();
  final config = AppConfig.fromEnvironment();
  config.validate();
  late final AuthRepositoryImpl repository;
  late final AuthController controller;
  final client = ApiClient(config: config, tokenReader: () => repository.session, refreshSession: () => repository.refreshSession(), onAuthExpired: () async { await repository.invalidateSession(); controller.sessionExpired(); });
  repository = AuthRepositoryImpl(remote: AuthRemoteDataSource(client), storage: storage);
  final deviceRegistration = DeviceRegistrationController(DeviceRegistrationRepositoryImpl(client, const FlutterSecureStorage()));
  controller = AuthController(repository, beforeLogout: deviceRegistration.unregister);
  final customerRepository = CustomerRepositoryImpl(CustomerRemoteDataSource(client));
  final customerController = CustomerController(customerRepository);
  final bookingController = BookingController(BookingRepositoryImpl(client), customerRepository);
  runApp(HomeCleanApp(controller: controller, customerController: customerController, bookingController: bookingController));
  await controller.bootstrap();
}

class HomeCleanApp extends StatefulWidget {
  const HomeCleanApp({required this.controller, required this.customerController, required this.bookingController, super.key});
  final AuthController controller;
  final CustomerController customerController;
  final BookingController bookingController;
  @override
  State<HomeCleanApp> createState() => _HomeCleanAppState();
}

class _HomeCleanAppState extends State<HomeCleanApp> {
  late final AppRouter router;
  @override
  void initState() { super.initState(); router = AppRouter(widget.controller, widget.customerController, widget.bookingController); }
  @override
  void dispose() { router.dispose(); widget.bookingController.dispose(); widget.customerController.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.customerController,
        builder: (context, _) {
          final value = widget.customerController.profile?.locale;
          return MaterialApp.router(
            title: 'Home Clean',
            theme: AppTheme.light(),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: const [AppLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
            locale: value == 'ar' || value == 'en' ? Locale(value!) : null,
            routerDelegate: router,
            routeInformationParser: AppRouteInformationParser(),
            localeResolutionCallback: (locale, supported) => supported.firstWhere((item) => item.languageCode == locale?.languageCode, orElse: () => const Locale('en')),
          );
        },
      );
}
