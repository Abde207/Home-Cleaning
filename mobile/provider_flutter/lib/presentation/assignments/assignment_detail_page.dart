import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../application/provider/provider_operations_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../domain/provider/provider_models.dart';
import '../../routing/app_router.dart';
import '../shared/provider_scaffold.dart';

class AssignmentDetailPage extends StatefulWidget {
  const AssignmentDetailPage({
    required this.assignmentId,
    required this.controller,
    required this.onNavigate,
    this.onOpenActiveJob,
    this.activeJob = false,
    super.key,
  });
  final String assignmentId;
  final ProviderOperationsController controller;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String>? onOpenActiveJob;
  final bool activeJob;
  @override
  State<AssignmentDetailPage> createState() => _AssignmentDetailPageState();
}

class _AssignmentDetailPageState extends State<AssignmentDetailPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.loadDetail(widget.assignmentId),
    );
  }

  Future<void> _reject() async {
    final l10n = AppLocalizations.of(context);
    final text = TextEditingController();
    final reason = await showProviderBottomSheet<String>(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.rejectOffer, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: text,
            maxLength: 500,
            decoration: InputDecoration(labelText: l10n.rejectionReason),
          ),
          AppButton(
            label: l10n.rejectOffer,
            icon: Icons.close,
            onPressed: () => Navigator.pop(context, text.text),
          ),
        ],
      ),
    );
    if (reason != null) {
      await widget.controller.reject(widget.assignmentId, reason);
    }
  }

  Future<void> _confirm(String title, Future<bool> Function() command) async {
    final l10n = AppLocalizations.of(context);
    if (await showConfirmationDialog(
      context,
      title: title,
      message: l10n.confirmOperationalAction,
    )) {
      await command();
    }
  }

  Future<void> _proof() async {
    final l10n = AppLocalizations.of(context);
    final reference = TextEditingController();
    final mime = TextEditingController(text: 'image/jpeg');
    final size = TextEditingController();
    final proof = await showProviderBottomSheet<CompletionProofInput>(
      context,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.completionProof, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.sm),
          Text(l10n.proofReferenceHelp),
          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('proof-reference'),
            controller: reference,
            maxLength: 500,
            decoration: InputDecoration(labelText: l10n.proofReference),
          ),
          TextField(
            key: const Key('proof-mime'),
            controller: mime,
            maxLength: 80,
            decoration: InputDecoration(labelText: l10n.proofMimeType),
          ),
          TextField(
            key: const Key('proof-size'),
            controller: size,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: l10n.proofByteSize),
          ),
          AppButton(
            label: l10n.submitProof,
            icon: Icons.verified_outlined,
            onPressed: () {
              final bytes = int.tryParse(size.text.trim());
              if (reference.text.trim().isNotEmpty &&
                  mime.text.trim().isNotEmpty &&
                  bytes != null &&
                  bytes > 0) {
                Navigator.pop(
                  context,
                  CompletionProofInput(
                    storageKey: reference.text.trim(),
                    mimeType: mime.text.trim(),
                    byteSize: bytes,
                  ),
                );
              }
            },
          ),
        ],
      ),
    );
    if (proof != null) {
      await widget.controller.submitCompletionProof(widget.assignmentId, proof);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ProviderScaffold(
      title: widget.activeJob ? l10n.activeJob : l10n.assignmentDetails,
      route: widget.activeJob ? AppRoute.activeJob : AppRoute.assignmentDetails,
      onNavigate: widget.onNavigate,
      actions: [
        IconButton(
          onPressed: () => widget.controller.loadDetail(widget.assignmentId),
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          if (controller.detailLoading) {
            return const AppLoadingView();
          }
          if (controller.detailError != null && controller.detail == null) {
            return AppErrorView(
              message: providerErrorText(context, controller.detailError),
              onRetry: () => controller.loadDetail(widget.assignmentId),
            );
          }
          final detail = controller.detail;
          if (detail == null || detail.summary.id != widget.assignmentId) {
            return const AppLoadingView();
          }
          final row = detail.summary;
          final locale = Localizations.localeOf(context).toLanguageTag();
          final busy = controller.isAssignmentBusy(row.id);
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            row.bookingNumber,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ),
                        StatusBadge(status: row.status),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(l10n.isArabic ? row.service.nameAr : row.service.name),
                    Text(
                      '${DateFormat.yMMMMEEEEd(locale).add_jm().format(row.startsAt.toLocal())} – ${DateFormat.jm(locale).format(row.endsAt.toLocal())}',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _Info(
                title: l10n.team,
                values: [
                  row.team.name,
                  l10n.statusLabel(row.team.status),
                  row.company.name,
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _Info(
                title: l10n.location,
                values: [
                  if (detail.addressLabel != null) detail.addressLabel!,
                  row.addressText,
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _Info(
                title: l10n.property,
                values: [
                  '${l10n.propertyType}: ${l10n.statusLabel(detail.property.type)}',
                  '${l10n.size}: ${detail.property.size}',
                  '${l10n.rooms}: ${detail.property.rooms}',
                  '${l10n.bathrooms}: ${detail.property.bathrooms}',
                ],
              ),
              if (detail.extras.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                _Info(
                  title: l10n.extras,
                  values: detail.extras
                      .map((extra) => '${extra.name} × ${extra.quantity}')
                      .toList(),
                ),
              ],
              if (detail.instructions?.isNotEmpty == true) ...[
                const SizedBox(height: AppSpacing.md),
                _Info(title: l10n.instructions, values: [detail.instructions!]),
              ],
              if (row.cash != null) ...[
                const SizedBox(height: AppSpacing.md),
                _Info(
                  title: l10n.cashRequired,
                  values: [
                    '${row.cash!.expectedAmount} ${row.cash!.currency}',
                    l10n.statusLabel(row.cash!.collectionState),
                  ],
                ),
              ],
              if (row.status == 'COMPLETED') ...[
                const SizedBox(height: AppSpacing.md),
                _Info(
                  title: l10n.completionProof,
                  values: detail.completionProofs.isEmpty
                      ? [l10n.noProof]
                      : detail.completionProofs
                            .map((proof) => '${proof.storageKey} · ${proof.mimeType} · ${proof.byteSize}')
                            .toList(),
                ),
              ],
              if (controller.detailError != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  providerErrorText(context, controller.detailError),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              if (row.canAccept || row.canReject) ...[
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    if (row.canReject)
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: busy ? null : _reject,
                          icon: const Icon(Icons.close),
                          label: Text(l10n.rejectOffer),
                        ),
                      ),
                    if (row.canReject && row.canAccept)
                      const SizedBox(width: AppSpacing.sm),
                    if (row.canAccept)
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: busy
                              ? null
                              : () async {
                                  if (await showConfirmationDialog(
                                    context,
                                    title: l10n.acceptOffer,
                                    message: l10n.acceptOfferConfirmation,
                                  )) {
                                    if (await controller.accept(row.id)) {
                                      widget.onOpenActiveJob?.call(row.id);
                                    }
                                  }
                                },
                          icon: busy
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.check),
                          label: Text(l10n.acceptOffer),
                        ),
                      ),
                  ],
                ),
              ],
              if (row.canMarkOnTheWay ||
                  row.canStartCleaning ||
                  row.canCompleteCleaning ||
                  row.canMarkTeamNoShow ||
                  row.canMarkCustomerNoShow ||
                  detail.canSubmitCompletionProof ||
                  row.cash?.canCollect == true) ...[
                const SizedBox(height: AppSpacing.lg),
                if (row.canMarkOnTheWay)
                  AppButton(
                    label: l10n.onTheWay,
                    icon: Icons.directions_car_outlined,
                    onPressed: busy
                        ? null
                        : () => _confirm(
                            l10n.onTheWay,
                            () => controller.markOnTheWay(row.id),
                          ),
                  ),
                if (row.canStartCleaning)
                  AppButton(
                    label: l10n.startWork,
                    icon: Icons.cleaning_services_outlined,
                    onPressed: busy
                        ? null
                        : () => _confirm(
                            l10n.startWork,
                            () => controller.startCleaning(row.id),
                          ),
                  ),
                if (row.canCompleteCleaning)
                  AppButton(
                    label: l10n.completeWork,
                    icon: Icons.task_alt,
                    onPressed: busy
                        ? null
                        : () => _confirm(
                            l10n.completeWork,
                            () => controller.completeCleaning(row.id),
                          ),
                  ),
                if (detail.canSubmitCompletionProof)
                  OutlinedButton.icon(
                    onPressed: busy ? null : _proof,
                    icon: const Icon(Icons.verified_outlined),
                    label: Text(l10n.submitProof),
                  ),
                if (row.cash?.canCollect == true)
                  FilledButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            if (await showConfirmationDialog(
                              context,
                              title: l10n.collectCash,
                              message: l10n.cashConfirmation,
                            )) {
                              await controller.collectCash(
                                row.id,
                                row.cash!.expectedAmount,
                              );
                            }
                          },
                    icon: const Icon(Icons.payments_outlined),
                    label: Text(l10n.collectCash),
                  ),
                if (row.canMarkTeamNoShow)
                  TextButton.icon(
                    onPressed: busy
                        ? null
                        : () => _confirm(
                            l10n.teamNoShow,
                            () => controller.markTeamNoShow(row.id),
                          ),
                    icon: const Icon(Icons.group_off_outlined),
                    label: Text(l10n.teamNoShow),
                  ),
                if (row.canMarkCustomerNoShow)
                  TextButton.icon(
                    onPressed: busy
                        ? null
                        : () => _confirm(
                            l10n.customerNoShow,
                            () => controller.markCustomerNoShow(row.id),
                          ),
                    icon: const Icon(Icons.person_off_outlined),
                    label: Text(l10n.customerNoShow),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.title, required this.values});
  final String title;
  final List<String> values;
  @override
  Widget build(BuildContext context) => AppCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        ...values.map(Text.new),
      ],
    ),
  );
}
