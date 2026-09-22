import '../../core/errors/app_exception.dart';
import '../../core/network/request_cancellation.dart';
import '../../domain/provider/provider_models.dart';
import '../../domain/provider/provider_repository.dart';
import 'provider_remote_data_source.dart';

class ProviderRepositoryImpl implements ProviderRepository {
  ProviderRepositoryImpl(this._remote);
  final ProviderRemoteDataSource _remote;
  ProviderIdentity? _identity;

  @override
  Future<ProviderContext> loadContext(
    ProviderIdentity identity, {
    RequestCancellationToken? cancellation,
  }) async {
    if (!identity.isProviderAuthorized) {
      throw const AppException(
        kind: AppExceptionKind.forbidden,
        code: 'PROVIDER_ROLE_REQUIRED',
        message: 'A provider role is required.',
        statusCode: 403,
      );
    }
    try {
      final managerScopes = identity.providerScopes
          .where((scope) => scope.isManager)
          .toList(growable: false);
      final companiesFuture = managerScopes.isEmpty
          ? Future.value(const <ProviderCompany>[])
          : _remote.companies(cancellation);
      final results = await Future.wait<Object>([
        companiesFuture,
        _remote.teams(cancellation),
      ]);
      final companies = results[0] as List<ProviderCompany>;
      final teams = results[1] as List<ProviderTeam>;
      _verifyScope(identity, companies, teams);
      _identity = identity;
      return ProviderContext(
        identity: identity,
        companies: companies,
        teams: teams,
      );
    } on AppException {
      rethrow;
    } on Object catch (error) {
      throw AppException(
        kind: AppExceptionKind.serialization,
        code: 'PROVIDER_CONTEXT_INVALID',
        message: 'The provider context was invalid.',
        cause: error,
      );
    }
  }

  void _verifyScope(
    ProviderIdentity identity,
    List<ProviderCompany> companies,
    List<ProviderTeam> teams,
  ) {
    final scopes = identity.providerScopes;
    final managerCompanyIds = scopes
        .where((scope) => scope.isManager)
        .map((scope) => scope.companyId!)
        .toSet();
    if (companies.any((company) => !managerCompanyIds.contains(company.id))) {
      throw const FormatException('Company outside authenticated scope.');
    }
    final invalidTeam = teams.any(
      (team) => !scopes.any((scope) {
        if (scope.isManager) return scope.companyId == team.companyId;
        return scope.isCleaner &&
            scope.companyId == team.companyId &&
            scope.teamId == team.id;
      }),
    );
    if (invalidTeam) {
      throw const FormatException('Team outside authenticated scope.');
    }
  }

  @override
  Future<List<ProviderOffer>> listOffers({
    RequestCancellationToken? cancellation,
  }) => _remote.offers(cancellation);

  @override
  Future<List<ProviderAssignmentSummary>> listAssignments({
    AssignmentView? view,
    String? status,
    int limit = 100,
    int offset = 0,
    RequestCancellationToken? cancellation,
  }) => _remote.assignments(
    view: view,
    status: status,
    limit: limit,
    offset: offset,
    cancellation: cancellation,
  );

  @override
  Future<ProviderAssignmentDetail> assignmentDetail(
    String id, {
    RequestCancellationToken? cancellation,
  }) => _remote.assignmentDetail(id, cancellation);

  @override
  Future<void> acceptAssignment(String id, {required String idempotencyKey}) =>
      _remote.acceptAssignment(id, idempotencyKey);

  @override
  Future<void> rejectAssignment(
    String id, {
    required String idempotencyKey,
    String? reason,
  }) => _remote.rejectAssignment(id, idempotencyKey, reason);

  @override
  Future<void> markOnTheWay(String id, {required String idempotencyKey}) =>
      _remote.markOnTheWay(id, idempotencyKey);

  @override
  Future<void> startCleaning(String id, {required String idempotencyKey}) =>
      _remote.startCleaning(id, idempotencyKey);

  @override
  Future<void> completeCleaning(String id, {required String idempotencyKey}) =>
      _remote.completeCleaning(id, idempotencyKey);

  @override
  Future<void> submitCompletionProof(
    String id, {
    required String idempotencyKey,
    required CompletionProofInput proof,
  }) => _remote.submitCompletionProof(id, idempotencyKey, proof);

  @override
  Future<void> collectCash(
    String id, {
    required String idempotencyKey,
    required String amount,
  }) => _remote.collectCash(id, idempotencyKey, amount);

  @override
  Future<void> markTeamNoShow(String id, {required String idempotencyKey}) =>
      _remote.markTeamNoShow(id, idempotencyKey);

  @override
  Future<void> markCustomerNoShow(String id, {required String idempotencyKey}) =>
      _remote.markCustomerNoShow(id, idempotencyKey);

  @override
  Future<List<ProviderAssignmentSummary>> cashWorklist({
    String? state,
    RequestCancellationToken? cancellation,
  }) async {
    final identity = _identity;
    if (identity == null || !identity.canViewCashWorklist) {
      throw const AppException(
        kind: AppExceptionKind.forbidden,
        code: 'CASH_SCOPE_REQUIRED',
        message: 'Cash scope is required.',
        statusCode: 403,
      );
    }
    return _remote.cashWorklist(state, cancellation);
  }

