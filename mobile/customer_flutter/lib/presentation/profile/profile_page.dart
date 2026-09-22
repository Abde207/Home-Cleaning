import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../application/customer/customer_controller.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/customer_scaffold.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({required this.controller, required this.authController, required this.onNavigate, super.key});
  final CustomerController controller;
  final AuthController authController;
  final ValueChanged<AppRoute> onNavigate;
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  @override
  void initState() { super.initState(); widget.controller.loadProfile(); }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return CustomerScaffold(title: l10n.profile, currentRoute: AppRoute.profile, onNavigate: widget.onNavigate, actions: [IconButton(onPressed: () => widget.onNavigate(AppRoute.notifications), icon: const Icon(Icons.notifications_none), tooltip: l10n.notifications)], body: ListenableBuilder(listenable: widget.controller, builder: (context, _) {
      if (widget.controller.loadingProfile && widget.controller.profile == null) return const AppLoadingView();
      if (widget.controller.profile == null) return AppErrorView(message: customerErrorText(context, widget.controller.profileError), onRetry: widget.controller.loadProfile);
      final profile = widget.controller.profile!;
      return ListView(padding: const EdgeInsets.all(AppSpacing.md), children: [
        Card(child: Padding(padding: const EdgeInsets.all(AppSpacing.lg), child: Row(children: [CircleAvatar(radius: 32, backgroundColor: AppTheme.primary, child: Text(profile.name.isEmpty ? '?' : profile.name.characters.first.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 24))), const SizedBox(width: AppSpacing.md), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(profile.name, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 4), Text(profile.phone)])), IconButton(onPressed: () => _edit(profile.name, profile.locale), icon: const Icon(Icons.edit), tooltip: l10n.editProfile)]))),
        const SizedBox(height: AppSpacing.md),
        ListTile(leading: const Icon(Icons.location_on_outlined), title: Text(l10n.addresses), subtitle: Text(l10n.noAddresses), trailing: const Icon(Icons.chevron_right), onTap: () => widget.onNavigate(AppRoute.addresses)),
        const Divider(),
        ListTile(leading: const Icon(Icons.language), title: Text(l10n.language), subtitle: Text(profile.locale == 'ar' ? l10n.arabic : l10n.english), onTap: () => _edit(profile.name, profile.locale)),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton.icon(onPressed: widget.authController.logout, icon: const Icon(Icons.logout), label: Text(l10n.logout)),
      ]);
    }));
  }

  Future<void> _edit(String currentName, String currentLocale) async {
    final result = await showDialog<_ProfileDraft>(context: context, builder: (context) => _ProfileDialog(name: currentName, locale: currentLocale));
    if (result == null) return;
    try {
      await widget.controller.updateProfile(name: result.name, locale: result.locale);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).profileSaved)));
    } on Object catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(customerErrorText(context, widget.controller.error))));
    }
  }
}

class _ProfileDraft {
  const _ProfileDraft(this.name, this.locale);
  final String name;
  final String locale;
}

class _ProfileDialog extends StatefulWidget {
  const _ProfileDialog({required this.name, required this.locale});
  final String name;
  final String locale;
  @override
  State<_ProfileDialog> createState() => _ProfileDialogState();
}

class _ProfileDialogState extends State<_ProfileDialog> {
  late final controller = TextEditingController(text: widget.name);
  late String locale = widget.locale;
  final key = GlobalKey<FormState>();
  @override
  void dispose() { controller.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(title: Text(l10n.editProfile), content: Form(key: key, child: Column(mainAxisSize: MainAxisSize.min, children: [TextFormField(controller: controller, decoration: InputDecoration(labelText: l10n.name), validator: (value) => value == null || value.trim().isEmpty ? l10n.requiredField : null), const SizedBox(height: AppSpacing.md), DropdownButtonFormField<String>(initialValue: locale, decoration: InputDecoration(labelText: l10n.language), items: [DropdownMenuItem(value: 'en', child: Text(l10n.english)), DropdownMenuItem(value: 'ar', child: Text(l10n.arabic))], onChanged: (value) => setState(() => locale = value ?? locale))])), actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancel)), FilledButton(onPressed: () { if (key.currentState?.validate() ?? false) Navigator.pop(context, _ProfileDraft(controller.text.trim(), locale)); }, child: Text(l10n.save))]);
  }
}
