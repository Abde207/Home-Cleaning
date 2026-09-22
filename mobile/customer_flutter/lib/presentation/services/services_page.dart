import 'package:flutter/material.dart';

import '../../application/customer/customer_controller.dart';
import '../../domain/customer/customer_models.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/errors/customer_error_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../shared/customer_scaffold.dart';

class ServicesPage extends StatefulWidget {
  const ServicesPage({required this.controller, required this.onNavigate, required this.onBook, super.key});
  final CustomerController controller;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<CleaningService> onBook;
  @override
  State<ServicesPage> createState() => _ServicesPageState();
}

class _ServicesPageState extends State<ServicesPage> {
  @override
  void initState() { super.initState(); widget.controller.loadServices(); }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return CustomerScaffold(title: l10n.services, currentRoute: AppRoute.services, onNavigate: widget.onNavigate, body: RefreshIndicator(onRefresh: widget.controller.loadServices, child: ListenableBuilder(listenable: widget.controller, builder: (context, _) {
      if (widget.controller.loadingServices && widget.controller.services.isEmpty) return const AppLoadingView();
      if (widget.controller.servicesError != null && widget.controller.services.isEmpty) return AppErrorView(message: customerErrorText(context, widget.controller.servicesError), onRetry: widget.controller.loadServices);
      if (widget.controller.services.isEmpty) return ListView(children: [SizedBox(height: MediaQuery.sizeOf(context).height * .3), AppEmptyView(message: l10n.noServices)]);
      return ListView.separated(padding: const EdgeInsets.all(AppSpacing.md), itemCount: widget.controller.services.length, separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.md), itemBuilder: (context, index) => ServiceCard(service: widget.controller.services[index], onTap: () => _showDetails(widget.controller.services[index])));
    })));
  }

  void _showDetails(CleaningService service) {
    showModalBottomSheet<void>(context: context, isScrollControlled: true, showDragHandle: true, builder: (context) {
      final l10n = AppLocalizations.of(context);
      final arabic = Localizations.localeOf(context).languageCode == 'ar';
      return SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(arabic ? service.nameAr : service.name, style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: AppSpacing.sm), Text(service.description), const SizedBox(height: AppSpacing.md), Row(children: [const Icon(Icons.schedule), const SizedBox(width: AppSpacing.sm), Text('${l10n.duration}: ${service.durationMinutes} ${l10n.minutes}'), const Spacer(), Text('${l10n.startingFrom} ${service.basePrice} JOD', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary))]), if (service.extras.isNotEmpty) ...[const SizedBox(height: AppSpacing.md), Text(l10n.serviceDetails, style: Theme.of(context).textTheme.titleMedium), ...service.extras.map((extra) => ListTile(contentPadding: EdgeInsets.zero, title: Text(arabic ? extra.nameAr : extra.name), trailing: Text('${extra.price} JOD')))], const SizedBox(height: AppSpacing.md), AppButton(label: l10n.bookNow, onPressed: () { Navigator.pop(context); widget.onBook(service); })])));
    });
  }
}

class ServiceCard extends StatelessWidget {
  const ServiceCard({required this.service, required this.onTap, super.key});
  final CleaningService service;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final arabic = Localizations.localeOf(context).languageCode == 'ar';
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(children: [
            Container(width: 56, height: 56, decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: .1), borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.cleaning_services, color: AppTheme.primary)),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(arabic ? service.nameAr : service.name, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text('${service.durationMinutes} ${l10n.minutes} · ${l10n.startingFrom} ${service.basePrice} JOD', style: Theme.of(context).textTheme.bodySmall),
              if (service.description.isNotEmpty) Text(service.description, maxLines: 2, overflow: TextOverflow.ellipsis),
            ])),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}
