import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/widgets/app_widgets.dart';

class BootstrapPage extends StatelessWidget {
  const BootstrapPage({required this.controller, super.key});
  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.status == AuthStatus.recoverableFailure) {
      return Scaffold(
        body: AppErrorView(
          message: providerErrorText(context, controller.error),
          onRetry: controller.bootstrap,
        ),
      );
    }
    return const Scaffold(body: AppLoadingView());
  }
}
