import 'package:flutter/material.dart';

import '../../application/provider/provider_management_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../domain/provider/provider_models.dart';
import '../../routing/app_router.dart';
import '../shared/provider_scaffold.dart';

class FinancialsPage extends StatefulWidget {
  const FinancialsPage({required this.controller, required this.onNavigate, super.key});
  final ProviderManagementController controller;
  final ValueChanged<AppRoute> onNavigate;
  @override
  State<FinancialsPage> createState() => _FinancialsPageState();
}

class _FinancialsPageState extends State<FinancialsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.controller.loadSettlements());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ProviderScaffold(
      title: l10n.settlements,
      route: AppRoute.financials,
      onNavigate: widget.onNavigate,
      actions: [IconButton(onPressed: () {
        final id = widget.controller.selectedSettlement?.summary.id;
        if (id == null) {
          widget.controller.loadSettlements();
        } else {
          widget.controller.openSettlement(id);
        }
      }, icon: const Icon(Icons.refresh), tooltip: l10n.retry)],
      body: ListenableBuilder(listenable: widget.controller, builder: (context, _) {
        final state = widget.controller;
        if (state.settlementDetailLoading || (state.settlementsLoading && state.settlements.isEmpty)) return const AppLoadingView();
        if (state.settlementsError != null && state.selectedSettlement == null && state.settlements.isEmpty) {
          return AppErrorView(message: providerErrorText(context, state.settlementsError!), onRetry: state.loadSettlements);
        }
        if (state.selectedSettlement != null) return _detail(state.selectedSettlement!);
        if (state.settlements.isEmpty) return AppEmptyView(message: l10n.noSettlements);
        return RefreshIndicator(onRefresh: state.loadSettlements, child: ListView.builder(
          padding: const EdgeInsets.all(AppSpacing.md),
          itemCount: state.settlements.length,
          itemBuilder: (context, index) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _summaryCard(state.settlements[index]),
          ),
        ));
      }),
    );
  }

  Widget _summaryCard(ProviderSettlementSummary row) {
    final l10n = AppLocalizations.of(context);
    return AppCard(child: InkWell(
      onTap: () => widget.controller.openSettlement(row.id),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Text(row.reference, style: Theme.of(context).textTheme.titleMedium)), StatusBadge(status: row.status)]),
        const SizedBox(height: AppSpacing.sm),
        Text(row.company.name),
        Text('${l10n.settlementPeriod}: ${_day(row.periodStart)} — ${_day(row.periodEnd)}'),
        const SizedBox(height: AppSpacing.sm),
        Text('${l10n.payableAmount}: ${row.total} ${row.currency}', style: Theme.of(context).textTheme.titleLarge),
        Text('${l10n.paidAmount}: ${row.paidAmount} ${row.currency} · ${l10n.workItems}: ${row.workItemCount}'),
        if (row.latestReconciliationStatus != null) Text('${l10n.reconciliation}: ${l10n.statusLabel(row.latestReconciliationStatus!)}'),
      ]),
    ));
  }

  Widget _detail(ProviderSettlementDetail detail) {
    final l10n = AppLocalizations.of(context);
    final row = detail.summary;
    return ListView(padding: const EdgeInsets.all(AppSpacing.md), children: [
      Row(children: [
        IconButton(onPressed: widget.controller.closeSettlement, icon: const Icon(Icons.arrow_back)),
        Expanded(child: Text(row.reference, style: Theme.of(context).textTheme.headlineSmall)),
        StatusBadge(status: row.status),
      ]),
      if (widget.controller.settlementsError != null) Text(providerErrorText(context, widget.controller.settlementsError!)),
      const SizedBox(height: AppSpacing.sm),
      _summaryCard(row),
      const SizedBox(height: AppSpacing.lg),
      Text(l10n.completedWork, style: Theme.of(context).textTheme.titleLarge),
      if (detail.workItems.isEmpty) AppEmptyView(message: l10n.noWorkItems) else
        ...detail.workItems.map((item) => ListTile(
          leading: const Icon(Icons.cleaning_services_outlined),
          title: Text('${item.bookingNumber} · ${item.amount} ${row.currency}'),
          subtitle: Text('${l10n.isArabic ? item.serviceNameAr ?? item.serviceName ?? '' : item.serviceName ?? item.serviceNameAr ?? ''} · ${_day(item.scheduledAt)}'),
        )),
      const SizedBox(height: AppSpacing.md),
      Text(l10n.payouts, style: Theme.of(context).textTheme.titleLarge),
      if (detail.payouts.isEmpty) AppEmptyView(message: l10n.noPayouts) else
        ...detail.payouts.map((payout) => ListTile(
          leading: const Icon(Icons.payments_outlined),
          title: Text('${payout.amount} ${row.currency} · ${l10n.statusLabel(payout.direction)}'),
          subtitle: Text('${payout.reference} · ${_day(payout.paidAt)}'),
        )),
      const SizedBox(height: AppSpacing.md),
      Text(l10n.reconciliation, style: Theme.of(context).textTheme.titleLarge),
      Text(detail.reconciliationStatus == null
          ? l10n.notReconciled
          : '${l10n.statusLabel(detail.reconciliationStatus!)} · ${l10n.difference}: ${detail.reconciliationDifference} ${row.currency}'),
      const SizedBox(height: AppSpacing.lg),
      Text(l10n.readOnlyFinancialNotice, style: Theme.of(context).textTheme.bodySmall),
    ]);
  }

  String _day(DateTime value) => MaterialLocalizations.of(context).formatMediumDate(value.toLocal());
}