  @override
  Future<List<ProviderNotification>> listNotifications({
    int limit = 100,
    int offset = 0,
    RequestCancellationToken? cancellation,
  }) => _remote.notifications(
    limit: limit,
    offset: offset,
    cancellation: cancellation,
  );

  @override
  Future<void> markNotificationRead(String id) =>
      _remote.markNotificationRead(id);

  @override
  Future<List<SettlementSummary>> listSettlements({
    RequestCancellationToken? cancellation,
  }) async {
    final identity = _identity;
    if (identity == null || !identity.canViewSettlements) {
      throw const AppException(
        kind: AppExceptionKind.forbidden,
        code: 'SETTLEMENT_SCOPE_REQUIRED',
        message: 'Settlement scope is required.',
        statusCode: 403,
      );
    }
    final rows = await _remote.settlements(cancellation);
    final companyIds = identity.providerScopes
        .where((scope) => scope.permissions.contains('settlement:company'))
        .map((scope) => scope.companyId)
        .whereType<String>()
        .toSet();
    if (rows.any((row) => !companyIds.contains(row.companyId))) {
      throw const AppException(
        kind: AppExceptionKind.serialization,
        code: 'PROVIDER_SCOPE_MISMATCH',
        message: 'The response was outside the provider scope.',
      );
    }
    return rows;
  }

  @override
  Future<List<ProviderTeam>> listTeams({int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) =>
      _remote.pagedTeams(limit, offset, cancellation);

  @override
  Future<ProviderTeamDetail> teamDetail(String id, {RequestCancellationToken? cancellation}) => _remote.teamDetail(id, cancellation);

  @override
  Future<List<ProviderTeamMember>> teamMembers(String id, {int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) =>
      _remote.teamMembers(id, limit, offset, cancellation);

  @override
  Future<List<ProviderTeamAvailability>> teamAvailability(String id, {int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) =>
      _remote.teamAvailability(id, limit, offset, cancellation);

  @override
  Future<Set<String>> teamCapabilities(String id, {RequestCancellationToken? cancellation}) => _remote.teamCapabilities(id, cancellation);

  @override
  Future<List<ProviderServiceOption>> listServiceOptions({RequestCancellationToken? cancellation}) => _remote.serviceOptions(cancellation);

  @override
  Future<ProviderTeam> createTeam({required String companyId, required String internalCode, required String name, required int capacity}) =>
      _remote.createTeam(companyId, internalCode, name, capacity);

  @override
  Future<ProviderTeam> updateTeam(String id, {required String name, required int capacity, required bool active}) =>
      _remote.updateTeam(id, name, capacity, active);

  @override
  Future<void> updateTeamStatus(String id, String status) => _remote.updateTeamStatus(id, status);

  @override
  Future<ProviderTeamAvailability> createTeamAvailability(String id, {required DateTime startsAt, required DateTime endsAt, required bool available}) =>
      _remote.createTeamAvailability(id, startsAt, endsAt, available);

  @override
  Future<ProviderTeamAvailability> updateTeamAvailability(String teamId, String availabilityId, {required DateTime startsAt, required DateTime endsAt, required bool available}) =>
      _remote.updateTeamAvailability(teamId, availabilityId, startsAt, endsAt, available);

  @override
  Future<void> deleteTeamAvailability(String teamId, String availabilityId) => _remote.deleteTeamAvailability(teamId, availabilityId);

  @override
  Future<Set<String>> replaceTeamCapabilities(String id, Set<String> serviceIds) => _remote.replaceTeamCapabilities(id, serviceIds);

  @override
  Future<List<ProviderSettlementSummary>> listProviderSettlements({int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) async {
    final identity = _identity;
    if (identity == null || !identity.canViewSettlements) {
      throw const AppException(kind: AppExceptionKind.forbidden, code: 'SETTLEMENT_SCOPE_REQUIRED', message: 'Settlement scope is required.', statusCode: 403);
    }
    final rows = await _remote.providerSettlements(limit, offset, cancellation);
    final companyIds = identity.providerScopes.where((scope) => scope.permissions.contains('settlement:company')).map((scope) => scope.companyId).whereType<String>().toSet();
    if (rows.any((row) => !companyIds.contains(row.companyId))) {
      throw const AppException(kind: AppExceptionKind.serialization, code: 'PROVIDER_SCOPE_MISMATCH', message: 'The response was outside the provider scope.');
    }
    return rows;
  }

  @override
  Future<ProviderSettlementDetail> providerSettlementDetail(String id, {RequestCancellationToken? cancellation}) async {
    final identity = _identity;
    if (identity == null || !identity.canViewSettlements) {
      throw const AppException(kind: AppExceptionKind.forbidden, code: 'SETTLEMENT_SCOPE_REQUIRED', message: 'Settlement scope is required.', statusCode: 403);
    }
    final result = await _remote.providerSettlementDetail(id, cancellation);
    final companyIds = identity.providerScopes.where((scope) => scope.permissions.contains('settlement:company')).map((scope) => scope.companyId).whereType<String>().toSet();
    if (!companyIds.contains(result.summary.companyId)) {
      throw const AppException(kind: AppExceptionKind.serialization, code: 'PROVIDER_SCOPE_MISMATCH', message: 'The response was outside the provider scope.');
    }
    return result;
  }
}
