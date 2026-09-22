import 'package:flutter/widgets.dart';

import '../localization/app_localizations.dart';
import 'app_exception.dart';

String providerErrorText(BuildContext context, AppException? error) {
  final l10n = AppLocalizations.of(context);
  if (error == null) return l10n.errorTitle;
  return switch (error.kind) {
    AppExceptionKind.configuration => l10n.configurationError,
    AppExceptionKind.network => l10n.networkError,
    AppExceptionKind.timeout => l10n.timeoutError,
    AppExceptionKind.unauthorized => l10n.sessionExpired,
    AppExceptionKind.forbidden => l10n.forbidden,
    AppExceptionKind.notFound => l10n.unavailable,
    AppExceptionKind.conflict => l10n.conflict,
    AppExceptionKind.validation => l10n.invalidInput,
    AppExceptionKind.server => l10n.serverError,
    AppExceptionKind.serialization => l10n.invalidResponse,
    AppExceptionKind.cancelled => l10n.networkError,
    AppExceptionKind.api => l10n.serverError,
  };
}
