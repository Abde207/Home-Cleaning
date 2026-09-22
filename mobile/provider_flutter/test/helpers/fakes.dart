import 'dart:async';

import 'package:home_clean_provider/core/network/request_cancellation.dart';
import 'package:home_clean_provider/domain/auth/auth_repository.dart';
import 'package:home_clean_provider/domain/auth/auth_session.dart';
import 'package:home_clean_provider/domain/provider/provider_models.dart';
import 'package:home_clean_provider/domain/provider/provider_repository.dart';
import 'package:http/http.dart' as http;

class StubClient extends http.BaseClient {
  StubClient(this.handler);
  final FutureOr<http.Response> Function(http.BaseRequest request) handler;
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      request: request,
    );
  }
}

AuthSession testSession([String access = 'access-token']) => AuthSession(
  accessToken: access,
  refreshToken: 'refresh-token',
  accessExpiresAt: DateTime.utc(2030),
  refreshExpiresAt: DateTime.utc(2030),
);

ProviderIdentity managerIdentity({String companyId = 'company-1'}) =>
    ProviderIdentity(
      id: 'user-1',
      name: 'Manager',
      phone: '+962790000001',
      locale: 'en',
      scopes: [
        ProviderScope(
          role: ProviderRole.companyManager,
          companyId: companyId,
          teamId: null,
          permissions: const [
            'company:own',
            'team:company',
            'assignment:company',
            'settlement:company',
          ],
        ),
      ],
    );

ProviderIdentity customerIdentity() => ProviderIdentity(
  id: 'customer-1',
  name: 'Customer',
  phone: '+962790000002',
  locale: 'en',
  scopes: [
    ProviderScope(
      role: ProviderRole.customer,
      companyId: null,
      teamId: null,
      permissions: const ['booking:own'],
    ),
  ],
);

ProviderContext managerContext([ProviderIdentity? identity]) => ProviderContext(
  identity: identity ?? managerIdentity(),
  companies: const [
    ProviderCompany(id: 'company-1', name: 'Clean Co', status: 'ACTIVE'),
  ],
  teams: const [
    ProviderTeam(
      id: 'team-1',
      companyId: 'company-1',
      internalCode: 'TEAM-1',
      name: 'Team One',
      status: 'AVAILABLE',
      capacity: 2,
      active: true,
    ),
  ],
);

class FakeAuthRepository implements AuthRepository {
  AuthSession? value;
  ProviderIdentity identity = managerIdentity();
  bool restored = false;
  bool loggedOut = false;
  int refreshCalls = 0;

  @override
  AuthSession? get session => value;
  @override
  Future<void> restore() async => restored = true;
  @override
  Future<AuthChallenge> requestOtp(String phone) async =>
      AuthChallenge(challengeId: 'challenge-1', expiresAt: DateTime.utc(2030));
  @override
  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String code,
  }) async => value = testSession();
  @override
  Future<bool> refreshSession() async {
    refreshCalls++;
    return true;
  }

  @override
  Future<void> invalidateSession() async => value = null;
  @override
  Future<void> logout() async {
    loggedOut = true;
    value = null;
  }

  @override
  Future<ProviderIdentity> me() async => identity;
}

class FakeProviderRepository implements ProviderRepository {
  ProviderContext? context;
  int loadCalls = 0;

  @override
  Future<ProviderContext> loadContext(
    ProviderIdentity identity, {
    RequestCancellationToken? cancellation,
  }) async {
    loadCalls++;
    return context ?? managerContext(identity);
  }

