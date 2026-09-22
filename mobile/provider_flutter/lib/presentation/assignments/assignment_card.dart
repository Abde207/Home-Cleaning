import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../domain/provider/provider_models.dart';

class AssignmentCard extends StatelessWidget {
  const AssignmentCard({
    required this.assignment,
    required this.onTap,
    super.key,
  });
  final ProviderAssignmentSummary assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final serviceName = l10n.isArabic
        ? assignment.service.nameAr
        : assignment.service.name;
    return AppCard(
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    assignment.bookingNumber,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                StatusBadge(status: assignment.status),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(serviceName),
            Text(
              '${assignment.team.name} · ${DateFormat.yMMMd(locale).add_jm().format(assignment.startsAt.toLocal())}',
            ),
            Text(
              assignment.addressText,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (assignment.cash != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${l10n.cashRequired}: ${assignment.cash!.expectedAmount} ${assignment.cash!.currency} · ${l10n.statusLabel(assignment.cash!.collectionState)}',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
