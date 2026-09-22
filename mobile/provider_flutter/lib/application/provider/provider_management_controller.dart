import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';
import '../../domain/provider/provider_models.dart';
import '../../domain/provider/provider_repository.dart';

class ProviderManagementController extends ChangeNotifier {
  ProviderManagementController(this._repository);

  final ProviderRepository _repository;

  bool teamsLoading = false;
  bool teamDetailLoading = false;
  bool teamCommandBusy = false;
  AppException? teamsError;
  List<ProviderTeam> teams = const [];
  ProviderTeamDetail? selectedTeam;
  List<ProviderTeamMember> members = const [];
  List<ProviderTeamAvailability> availability = const [];
  List<ProviderServiceOption> serviceOptions = const [];
  Set<String> capabilityIds = const {};

  bool settlementsLoading = false;
  bool settlementDetailLoading = false;
  AppException? settlementsError;
  List<ProviderSettlementSummary> settlements = const [];
  ProviderSettlementDetail? selectedSettlement;

  Future<void> loadTeams() async {
    if (teamsLoading) return;
    teamsLoading = true;
    teamsError = null;
    notifyListeners();
    try {
      teams = await _repository.listTeams();
    } on AppException catch (error) {
      teamsError = error;
    } on Object catch (error) {
      teamsError = AppException(kind: AppExceptionKind.serialization, message: 'Invalid team response.', cause: error);
    } finally {
      teamsLoading = false;
      notifyListeners();
    }
  }

  Future<void> openTeam(String id) async {
    teamDetailLoading = true;
    teamsError = null;
    selectedTeam = null;
    notifyListeners();
    try {
      final results = await Future.wait<Object>([
        _repository.teamDetail(id),
        _repository.teamMembers(id),
        _repository.teamAvailability(id),
        _repository.teamCapabilities(id),
        _repository.listServiceOptions(),
      ]);
      selectedTeam = results[0] as ProviderTeamDetail;
      members = results[1] as List<ProviderTeamMember>;
      availability = results[2] as List<ProviderTeamAvailability>;
      capabilityIds = Set.unmodifiable(results[3] as Set<String>);
      serviceOptions = results[4] as List<ProviderServiceOption>;
    } on AppException catch (error) {
      teamsError = error;
    } on Object catch (error) {
      teamsError = AppException(kind: AppExceptionKind.serialization, message: 'Invalid team detail response.', cause: error);
    } finally {
      teamDetailLoading = false;
      notifyListeners();
    }
  }

  void closeTeam() {
    selectedTeam = null;
    members = const [];
    availability = const [];
    capabilityIds = const {};
    serviceOptions = const [];
    teamsError = null;
    notifyListeners();
  }

  Future<bool> createTeam({required String companyId, required String internalCode, required String name, required int capacity}) =>
      _teamCommand(() => _repository.createTeam(companyId: companyId, internalCode: internalCode, name: name, capacity: capacity));

  Future<bool> updateTeam({required String id, required String name, required int capacity, required bool active}) =>
      _teamCommand(() => _repository.updateTeam(id, name: name, capacity: capacity, active: active), reopenId: id);

  Future<bool> updateStatus(String id, String status) =>
      _teamCommand(() => _repository.updateTeamStatus(id, status), reopenId: id);

  Future<bool> addAvailability(String id, DateTime startsAt, DateTime endsAt, bool available) =>
      _teamCommand(() => _repository.createTeamAvailability(id, startsAt: startsAt, endsAt: endsAt, available: available), reopenId: id);

  Future<bool> updateAvailability(String teamId, String availabilityId, DateTime startsAt, DateTime endsAt, bool available) =>
      _teamCommand(() => _repository.updateTeamAvailability(teamId, availabilityId, startsAt: startsAt, endsAt: endsAt, available: available), reopenId: teamId);

  Future<bool> removeAvailability(String teamId, String availabilityId) =>
      _teamCommand(() => _repository.deleteTeamAvailability(teamId, availabilityId), reopenId: teamId);

  Future<bool> replaceCapabilities(String id, Set<String> ids) =>
      _teamCommand(() => _repository.replaceTeamCapabilities(id, ids), reopenId: id);

  Future<bool> _teamCommand(Future<Object?> Function() run, {String? reopenId}) async {
    if (teamCommandBusy) return false;
    teamCommandBusy = true;
    teamsError = null;
    notifyListeners();
    try {
      await run();
      await loadTeams();
      if (reopenId != null) await openTeam(reopenId);
      return true;
    } on AppException catch (error) {
      teamsError = error;
      return false;
    } finally {
      teamCommandBusy = false;
      notifyListeners();
    }
  }

  Future<void> loadSettlements() async {
    if (settlementsLoading) return;
    settlementsLoading = true;
    settlementsError = null;
    notifyListeners();
    try {
      settlements = await _repository.listProviderSettlements();
    } on AppException catch (error) {
      settlementsError = error;
    } on Object catch (error) {
      settlementsError = AppException(kind: AppExceptionKind.serialization, message: 'Invalid settlement response.', cause: error);
    } finally {
      settlementsLoading = false;
      notifyListeners();
    }
  }

  Future<void> openSettlement(String id) async {
    settlementDetailLoading = true;
    settlementsError = null;
    selectedSettlement = null;
    notifyListeners();
    try {
      selectedSettlement = await _repository.providerSettlementDetail(id);
    } on AppException catch (error) {
      settlementsError = error;
    } on Object catch (error) {
      settlementsError = AppException(kind: AppExceptionKind.serialization, message: 'Invalid settlement detail.', cause: error);
    } finally {
      settlementDetailLoading = false;
      notifyListeners();
    }
  }

  void closeSettlement() {
    selectedSettlement = null;
    settlementsError = null;
    notifyListeners();
  }

  void clear() {
    teams = const [];
    selectedTeam = null;
    members = const [];
    availability = const [];
    capabilityIds = const {};
    serviceOptions = const [];
    settlements = const [];
    selectedSettlement = null;
    teamsError = settlementsError = null;
    notifyListeners();
  }
}