  @override
  Future<List<ProviderOffer>> listOffers({
    RequestCancellationToken? cancellation,
  }) async => [];
  List<ProviderAssignmentSummary> assignmentRows = [];
  List<ProviderNotification> notificationRows = [];
  ProviderAssignmentDetail? assignmentValue;
  int acceptCalls = 0;
  int rejectCalls = 0;
  int onTheWayCalls = 0;
  int startCalls = 0;
  int completeCalls = 0;
  int proofCalls = 0;
  int cashCalls = 0;
  int teamNoShowCalls = 0;
  int customerNoShowCalls = 0;
  String? lastCommandKey;
  int readCalls = 0;
  @override
  Future<List<ProviderAssignmentSummary>> listAssignments({
    AssignmentView? view,
    String? status,
    int limit = 100,
    int offset = 0,
    RequestCancellationToken? cancellation,
  }) async => assignmentRows;
  @override
  Future<ProviderAssignmentDetail> assignmentDetail(
    String id, {
    RequestCancellationToken? cancellation,
  }) async => assignmentValue ?? testAssignmentDetail(id: id);
  @override
  Future<void> acceptAssignment(
    String id, {
    required String idempotencyKey,
  }) async {
    acceptCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> rejectAssignment(
    String id, {
    required String idempotencyKey,
    String? reason,
  }) async {
    rejectCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> markOnTheWay(String id, {required String idempotencyKey}) async {
    onTheWayCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> startCleaning(String id, {required String idempotencyKey}) async {
    startCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> completeCleaning(String id, {required String idempotencyKey}) async {
    completeCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> submitCompletionProof(
    String id, {
    required String idempotencyKey,
    required CompletionProofInput proof,
  }) async {
    proofCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> collectCash(
    String id, {
    required String idempotencyKey,
    required String amount,
  }) async {
    cashCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> markTeamNoShow(String id, {required String idempotencyKey}) async {
    teamNoShowCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<void> markCustomerNoShow(String id, {required String idempotencyKey}) async {
    customerNoShowCalls++;
    lastCommandKey = idempotencyKey;
  }

  @override
  Future<List<ProviderAssignmentSummary>> cashWorklist({
    String? state,
    RequestCancellationToken? cancellation,
  }) async => assignmentRows.where((row) => row.cash != null).toList();
  @override
  Future<List<ProviderNotification>> listNotifications({
    int limit = 100,
    int offset = 0,
    RequestCancellationToken? cancellation,
  }) async => notificationRows;
  @override
  Future<void> markNotificationRead(String id) async {
    readCalls++;
  }

  @override
  Future<List<SettlementSummary>> listSettlements({
    RequestCancellationToken? cancellation,
  }) async => [];

  List<ProviderTeam> teamRows = managerContext().teams;
  List<ProviderSettlementSummary> settlementRows = const [];
  ProviderSettlementDetail? settlementValue;
  int teamMutationCalls = 0;

  @override
  Future<List<ProviderTeam>> listTeams({int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) async => teamRows;
  @override
  Future<ProviderTeamDetail> teamDetail(String id, {RequestCancellationToken? cancellation}) async {
    final team = teamRows.firstWhere((row) => row.id == id);
    return ProviderTeamDetail(team: team, company: const ProviderCompany(id: 'company-1', name: 'Clean Co', status: 'ACTIVE'), latitude: 31.95, longitude: 35.91, locationAt: DateTime.utc(2030), updatedAt: DateTime.utc(2030));
  }
  @override
  Future<List<ProviderTeamMember>> teamMembers(String id, {int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) async => const [ProviderTeamMember(id: 'member-1', name: 'Cleaner', role: 'TEAM_LEADER_CLEANER')];
  @override
  Future<List<ProviderTeamAvailability>> teamAvailability(String id, {int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) async => [];
  @override
  Future<Set<String>> teamCapabilities(String id, {RequestCancellationToken? cancellation}) async => {'service-1'};
  @override
  Future<List<ProviderServiceOption>> listServiceOptions({RequestCancellationToken? cancellation}) async => const [ProviderServiceOption(id: 'service-1', name: 'Deep clean', nameAr: 'تنظيف عميق')];
  @override
  Future<ProviderTeam> createTeam({required String companyId, required String internalCode, required String name, required int capacity}) async { teamMutationCalls++; return teamRows.first; }
  @override
  Future<ProviderTeam> updateTeam(String id, {required String name, required int capacity, required bool active}) async { teamMutationCalls++; return teamRows.first; }
  @override
  Future<void> updateTeamStatus(String id, String status) async { teamMutationCalls++; }
  @override
  Future<ProviderTeamAvailability> createTeamAvailability(String id, {required DateTime startsAt, required DateTime endsAt, required bool available}) async { teamMutationCalls++; return ProviderTeamAvailability(id: 'availability-1', startsAt: startsAt, endsAt: endsAt, available: available); }
  @override
  Future<ProviderTeamAvailability> updateTeamAvailability(String teamId, String availabilityId, {required DateTime startsAt, required DateTime endsAt, required bool available}) async { teamMutationCalls++; return ProviderTeamAvailability(id: availabilityId, startsAt: startsAt, endsAt: endsAt, available: available); }
  @override
  Future<void> deleteTeamAvailability(String teamId, String availabilityId) async { teamMutationCalls++; }
  @override
  Future<Set<String>> replaceTeamCapabilities(String id, Set<String> serviceIds) async { teamMutationCalls++; return serviceIds; }
  @override
  Future<List<ProviderSettlementSummary>> listProviderSettlements({int limit = 100, int offset = 0, RequestCancellationToken? cancellation}) async => settlementRows;
  @override
  Future<ProviderSettlementDetail> providerSettlementDetail(String id, {RequestCancellationToken? cancellation}) async => settlementValue!;
}

ProviderAssignmentSummary testAssignment({
  String id = 'assignment-1',
  String status = 'OFFERED',
  String bookingStatus = 'TEAM_ASSIGNED',
  bool canAccept = true,
  bool canReject = true,
  bool canMarkOnTheWay = false,
  bool canStartCleaning = false,
  bool canCompleteCleaning = false,
  bool canMarkTeamNoShow = false,
  bool canMarkCustomerNoShow = false,
  ProviderCashProjection? cash,
}) => ProviderAssignmentSummary(
  id: id,
  bookingId: 'booking-1',
  bookingNumber: 'HC-1',
  status: status,
  bookingStatus: bookingStatus,
  startsAt: DateTime.utc(2030, 1, 2, 10),
  endsAt: DateTime.utc(2030, 1, 2, 12),
  assignedAt: DateTime.utc(2030, 1, 1),
  expiresAt: DateTime.utc(2030, 1, 1, 1),
  acceptedAt: null,
  rejectionReason: null,
  company: const ProviderAssignmentCompany(
    id: 'company-1',
    name: 'Clean Co',
    status: 'ACTIVE',
  ),
  team: const ProviderAssignmentTeam(
    id: 'team-1',
    name: 'Team One',
    status: 'AVAILABLE',
    active: true,
  ),
  service: const ProviderAssignmentService(
    name: 'Deep clean',
    nameAr: 'تنظيف عميق',
    durationMinutes: 120,
  ),
  addressText: 'Amman',
  canAccept: canAccept,
  canReject: canReject,
  canMarkOnTheWay: canMarkOnTheWay,
  canStartCleaning: canStartCleaning,
  canCompleteCleaning: canCompleteCleaning,
  canMarkTeamNoShow: canMarkTeamNoShow,
  canMarkCustomerNoShow: canMarkCustomerNoShow,
  cash: cash,
);

ProviderAssignmentDetail testAssignmentDetail({
  String id = 'assignment-1',
  ProviderAssignmentSummary? summary,
  bool canSubmitCompletionProof = false,
  List<ProviderCompletionProof> proofs = const [],
}) =>
    ProviderAssignmentDetail(
      summary: summary ?? testAssignment(id: id),
      addressLabel: 'Home',
      latitude: 31.95,
      longitude: 35.91,
      property: const ProviderAssignmentProperty(
        type: 'APARTMENT',
        size: '90',
        rooms: 3,
        bathrooms: 2,
      ),
      extras: const [ProviderAssignmentExtra(name: 'Oven', quantity: 1)],
      instructions: 'Gate 2',
      completionProofs: proofs,
      canSubmitCompletionProof: canSubmitCompletionProof,
    );

ProviderSettlementSummary testSettlementSummary() => ProviderSettlementSummary(
  id: 'settlement-1',
  companyId: 'company-1',
  reference: 'HC-SET-1',
  status: 'PAID',
  periodStart: DateTime.utc(2030, 1, 1),
  periodEnd: DateTime.utc(2030, 2, 1),
  total: '72.00',
  currency: 'JOD',
  paidAmount: '72.00',
  payoutDirection: 'TO_PROVIDER',
  latestReconciliationStatus: 'MATCHED',
  workItemCount: 1,
  company: const ProviderCompany(id: 'company-1', name: 'Clean Co', status: 'ACTIVE'),
  updatedAt: DateTime.utc(2030, 2, 2),
);

ProviderSettlementDetail testSettlementDetail() => ProviderSettlementDetail(
  summary: testSettlementSummary(),
  workItems: [ProviderSettlementWorkItem(id: 'item-1', amount: '72.00', bookingNumber: 'HC-1', scheduledAt: DateTime.utc(2030, 1, 12), serviceName: 'Deep clean', serviceNameAr: 'تنظيف عميق')],
  payouts: [ProviderSettlementPayout(id: 'payout-1', amount: '72.00', direction: 'TO_PROVIDER', reference: 'PAYOUT-1', paidAt: DateTime.utc(2030, 2, 2))],
  reconciliationStatus: 'MATCHED',
  reconciliationDifference: '0.00',
);
