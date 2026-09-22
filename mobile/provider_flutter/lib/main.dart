import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'application/auth/auth_controller.dart';
import 'application/provider/provider_operations_controller.dart';
import 'application/provider/provider_management_controller.dart';
import 'core/config/app_config.dart';
import 'core/localization/app_localizations.dart';
import 'core/network/api_client.dart';
import 'core/storage/session_storage.dart';
import 'core/theme/app_theme.dart';
import 'data/auth/auth_remote_data_source.dart';
import 'data/auth/auth_repository_impl.dart';
import 'data/provider/provider_remote_data_source.dart';
import 'data/provider/provider_repository_impl.dart';
import 'routing/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storage = SecureSessionStorage();
  final config = AppConfig.fromEnvironment();
  config.validate();
  late final AuthRepositoryImpl authRepository;
  late final AuthController authController;
  final client = ApiClient(
    config: config,
    tokenReader: () => authRepository.session,
    refreshSession: () => authRepository.refreshSession(),
    onAuthExpired: () async {
      await authRepository.invalidateSession();
      authController.sessionExpired();
    },
  );
  authRepository = AuthRepositoryImpl(
    remote: AuthRemoteDataSource(client),
    storage: storage,
  );
  final providerRepository = ProviderRepositoryImpl(
    ProviderRemoteDataSource(client),
  );
  authController = AuthController(authRepository, providerRepository);
  final operationsController = ProviderOperationsController(providerRepository);
  final managementController = ProviderManagementController(providerRepository);
  runApp(
    HomeCleanProviderApp(
      controller: authController,
      operations: operationsController,
      management: managementController,
    ),
  );
  await authController.bootstrap();
}

class HomeCleanProviderApp extends StatefulWidget {
  const HomeCleanProviderApp({
    required this.controller,
    required this.operations,
    required this.management,
    super.key,
  });
  final AuthController controller;
  final ProviderOperationsController operations;
  final ProviderManagementController management;
  @override
  State<HomeCleanProviderApp> createState() => _HomeCleanProviderAppState();
}

class _HomeCleanProviderAppState extends State<HomeCleanProviderApp> {
  late final AppRouter _router;
  @override
  void initState() {
    super.initState();
    _router = AppRouter(widget.controller, widget.operations, widget.management);
  }

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final language = widget.controller.identity?.locale;
      return MaterialApp.router(
        title: 'Home Clean Provider',
        theme: AppTheme.light(),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        locale: language == 'ar' || language == 'en' ? Locale(language!) : null,
        localeResolutionCallback: (locale, supported) => supported.firstWhere(
          (item) => item.languageCode == locale?.languageCode,
          orElse: () => const Locale('en'),
        ),
        routerDelegate: _router,
        routeInformationParser: AppRouteInformationParser(),
      );
    },
  );
}
