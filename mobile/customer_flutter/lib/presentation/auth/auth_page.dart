import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../core/errors/app_exception.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({required this.authController, super.key});
  final AuthController authController;
  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool showCode = false;

  @override
  void dispose() { _phone.dispose(); _code.dispose(); super.dispose(); }

  String? _phoneValidator(String? value, AppLocalizations l10n) => value == null || !RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(value.trim()) ? l10n.phoneHint : null;
  String? _codeValidator(String? value, AppLocalizations l10n) => value == null || !RegExp(r'^\d{6}$').hasMatch(value.trim()) ? l10n.verificationCode : null;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.authController,
        builder: (context, _) {
          final l10n = AppLocalizations.of(context);
          final busy = widget.authController.status == AuthStatus.authenticating;
          final error = widget.authController.error;
          return Scaffold(
            body: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Form(
                      key: _formKey,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Icon(Icons.cleaning_services, size: 56, color: AppTheme.primary),
                        const SizedBox(height: AppSpacing.md),
                        Text(l10n.appName, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                        const SizedBox(height: AppSpacing.sm),
                        Text(l10n.welcome, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
                        const SizedBox(height: AppSpacing.sm),
                        Text(l10n.signInSubtitle, textAlign: TextAlign.center),
                        const SizedBox(height: AppSpacing.lg),
                        if (error != null) _ErrorBanner(exception: error),
                        if (!showCode) ...[
                          TextFormField(controller: _phone, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, decoration: InputDecoration(labelText: l10n.phoneNumber, hintText: l10n.phoneHint, border: const OutlineInputBorder()), validator: (value) => _phoneValidator(value, l10n)),
                          const SizedBox(height: AppSpacing.md),
                          AppButton(label: l10n.requestOtp, busy: busy, onPressed: () async {
                            if (!(_formKey.currentState?.validate() ?? false)) return;
                            await widget.authController.requestOtp(_phone.text.trim());
                            if (mounted) setState(() => showCode = widget.authController.challengeId != null);
                          }),
                        ] else ...[
                          TextFormField(controller: _code, keyboardType: TextInputType.number, maxLength: 6, textAlign: TextAlign.center, decoration: InputDecoration(labelText: l10n.verificationCode, border: const OutlineInputBorder()), validator: (value) => _codeValidator(value, l10n)),
                          const SizedBox(height: AppSpacing.md),
                          AppButton(label: l10n.verify, busy: busy, onPressed: () async {
                            if (!(_formKey.currentState?.validate() ?? false)) return;
                            final challenge = widget.authController.challengeId;
                            if (challenge != null) await widget.authController.verifyOtp(challengeId: challenge, code: _code.text.trim());
                          }),
                          TextButton(onPressed: busy ? null : () async { await widget.authController.requestOtp(_phone.text.trim()); if (mounted) setState(() { _code.clear(); showCode = widget.authController.challengeId != null; }); }, child: Text(l10n.resend)),
                          TextButton(onPressed: busy ? null : () => setState(() { showCode = false; _code.clear(); }), child: Text(l10n.phoneNumber)),
                        ],
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.exception});
  final AppException exception;
  @override
  Widget build(BuildContext context) {
    final message = customerErrorText(context, exception);
    return Container(margin: const EdgeInsets.only(bottom: AppSpacing.md), padding: const EdgeInsets.all(AppSpacing.md), decoration: BoxDecoration(color: Theme.of(context).colorScheme.errorContainer, borderRadius: BorderRadius.circular(12)), child: Row(children: [Icon(Icons.error_outline, color: Theme.of(context).colorScheme.onErrorContainer), const SizedBox(width: AppSpacing.sm), Expanded(child: Text(message, style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)))]));
  }
}
