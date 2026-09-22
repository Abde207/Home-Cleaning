import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({required this.controller, super.key});
  final AuthController controller;
  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _phone = TextEditingController();
  final _code = TextEditingController();

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final waiting =
        widget.controller.status == AuthStatus.authenticating ||
        widget.controller.status == AuthStatus.loadingScope;
    final challenge = widget.controller.challengeId;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.cleaning_services_outlined,
                    size: 64,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    l10n.appName,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  Text(
                    l10n.providerPortal,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(l10n.signInSubtitle, textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.xl),
                  TextField(
                    key: const Key('provider-phone-field'),
                    controller: _phone,
                    enabled: !waiting,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    decoration: InputDecoration(
                      labelText: l10n.phoneNumber,
                      hintText: l10n.phoneHint,
                    ),
                  ),
                  if (challenge != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      key: const Key('provider-code-field'),
                      controller: _code,
                      enabled: !waiting,
                      keyboardType: TextInputType.number,
                      obscureText: true,
                      maxLength: 6,
                      decoration: InputDecoration(
                        labelText: l10n.verificationCode,
                      ),
                    ),
                  ],
                  if (widget.controller.error != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      providerErrorText(context, widget.controller.error),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: challenge == null ? l10n.sendCode : l10n.verify,
                    busy: waiting,
                    icon: challenge == null ? Icons.sms_outlined : Icons.login,
                    onPressed: challenge == null
                        ? () => widget.controller.requestOtp(_phone.text.trim())
                        : () => widget.controller.verifyOtp(
                            challengeId: challenge,
                            code: _code.text.trim(),
                          ),
                  ),
                  if (challenge != null)
                    TextButton(
                      onPressed: waiting
                          ? null
                          : () => widget.controller.requestOtp(
                              _phone.text.trim(),
                            ),
                      child: Text(l10n.resend),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
