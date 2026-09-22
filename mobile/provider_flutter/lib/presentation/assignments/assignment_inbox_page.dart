import 'package:flutter/material.dart';

import '../../application/provider/provider_operations_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../domain/provider/provider_models.dart';
import '../../routing/app_router.dart';
import '../shared/provider_scaffold.dart';
import 'assignment_card.dart';

class AssignmentInboxPage extends StatefulWidget {
  const AssignmentInboxPage({
    required this.controller,
    required this.onNavigate,
    required this.onOpenAssignment,
    this.initialView = AssignmentView.pending,
    super.key,
  });
  final ProviderOperationsController controller;
  final ValueChanged<AppRoute> onNavigate;
  final ValueChanged<String> onOpenAssignment;
  final AssignmentView initialView;

  @override
  State<AssignmentInboxPage> createState() => _AssignmentInboxPageState();
}

class _AssignmentInboxPageState extends State<AssignmentInboxPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.loadAssignments(widget.initialView),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ProviderScaffold(
      title: l10n.assignments,
      route: AppRoute.assignments,
      onNavigate: widget.onNavigate,
      actions: [
        IconButton(
          onPressed: () => widget.controller.loadAssignments(),
          icon: const Icon(Icons.refresh),
          tooltip: l10n.retry,
        ),
      ],
      body: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: SegmentedButton<AssignmentView>(
                  segments: [
                    ButtonSegment(
                      value: AssignmentView.pending,
                      label: Text(l10n.pendingOffers),
                    ),
                    ButtonSegment(
                      value: AssignmentView.active,
                      label: Text(l10n.acceptedActive),
                    ),
                    ButtonSegment(
                      value: AssignmentView.history,
                      label: Text(l10n.history),
                    ),
                  ],
                  selected: {controller.inboxView},
                  onSelectionChanged: (value) =>
                      controller.loadAssignments(value.single),
                ),
              ),
              Expanded(
                child: controller.inboxLoading
                    ? const AppLoadingView()
                    : controller.inboxError != null
                    ? AppErrorView(
                        message: providerErrorText(
                          context,
                          controller.inboxError,
                        ),
                        onRetry: controller.loadAssignments,
                      )
                    : controller.assignments.isEmpty
                    ? AppEmptyView(message: l10n.noAssignments)
                    : RefreshIndicator(
                        onRefresh: controller.loadAssignments,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            0,
                            AppSpacing.md,
                            AppSpacing.md,
                          ),
                          itemCount: controller.assignments.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (_, index) {
                            final row = controller.assignments[index];
                            return AssignmentCard(
                              assignment: row,
                              onTap: () => widget.onOpenAssignment(row.id),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
