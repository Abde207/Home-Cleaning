import 'package:flutter/material.dart';

import '../../application/booking/booking_controller.dart';
import '../../core/errors/app_exception.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/app_widgets.dart';
import 'booking_components.dart';
import 'booking_text.dart';

class BookingPage extends StatefulWidget {
  const BookingPage({required this.controller, required this.onHome, super.key});
  final BookingController controller;
  final VoidCallback onHome;
  @override State<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<BookingPage> with WidgetsBindingObserver {
  @override void didChangeAppLifecycleState(AppLifecycleState state) { if (state == AppLifecycleState.resumed && widget.controller.step == BookingStep.details && widget.controller.detail != null) widget.controller.refreshDetail(); }
  @override void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }
  @override void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); if (widget.controller.services.isEmpty && widget.controller.selection.service == null && widget.controller.step != BookingStep.details) widget.controller.load(); }
  @override Widget build(BuildContext context) => ListenableBuilder(listenable: widget.controller, builder: (context, _) {
    final c = widget.controller;
    final t = BookingText(context);
    return Scaffold(appBar: AppBar(title: Text(c.step == BookingStep.details ? AppLocalizations.of(context).bookingDetails : AppLocalizations.of(context).booking), leading: IconButton(onPressed: c.step == BookingStep.service || c.step == BookingStep.details ? widget.onHome : c.back, icon: const Icon(Icons.arrow_back))), body: SafeArea(child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 600), child: ListView(padding: const EdgeInsets.all(16), children: [
      if (c.loading && c.step != BookingStep.details) const LinearProgressIndicator(),
      if (c.error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: _errorCard(c.error!, t)),
      switch (c.step) {
        BookingStep.service => _serviceStep(t),
        BookingStep.location => _locationStep(t),
        BookingStep.schedule => _scheduleStep(t),
        BookingStep.quote => _quoteStep(t),
        BookingStep.review => _reviewStep(t),
        BookingStep.details => _detailsStep(t),
      },
    ])))));
  });

  Widget _errorCard(AppException error, BookingText t) {
    final message = error.kind == AppExceptionKind.unauthorized ? t.signIn : error.isOffline ? t.network : error.code == 'QUOTE_EXPIRED' ? t.quoteExpired : error.statusCode == 409 ? t.conflict : customerErrorText(context, error);
    return Card(color: Theme.of(context).colorScheme.errorContainer, child: Padding(padding: const EdgeInsets.all(12), child: Text(message)));
  }

  Widget _serviceStep(BookingText t) {
    final c = widget.controller;
    final service = c.selection.service;
    if (c.loading && c.services.isEmpty && service == null) return const AppLoadingView();
    if (service == null) { return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.service, style: Theme.of(context).textTheme.titleLarge),
      if (c.services.isEmpty) Text(t.noServices),
      for (final item in c.services) Card(child: ListTile(title: Text(t.ar ? item.nameAr : item.name), subtitle: Text('${item.durationMinutes} ${AppLocalizations.of(context).minutes}'), onTap: () => c.selectService(item))),
      if (c.services.isEmpty) AppButton(label: t.retry, onPressed: c.load),
    ]); }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.ar ? service.nameAr : service.name, style: Theme.of(context).textTheme.titleLarge),
      Text(service.description), Text('${service.durationMinutes} ${AppLocalizations.of(context).minutes}'),
      const SizedBox(height: 16), Text(t.extras, style: Theme.of(context).textTheme.titleMedium),
      for (final extra in service.extras) CheckboxListTile(value: c.selection.extras.containsKey(extra.id), title: Text(t.ar ? extra.nameAr : extra.name), subtitle: Text('${extra.price} JOD'), onChanged: (value) => c.setExtra(extra.id, value ?? false)),
      const SizedBox(height: 12), AppButton(label: t.next, onPressed: c.loading ? null : c.nextFromService),
      TextButton(onPressed: c.newBooking, child: Text(t.service)),
    ]);
  }

  Widget _locationStep(BookingText t) {
    final c = widget.controller;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.property, style: Theme.of(context).textTheme.titleLarge),
      if (c.properties.isEmpty && !c.loading) Text(t.noProperties),
      RadioGroup<String>(groupValue: c.selection.property?.id, onChanged: (id) { for (final p in c.properties) { if (p.id == id) c.selectProperty(p); } }, child: Column(children: [for (final p in c.properties) RadioListTile<String>(value: p.id, title: Text('${t.propertyType(p.type)} · ${p.size}'), subtitle: Text('${t.rooms}: ${p.rooms} · ${t.bathrooms}: ${p.bathrooms}'))])),
      OutlinedButton.icon(onPressed: c.loading ? null : _addProperty, icon: const Icon(Icons.add), label: Text(t.addProperty)),
      const SizedBox(height: 20), Text(t.address, style: Theme.of(context).textTheme.titleLarge),
      if (c.addresses.isEmpty && !c.loading) Text(t.noAddresses),
      RadioGroup<String>(groupValue: c.selection.address?.id, onChanged: (id) { for (final a in c.addresses) { if (a.id == id) c.selectAddress(a); } }, child: Column(children: [for (final a in c.addresses) RadioListTile<String>(value: a.id, title: Text(a.label), subtitle: Text(a.addressText))])),
      OutlinedButton.icon(onPressed: c.loading ? null : _addAddress, icon: const Icon(Icons.add), label: Text(t.addAddress)),
      const SizedBox(height: 20), AppButton(label: t.next, onPressed: c.selection.property == null || c.selection.address == null || c.loading ? null : c.nextFromLocation),
      TextButton(onPressed: c.loadLocations, child: Text(t.refresh)),
    ]);
  }

  Widget _scheduleStep(BookingText t) {
    final c = widget.controller;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.chooseTime, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 12), Text(t.slotNotice),
      const SizedBox(height: 20), OutlinedButton.icon(onPressed: _chooseSchedule, icon: const Icon(Icons.calendar_month), label: Text(c.selection.scheduledAt == null ? t.chooseTime : bookingDate(context, c.selection.scheduledAt))),
      const SizedBox(height: 12), TextFormField(initialValue: c.selection.instructions, maxLength: 2000, maxLines: 3, decoration: InputDecoration(labelText: t.instructions), onChanged: (value) { if (!c.hasUnresolvedCreate && !c.submitting) c.selection.instructions = value; }),
      AppButton(label: t.next, onPressed: c.selection.scheduledAt?.isAfter(DateTime.now()) == true ? c.nextFromSchedule : null),
    ]);
  }

  Widget _quoteStep(BookingText t) {
    final c = widget.controller;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.quote, style: Theme.of(context).textTheme.titleLarge),
      Text('${t.service}: ${t.ar ? c.selection.service?.nameAr : c.selection.service?.name}'),
      Text('${t.address}: ${c.selection.address?.addressText}'),
      Text('${t.chooseTime}: ${bookingDate(context, c.selection.scheduledAt)}'),
      TextFormField(initialValue: c.selection.promotionCode, decoration: InputDecoration(labelText: t.promotion), onChanged: c.setPromotion),
      const SizedBox(height: 16), AppButton(label: t.quote, busy: c.loading, onPressed: c.loading ? null : c.requestQuote),
    ]);
  }

  Widget _reviewStep(BookingText t) {
    final c = widget.controller;
    final quote = c.quote;
    if (quote == null) return AppButton(label: c.detail == null ? t.refreshQuote : t.resume, onPressed: c.detail == null ? c.requestQuote : c.resume);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.review, style: Theme.of(context).textTheme.titleLarge),
      Text('${t.service}: ${t.ar ? c.selection.service?.nameAr : c.selection.service?.name}'),
      Text('${t.property}: ${t.propertyType(c.selection.property?.type ?? '')} · ${c.selection.property?.size}'),
      Text('${t.address}: ${c.selection.address?.addressText}'),
      Text('${t.chooseTime}: ${bookingDate(context, c.selection.scheduledAt)}'),
      if (c.selection.instructions.isNotEmpty) Text('${t.instructions}: ${c.selection.instructions}'),
      BookingPriceCard(quote: quote, service: c.selection.service),
      if (quote.expired) Text(t.quoteExpired, style: TextStyle(color: Theme.of(context).colorScheme.error)),
      OutlinedButton(onPressed: c.loading || c.submitting ? null : c.requestQuote, child: Text(t.refreshQuote)),
      Text(t.paymentMethod, style: Theme.of(context).textTheme.titleMedium),
      RadioGroup<PaymentChoice>(groupValue: c.paymentChoice, onChanged: (choice) { if (!c.submitting && choice != null) c.choosePayment(choice); }, child: Column(children: [RadioListTile<PaymentChoice>(value: PaymentChoice.cash, title: Text(t.cash), subtitle: Text(t.cashNotice)), RadioListTile<PaymentChoice>(value: PaymentChoice.online, title: Text(t.online), subtitle: Text(t.onlineNotice))])),
      Text(t.notConfirmed), const SizedBox(height: 12),
      AppButton(label: c.detail == null ? t.confirm : t.resume, busy: c.submitting, onPressed: c.submitting || (quote.expired && c.detail == null && !c.hasUnresolvedCreate) ? null : c.submit),
      if (c.detail != null) TextButton(onPressed: c.resume, child: Text(t.resume)),
    ]);
  }

  Widget _detailsStep(BookingText t) {
    final c = widget.controller;
    if (c.loading && c.detail == null) return const AppLoadingView();
    final d = c.detail;
    if (d == null) return AppButton(label: t.retry, onPressed: c.retryDetail);
    final payment = d.latestPayment;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      BookingStatusChip(status: d.status), BookingDetailCard(booking: d), BookingTimeline(booking: d),
      if (d.status == 'TEAM_ON_THE_WAY') Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(t.noLiveLocation)),
      if (payment?.method == 'ONLINE' && payment?.status == 'PENDING') ...[Text(t.paymentPending), if (c.initiatedPayment?.checkoutUrl?.contains('mock-payments.invalid') == true) Text(t.mockGateway)],
      if (d.paymentMethod == 'CASH') Text(t.cashNotice),
      const SizedBox(height: 12), AppButton(label: t.refresh, busy: c.loading, onPressed: c.loading ? null : c.refreshDetail),
      if (payment?.method == 'ONLINE' && payment?.status == 'FAILED') OutlinedButton(onPressed: c.submitting ? null : c.retryPayment, child: Text(t.retryPayment)),
      if (d.canCancel) OutlinedButton(onPressed: c.submitting ? null : _cancel, child: Text(t.cancelBooking)),
      TextButton(onPressed: () { c.newBooking(); }, child: Text(t.newBooking)),
    ]);
  }

  Future<void> _chooseSchedule() async {
    final now = DateTime.now();
    final date = await showDatePicker(context: context, firstDate: DateTime(now.year, now.month, now.day), lastDate: now.add(const Duration(days: 365)), initialDate: widget.controller.selection.scheduledAt ?? now.add(const Duration(days: 1)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(widget.controller.selection.scheduledAt ?? now.add(const Duration(hours: 1))));
    if (time == null) return;
    final selected = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    widget.controller.schedule(selected);
  }

  Future<void> _addAddress() async {
    final t = BookingText(context);
    final label = TextEditingController(), address = TextEditingController();
    final key = GlobalKey<FormState>();
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: Text(t.addAddress), content: Form(key: key, child: Column(mainAxisSize: MainAxisSize.min, children: [TextFormField(controller: label, decoration: InputDecoration(labelText: AppLocalizations.of(context).addressLabel), validator: (v) => v == null || v.trim().isEmpty ? t.invalid : null), TextFormField(controller: address, decoration: InputDecoration(labelText: t.address), validator: (v) => v == null || v.trim().isEmpty ? t.invalid : null)])), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(AppLocalizations.of(context).cancel)), FilledButton(onPressed: () { if (key.currentState!.validate()) Navigator.pop(context, true); }, child: Text(AppLocalizations.of(context).save))]));
    if (confirmed == true) { try { await widget.controller.addAddress(label: label.text.trim(), addressText: address.text.trim()); } on Object catch (_) {} }
    label.dispose(); address.dispose();
  }

  Future<void> _addProperty() async {
    final t = BookingText(context);
    final size = TextEditingController(), rooms = TextEditingController(), bathrooms = TextEditingController();
    var type = 'APARTMENT';
    final key = GlobalKey<FormState>();
    final confirmed = await showDialog<bool>(context: context, builder: (context) => StatefulBuilder(builder: (context, setDialogState) => AlertDialog(title: Text(t.addProperty), content: Form(key: key, child: Column(mainAxisSize: MainAxisSize.min, children: [DropdownButtonFormField<String>(initialValue: type, decoration: InputDecoration(labelText: t.type), items: ['APARTMENT', 'HOUSE', 'VILLA', 'OFFICE'].map((v) => DropdownMenuItem(value: v, child: Text(t.propertyType(v)))).toList(), onChanged: (v) => setDialogState(() => type = v ?? type)), TextFormField(controller: size, decoration: InputDecoration(labelText: t.size), keyboardType: const TextInputType.numberWithOptions(decimal: true), validator: (v) => v == null || !RegExp(r'^\d{1,8}(\.\d{1,2})?$').hasMatch(v) || (double.tryParse(v) ?? 0) <= 0 ? t.invalid : null), TextFormField(controller: rooms, decoration: InputDecoration(labelText: t.rooms), keyboardType: TextInputType.number, validator: (v) => int.tryParse(v ?? '') == null || int.parse(v!) < 0 || int.parse(v) > 1000 ? t.invalid : null), TextFormField(controller: bathrooms, decoration: InputDecoration(labelText: t.bathrooms), keyboardType: TextInputType.number, validator: (v) => int.tryParse(v ?? '') == null || int.parse(v!) < 0 || int.parse(v) > 1000 ? t.invalid : null)])), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(AppLocalizations.of(context).cancel)), FilledButton(onPressed: () { if (key.currentState!.validate()) Navigator.pop(context, true); }, child: Text(AppLocalizations.of(context).save))])));
    if (confirmed == true) { try { await widget.controller.addProperty(type: type, size: size.text, rooms: int.parse(rooms.text), bathrooms: int.parse(bathrooms.text)); } on Object catch (_) {} }
    size.dispose(); rooms.dispose(); bathrooms.dispose();
  }

  Future<void> _cancel() async {
    final t = BookingText(context);
    final ok = await showDialog<bool>(context: context, builder: (context) => AlertDialog(content: Text(t.cancelQuestion), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(AppLocalizations.of(context).cancel)), FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(t.cancelBooking))]));
    if (ok == true) await widget.controller.cancel();
  }
}
