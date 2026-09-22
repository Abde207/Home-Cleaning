import 'package:flutter/material.dart';

import '../../core/widgets/app_widgets.dart';
import '../../core/errors/customer_error_text.dart';
import '../../application/auth/auth_controller.dart';

class BootstrapPage extends StatelessWidget {
  const BootstrapPage({required this.controller, super.key});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => Scaffold(body: controller.error == null ? const AppLoadingView() : AppErrorView(message: customerErrorText(context, controller.error), onRetry: controller.bootstrap));
}
