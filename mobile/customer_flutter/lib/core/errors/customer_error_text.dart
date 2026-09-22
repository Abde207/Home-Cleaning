import 'package:flutter/widgets.dart';

import '../localization/app_localizations.dart';
import 'app_exception.dart';

/// Customer copy follows the stable HTTP/error contract, never server text.
String customerErrorText(BuildContext context, AppException? error) {
  final l10n = AppLocalizations.of(context);
  if (error == null) return l10n.errorTitle;
  if (error.kind == AppExceptionKind.configuration) return l10n.configurationError;
  if (error.isOffline) return l10n.networkError;
  if (error.kind == AppExceptionKind.serialization) return l10n.invalidResponse;
  if (error.code == 'AUTH_INVALID_CODE' || error.code == 'OTP_INVALID') return l10n.invalidCode;
  if (error.kind == AppExceptionKind.unauthorized || error.statusCode == 401) return l10n.invalidSession;
  if (error.statusCode == 403) return l10n.accessDenied;
  if (error.statusCode == 404) return l10n.itemUnavailable;
  if (error.statusCode == 409) return l10n.actionConflict;
  if (error.statusCode == 429) return l10n.rateLimited;
  if (error.statusCode == 400 || error.code?.startsWith('VALIDATION_') == true) return l10n.validationFailed;
  return l10n.loadFailed;
}
