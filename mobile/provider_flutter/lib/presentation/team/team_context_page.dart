import 'package:flutter/material.dart';

import '../../application/auth/auth_controller.dart';
import '../../application/provider/provider_management_controller.dart';
import '../../core/errors/provider_error_text.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../domain/provider/provider_models.dart';
import '../../routing/app_router.dart';
import '../shared/provider_scaffold.dart';

class TeamContextPage extends StatefulWidget {
  const TeamContextPage({required this.auth, required this.controller, required this.onNavigate, super.key});
  final AuthController auth;
  final ProviderManagementController controller;
  final ValueChanged<AppRoute> onNavigate;
  @override
  State<TeamContextPage> createState() => _TeamContextPageState();
}

class _TeamContextPageState extends State<TeamContextPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.controller.loadTeams());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final manager = widget.auth.identity!.providerScopes.any((scope) => scope.isManager);
    return ProviderScaffold(
      title: l10n.teamManagement,
      route: AppRoute.team,
      onNavigate: widget.onNavigate,
      actions: [
        if (manager && widget.controller.selectedTeam == null)
          IconButton(icon: const Icon(Icons.add), tooltip: l10n.createTeam, onPressed: () => _editTeam()),
        IconButton(icon: const Icon(Icons.refresh), tooltip: l10n.retry, onPressed: () {
          final id = widget.controller.selectedTeam?.team.id;
          if (id == null) {
            widget.controller.loadTeams();
          } else {
            widget.controller.openTeam(id);
          }
        }),
      ],
      body: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          final state = widget.controller;
          if (state.teamDetailLoading || (state.teamsLoading && state.teams.isEmpty)) return const AppLoadingView();
          if (state.teamsError != null && state.selectedTeam == null && state.teams.isEmpty) {
            return AppErrorView(message: providerErrorText(context, state.teamsError!), onRetry: state.loadTeams);
          }
          if (state.selectedTeam != null) return _detail(context, state.selectedTeam!, manager);
          if (state.teams.isEmpty) return AppEmptyView(message: l10n.noTeams);
          return RefreshIndicator(
            onRefresh: state.loadTeams,
            child: ListView.builder(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: state.teams.length,
              itemBuilder: (context, index) {
                final team = state.teams[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AppCard(child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.groups_outlined),
                    title: Text(team.name),
                    subtitle: Text('${team.internalCode} · ${l10n.capacity}: ${team.capacity}'),
                    trailing: StatusBadge(status: team.status),
                    onTap: () => state.openTeam(team.id),
                  )),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _detail(BuildContext context, ProviderTeamDetail detail, bool manager) {
    final l10n = AppLocalizations.of(context);
    final state = widget.controller;
    final team = detail.team;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Row(children: [
          IconButton(onPressed: state.closeTeam, icon: const Icon(Icons.arrow_back)),
          Expanded(child: Text(team.name, style: Theme.of(context).textTheme.headlineSmall)),
          if (manager) IconButton(onPressed: () => _editTeam(team), icon: const Icon(Icons.edit_outlined), tooltip: l10n.editTeam),
        ]),
        if (state.teamsError != null) Padding(padding: const EdgeInsets.only(bottom: AppSpacing.sm), child: Text(providerErrorText(context, state.teamsError!))),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(detail.company.name, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text('${team.internalCode} · ${l10n.capacity}: ${team.capacity}'),
          const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<String>(
            key: ValueKey(team.status), initialValue: team.status,
            decoration: InputDecoration(labelText: l10n.teamStatus),
            items: const ['AVAILABLE', 'BUSY', 'OFFLINE', 'PAUSED'].map((status) => DropdownMenuItem(value: status, child: Text(l10n.statusLabel(status)))).toList(),
            onChanged: state.teamCommandBusy ? null : (value) { if (value != null && value != team.status) state.updateStatus(team.id, value); },
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(detail.locationAt == null || detail.latitude == null || detail.longitude == null
              ? l10n.noTeamLocation
              : '${l10n.lastLocation}: ${detail.latitude!.toStringAsFixed(5)}, ${detail.longitude!.toStringAsFixed(5)} · ${_date(detail.locationAt!)}'),
        ])),
        const SizedBox(height: AppSpacing.lg),
        _heading(l10n.teamMembers),
        if (state.members.isEmpty) AppEmptyView(message: l10n.noTeamMembers) else
          ...state.members.map((member) => ListTile(leading: const Icon(Icons.person_outline), title: Text(member.name ?? member.id), subtitle: Text(l10n.statusLabel(member.role)))),
        const SizedBox(height: AppSpacing.md),
        Row(children: [Expanded(child: _heading(l10n.availability)), IconButton(onPressed: state.teamCommandBusy ? null : () => _addAvailability(team.id), icon: const Icon(Icons.add), tooltip: l10n.addAvailability)]),
        if (state.availability.isEmpty) AppEmptyView(message: l10n.noAvailability) else
          ...state.availability.map((row) => Padding(padding: const EdgeInsets.only(bottom: AppSpacing.sm), child: AppCard(child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(row.available ? Icons.event_available : Icons.event_busy),
            title: Text('${_date(row.startsAt)} — ${_date(row.endsAt)}'),
            subtitle: Text(row.available ? l10n.available : l10n.unavailableStatus),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(icon: const Icon(Icons.edit_calendar_outlined), onPressed: state.teamCommandBusy ? null : () => _addAvailability(team.id, row)),
              IconButton(icon: const Icon(Icons.delete_outline), onPressed: state.teamCommandBusy ? null : () => state.removeAvailability(team.id, row.id)),
            ]),
          )))),
        const SizedBox(height: AppSpacing.lg),
        _heading(l10n.serviceCapabilities),
        if (state.serviceOptions.isEmpty) AppEmptyView(message: l10n.noCapabilities) else
          Wrap(spacing: AppSpacing.sm, children: state.serviceOptions.map((service) => FilterChip(
            label: Text(l10n.isArabic ? service.nameAr : service.name),
            selected: state.capabilityIds.contains(service.id),
            onSelected: manager && !state.teamCommandBusy ? (selected) {
              final next = {...state.capabilityIds};
              selected ? next.add(service.id) : next.remove(service.id);
              state.replaceCapabilities(team.id, next);
            } : null,
          )).toList()),
      ],
    );
  }

  Widget _heading(String value) => Text(value, style: Theme.of(context).textTheme.titleLarge);
  String _date(DateTime value) => '${MaterialLocalizations.of(context).formatMediumDate(value.toLocal())} ${TimeOfDay.fromDateTime(value.toLocal()).format(context)}';

  Future<void> _editTeam([ProviderTeam? team]) async {
    final l10n = AppLocalizations.of(context);
    final name = TextEditingController(text: team?.name);
    final code = TextEditingController(text: team?.internalCode);
    final capacity = TextEditingController(text: '${team?.capacity ?? 1}');
    var active = team?.active ?? true;
    final companies = widget.auth.providerContext!.companies;
    var companyId = team?.companyId ?? companies.first.id;
    final submit = await showProviderBottomSheet<bool>(context, child: StatefulBuilder(builder: (context, setSheetState) => Column(mainAxisSize: MainAxisSize.min, children: [
      Text(team == null ? l10n.createTeam : l10n.editTeam, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: AppSpacing.md),
      TextField(controller: name, decoration: InputDecoration(labelText: l10n.teamName)),
      if (team == null && companies.length > 1) DropdownButtonFormField<String>(
        initialValue: companyId,
        decoration: InputDecoration(labelText: l10n.companies),
        items: companies.map((company) => DropdownMenuItem(value: company.id, child: Text(company.name))).toList(),
        onChanged: (value) { if (value != null) setSheetState(() => companyId = value); },
      ),
      if (team == null) TextField(controller: code, decoration: InputDecoration(labelText: l10n.internalCode)),
      TextField(controller: capacity, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: l10n.capacity)),
      if (team != null) SwitchListTile(value: active, title: Text(l10n.activeTeam), onChanged: (value) => setSheetState(() => active = value)),
      const SizedBox(height: AppSpacing.md),
      AppButton(label: l10n.confirm, onPressed: () => Navigator.pop(context, true)),
    ])));
    if (submit != true || !mounted) return;
    final count = int.tryParse(capacity.text);
    if (name.text.trim().isEmpty || count == null || count < 1) return;
    if (team == null) {
      if (code.text.trim().isEmpty) return;
      await widget.controller.createTeam(companyId: companyId, internalCode: code.text.trim().toUpperCase(), name: name.text.trim(), capacity: count);
    } else {
      await widget.controller.updateTeam(id: team.id, name: name.text.trim(), capacity: count, active: active);
    }
  }

  Future<void> _addAvailability(String teamId, [ProviderTeamAvailability? row]) async {
    final l10n = AppLocalizations.of(context);
    final start = TextEditingController(text: (row?.startsAt ?? DateTime.now().toUtc().add(const Duration(hours: 1))).toIso8601String());
    final end = TextEditingController(text: (row?.endsAt ?? DateTime.now().toUtc().add(const Duration(hours: 3))).toIso8601String());
    var available = row?.available ?? true;
    final submit = await showProviderBottomSheet<bool>(context, child: StatefulBuilder(builder: (context, setSheetState) => Column(mainAxisSize: MainAxisSize.min, children: [
      Text(l10n.addAvailability, style: Theme.of(context).textTheme.titleLarge),
      TextField(controller: start, decoration: InputDecoration(labelText: l10n.startsAt)),
      TextField(controller: end, decoration: InputDecoration(labelText: l10n.endsAt)),
      SwitchListTile(value: available, title: Text(l10n.available), onChanged: (value) => setSheetState(() => available = value)),
      const SizedBox(height: AppSpacing.md),
      AppButton(label: l10n.confirm, onPressed: () => Navigator.pop(context, true)),
    ])));
    if (submit != true) return;
    final startsAt = DateTime.tryParse(start.text), endsAt = DateTime.tryParse(end.text);
    if (startsAt != null && endsAt != null && endsAt.isAfter(startsAt)) {
      if (row == null) {
        await widget.controller.addAvailability(teamId, startsAt, endsAt, available);
      } else {
        await widget.controller.updateAvailability(teamId, row.id, startsAt, endsAt, available);
      }
    }
  }
}
