import 'package:flutter/material.dart';

import '../../application/customer/customer_controller.dart';
import '../../domain/customer/customer_models.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/customer_scaffold.dart';

class AddressesPage extends StatefulWidget {
  const AddressesPage({required this.controller, required this.onNavigate, super.key});
  final CustomerController controller;
  final ValueChanged<AppRoute> onNavigate;
  @override
  State<AddressesPage> createState() => _AddressesPageState();
}

class _AddressesPageState extends State<AddressesPage> {
  @override
  void initState() { super.initState(); widget.controller.loadAddresses(); }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return CustomerScaffold(title: l10n.addresses, currentRoute: AppRoute.addresses, onNavigate: widget.onNavigate, actions: [IconButton(onPressed: () => _edit(), icon: const Icon(Icons.add), tooltip: l10n.addAddress)], body: RefreshIndicator(onRefresh: widget.controller.loadAddresses, child: ListenableBuilder(listenable: widget.controller, builder: (context, _) {
      if (widget.controller.loadingAddresses && widget.controller.addresses.isEmpty) return const AppLoadingView();
      if (widget.controller.addressesError != null && widget.controller.addresses.isEmpty) return AppErrorView(message: customerErrorText(context, widget.controller.addressesError), onRetry: widget.controller.loadAddresses);
      if (widget.controller.addresses.isEmpty) return ListView(children: [SizedBox(height: MediaQuery.sizeOf(context).height * .25), AppEmptyView(message: l10n.noAddresses), Padding(padding: const EdgeInsets.all(AppSpacing.lg), child: AppButton(label: l10n.addAddress, onPressed: () => _edit()))]);
      return ListView.separated(padding: const EdgeInsets.all(AppSpacing.md), itemCount: widget.controller.addresses.length, separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.sm), itemBuilder: (context, index) => _AddressCard(address: widget.controller.addresses[index], onEdit: () => _edit(widget.controller.addresses[index]), onDelete: () => _delete(widget.controller.addresses[index])));
    })));
  }

  Future<void> _edit([CustomerAddress? address]) async {
    final result = await showDialog<_AddressDraft>(context: context, builder: (context) => _AddressDialog(address: address));
    if (result == null) return;
    try {
      await widget.controller.saveAddress(id: address?.id, label: result.label, addressText: result.addressText, isDefault: result.isDefault);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).save)));
    } on Object catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(customerErrorText(context, widget.controller.error))));
    }
  }

  Future<void> _delete(CustomerAddress address) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: Text(l10n.delete), content: Text(l10n.deleteAddressConfirm), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.cancel)), FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l10n.delete))]));
    if (confirmed != true) return;
    try { await widget.controller.archiveAddress(address); } on Object catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(customerErrorText(context, widget.controller.error)))); }
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.address, required this.onEdit, required this.onDelete});
  final CustomerAddress address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(AppSpacing.md), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.location_on_outlined, color: AppTheme.primary), const SizedBox(width: AppSpacing.md), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(address.label, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: AppSpacing.sm), Text(address.addressText), const SizedBox(height: AppSpacing.sm), if (address.isDefault) Text(AppLocalizations.of(context).makeDefault, style: Theme.of(context).textTheme.bodySmall), Text(address.validationStatus == 'VERIFIED' ? AppLocalizations.of(context).addressVerified : AppLocalizations.of(context).addressNeedsReview, style: Theme.of(context).textTheme.bodySmall)])), PopupMenuButton<String>(tooltip: AppLocalizations.of(context).editAddress, onSelected: (value) { if (value == 'edit') onEdit(); if (value == 'delete') onDelete(); }, itemBuilder: (context) => [PopupMenuItem(value: 'edit', child: Text(AppLocalizations.of(context).editAddress)), PopupMenuItem(value: 'delete', child: Text(AppLocalizations.of(context).delete))])])));
}

class _AddressDraft {
  const _AddressDraft(this.label, this.addressText, this.isDefault);
  final String label;
  final String addressText;
  final bool isDefault;
}

class _AddressDialog extends StatefulWidget {
  const _AddressDialog({this.address});
  final CustomerAddress? address;
  @override
  State<_AddressDialog> createState() => _AddressDialogState();
}

class _AddressDialogState extends State<_AddressDialog> {
  late final TextEditingController label = TextEditingController(text: widget.address?.label);
  late final TextEditingController text = TextEditingController(text: widget.address?.addressText);
  late bool isDefault = widget.address?.isDefault ?? false;
  final key = GlobalKey<FormState>();
  @override
  void dispose() { label.dispose(); text.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(title: Text(widget.address == null ? l10n.addAddress : l10n.editAddress), content: Form(key: key, child: Column(mainAxisSize: MainAxisSize.min, children: [TextFormField(controller: label, decoration: InputDecoration(labelText: l10n.addressLabel), validator: (value) => value == null || value.trim().isEmpty ? l10n.requiredField : null), const SizedBox(height: AppSpacing.md), TextFormField(controller: text, maxLines: 3, decoration: InputDecoration(labelText: l10n.addressText), validator: (value) => value == null || value.trim().isEmpty ? l10n.requiredField : null), CheckboxListTile(contentPadding: EdgeInsets.zero, value: isDefault, onChanged: (value) => setState(() => isDefault = value ?? false), title: Text(l10n.makeDefault))])), actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancel)), FilledButton(onPressed: () { if (key.currentState?.validate() ?? false) Navigator.pop(context, _AddressDraft(label.text.trim(), text.text.trim(), isDefault)); }, child: Text(l10n.save))]);
  }
}
