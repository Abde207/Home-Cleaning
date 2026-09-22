import '../../core/network/request_cancellation.dart';
import 'provider_models.dart';

abstract interface class ProviderRepository {
  Future<ProviderContext> loadContext(
    ProviderIdentity identity, {
    RequestCancellationToken? cancellation,
  });
  Future<List<ProviderOffer>> listOffers({
    RequestCancellationToken? cancellation,
  });
  Future<List<ProviderAssignmentSummary>> listAssignments({
    AssignmentView? view,
    String? status,
    int limit = 100,
    int offset = 0,
    RequestCancellationToken? cancellation,
  });
  Future<ProviderAssignmentDetail> assignmentDetail(
    String id, {
    RequestCancellationToken? cancellation,
  });
  Future<void> acceptAssignment(String id, {required String idempotencyKey});
  Future<void> rejectAssignment(
    String id, {
    required String idempotencyKey,
    String? reason,
  });
  Future<void> markOnTheWay(String id, {required String idempotencyKey});
  Future<void> startCleaning(String id, {required String idempotencyKey});
  Future<void> completeCleaning(String id, {required String idempotencyKey});
  Future<void> submitCompletionProof(
    String id, {
    required String idempotencyKey,
    required CompletionProofInput proof,
  });
  Future<void> collectCash(
    String id, {
    required String idempotencyKey,
    required String amount,
  });
  Future<void> markTeamNoShow(String id, {required String idempotencyKey});
  Future<void> markCustomerNoShow(String id, {required String idempotencyKey});
  Future<List<ProviderAssignmentSummary>> cashWorklist({
    String? state,
    RequestCancellationToken? cancellation,
  });
  Future<List<ProviderNotification>> listNotifications({
    int limit = 100,
    int offset = 0,
    RequestCancellationToken? cancellation,
  });
  Future<void> markNotificationRead(String id);
  Future<List<SettlementSummary>> listSettlements({
    RequestCancellationToken? cancellation,
  });
  Future<List<ProviderTeam>> listTeams({int limit = 100, int offset = 0, RequestCancellationToken? cancellation});
  Future<ProviderTeamDetail> teamDetail(String id, {RequestCancellationToken? cancellation});
  Future<List<ProviderTeamMember>> teamMembers(String id, {int limit = 100, int offset = 0, RequestCancellationToken? cancellation});
  Future<List<ProviderTeamAvailability>> teamAvailability(String id, {int limit = 100, int offset = 0, RequestCancellationToken? cancellation});
  Future<Set<String>> teamCapabilities(String id, {RequestCancellationToken? cancellation});
  Future<List<ProviderServiceOption>> listServiceOptions({RequestCancellationToken? cancellation});
  Future<ProviderTeam> createTeam({required String companyId, required String internalCode, required String name, required int capacity});
  Future<ProviderTeam> updateTeam(String id, {required String name, required int capacity, required bool active});
  Future<void> updateTeamStatus(String id, String status);
  Future<ProviderTeamAvailability> createTeamAvailability(String id, {required DateTime startsAt, required DateTime endsAt, required bool available});
  Future<ProviderTeamAvailability> updateTeamAvailability(String teamId, String availabilityId, {required DateTime startsAt, required DateTime endsAt, required bool available});
  Future<void> deleteTeamAvailability(String teamId, String availabilityId);
  Future<Set<String>> replaceTeamCapabilities(String id, Set<String> serviceIds);
  Future<List<ProviderSettlementSummary>> listProviderSettlements({int limit = 100, int offset = 0, RequestCancellationToken? cancellation});
  Future<ProviderSettlementDetail> providerSettlementDetail(String id, {RequestCancellationToken? cancellation});
}
