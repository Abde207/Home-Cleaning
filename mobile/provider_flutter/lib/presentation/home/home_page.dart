import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../application/provider/provider_operations_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../routing/app_router.dart';
import '../assignments/assignment_card.dart';
import '../shared/provider_scaffold.dart';

class HomePage extends StatefulWidget {
  const HomePage({
    required this.auth,
    required this.operations,
    required this.onNavigate,
    required this.onOpenAssignment,
    super.key,
  });
  final AuthController auth;
  final ProviderOperationsController operations;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String> onOpenAssignment;
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.operations.loadDashboard(widget.auth.identity!),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final provider = widget.auth.providerContext!;
    return ProviderScaffold(
      title: l10n.home,
      route: AppRoute.home,
      onNavigate: widget.onNavigate,
      actions: [
        if (provider.identity.canViewSettlements)
          IconButton(
            onPressed: () => widget.onNavigate(AppRoute.financials),
            icon: const Icon(Icons.account_balance_wallet_outlined),
            tooltip: l10n.financials,
          ),
        IconButton(
          onPressed: () => widget.operations.loadDashboard(provider.identity),
          icon: const Icon(Icons.refresh),
          tooltip: l10n.retry,
        ),
      ],
      body: ListenableBuilder(
        listenable: widget.operations,
        builder: (context, _) {
          final ops = widget.operations;
          if (ops.dashboardLoading &&
              ops.pendingAssignments.isEmpty &&
              ops.activeAssignments.isEmpty) {
            return const AppLoadingView();
          }
          if (ops.dashboardError != null &&
              ops.pendingAssignments.isEmpty &&
              ops.activeAssignments.isEmpty) {
            return AppErrorView(
              message: providerErrorText(context, ops.dashboardError),
              onRetry: () => ops.loadDashboard(provider.identity),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ops.loadDashboard(provider.identity),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                AppCard(
                  color: AppTheme.operational,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.welcome,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(color: Colors.white70),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        provider.identity.name ?? provider.identity.phone,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        provider.teams
                            .map(
                              (team) =>
                                  '${team.name}: ${l10n.statusLabel(team.status)}',
                            )
                            .join(' · '),
                        style: const TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _SectionTitle(
                  title: l10n.pendingOffers,
                  onTap: () => widget.onNavigate(AppRoute.assignments),
                ),
                if (ops.pendingAssignments.isEmpty)
                  AppEmptyView(message: l10n.noPendingOffers)
                else
                  ...ops.pendingAssignments.map(
                    (row) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: AssignmentCard(
                        assignment: row,
                        onTap: () => widget.onOpenAssignment(row.id),
                      ),
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
                _SectionTitle(
                  title: l10n.acceptedActive,
                  onTap: () => widget.onNavigate(AppRoute.activeJob),
                ),
                if (ops.activeAssignments.isEmpty)
                  AppEmptyView(message: l10n.noActiveAssignments)
                else
                  ...ops.activeAssignments.map(
                    (row) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: AssignmentCard(
                        assignment: row,
                        onTap: () => widget.onOpenAssignment(row.id),
                      ),
                    ),
                  ),
                if (provider.identity.canViewCashWorklist) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    l10n.cashWorklist,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (ops.cashAssignments.isEmpty)
                    AppEmptyView(message: l10n.noCashDue)
                  else
                    ...ops.cashAssignments.map(
                      (row) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: AssignmentCard(
                          assignment: row,
                          onTap: () => widget.onOpenAssignment(row.id),
                        ),
                      ),
                    ),
                ],
                if (ops.dashboardError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: Text(
                      providerErrorText(context, ops.dashboardError!),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.onTap});
  final String title;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
      ),
      TextButton(
        onPressed: onTap,
        child: Text(AppLocalizations.of(context).viewAll),
      ),
    ],
  );
}
