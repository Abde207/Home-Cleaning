import '../../core/network/api_client.dart';
import '../../core/network/request_cancellation.dart';
import '../../domain/provider/provider_models.dart';

class ProviderRemoteDataSource {
  const ProviderRemoteDataSource(this._client);
  final ApiClient _client;

  Future<List<ProviderCompany>> companies(
    RequestCancellationToken? cancellation,
  ) async => _parseList(
    await _client.get(
      '/provider/companies',
      query: const {'limit': '100', 'offset': '0'},
      cancellation: cancellation,
    ),
    ProviderCompany.fromJson,
  );

  Future<List<ProviderTeam>> teams(
    RequestCancellationToken? cancellation,
  ) async => _parseList(
    await _client.get(
      '/provider/teams',
      query: const {'limit': '100', 'offset': '0'},
      cancellation: cancellation,
    ),
    ProviderTeam.fromJson,
  );

  Future<List<ProviderTeam>> pagedTeams(int limit, int offset, RequestCancellationToken? cancellation) async => _parseList(
    await _client.get('/provider/teams', query: {'limit': '$limit', 'offset': '$offset'}, cancellation: cancellation),
    ProviderTeam.fromJson,
  );

  Future<ProviderTeamDetail> teamDetail(String id, RequestCancellationToken? cancellation) async =>
      ProviderTeamDetail.fromJson(_parseObject(await _client.get('/provider/teams/$id', cancellation: cancellation)));

  Future<List<ProviderTeamMember>> teamMembers(String id, int limit, int offset, RequestCancellationToken? cancellation) async => _parseList(
    await _client.get('/provider/teams/$id/members', query: {'limit': '$limit', 'offset': '$offset'}, cancellation: cancellation),
    ProviderTeamMember.fromJson,
  );

  Future<List<ProviderTeamAvailability>> teamAvailability(String id, int limit, int offset, RequestCancellationToken? cancellation) async => _parseList(
    await _client.get('/provider/teams/$id/availability', query: {'limit': '$limit', 'offset': '$offset'}, cancellation: cancellation),
    ProviderTeamAvailability.fromJson,
  );

  Future<Set<String>> teamCapabilities(String id, RequestCancellationToken? cancellation) async {
    final raw = _parseObject(await _client.get('/provider/teams/$id/capabilities', cancellation: cancellation));
    return _list(raw['serviceIds'], 'serviceIds').map((value) => _string(value, 'serviceId')).toSet();
  }

  Future<List<ProviderServiceOption>> serviceOptions(RequestCancellationToken? cancellation) async => _parseList(
    await _client.get('/services', query: const {'limit': '100', 'offset': '0'}, cancellation: cancellation),
    ProviderServiceOption.fromJson,
  );

  Future<ProviderTeam> createTeam(String companyId, String internalCode, String name, int capacity) async =>
      ProviderTeam.fromJson(_parseObject(await _client.post('/provider/teams', body: {'companyId': companyId, 'internalCode': internalCode, 'name': name, 'capacity': capacity})));

  Future<ProviderTeam> updateTeam(String id, String name, int capacity, bool active) async =>
      ProviderTeam.fromJson(_parseObject(await _client.put('/provider/teams/$id', body: {'name': name, 'capacity': capacity, 'active': active})));

  Future<void> updateTeamStatus(String id, String status) async {
    await _client.put('/provider/teams/$id/availability-status', body: {'status': status});
  }

  Future<ProviderTeamAvailability> createTeamAvailability(String id, DateTime startsAt, DateTime endsAt, bool available) async =>
      ProviderTeamAvailability.fromJson(_parseObject(await _client.post('/provider/teams/$id/availability', body: {'startsAt': startsAt.toUtc().toIso8601String(), 'endsAt': endsAt.toUtc().toIso8601String(), 'available': available})));

  Future<ProviderTeamAvailability> updateTeamAvailability(String teamId, String availabilityId, DateTime startsAt, DateTime endsAt, bool available) async =>
      ProviderTeamAvailability.fromJson(_parseObject(await _client.put('/provider/teams/$teamId/availability/$availabilityId', body: {'startsAt': startsAt.toUtc().toIso8601String(), 'endsAt': endsAt.toUtc().toIso8601String(), 'available': available})));

  Future<void> deleteTeamAvailability(String teamId, String availabilityId) async {
    await _client.delete('/provider/teams/$teamId/availability/$availabilityId');
  }

  Future<Set<String>> replaceTeamCapabilities(String id, Set<String> serviceIds) async {
    final raw = _parseObject(await _client.put('/provider/teams/$id/capabilities', body: {'serviceIds': serviceIds.toList()}));
    return _list(raw['serviceIds'], 'serviceIds').map((value) => _string(value, 'serviceId')).toSet();
  }

  Future<List<ProviderOffer>> offers(
    RequestCancellationToken? cancellation,
  ) async => _parseList(
    await _client.get('/dispatch/offers', cancellation: cancellation),
    ProviderOffer.fromJson,
  );

  Future<List<ProviderAssignmentSummary>> assignments({
    AssignmentView? view,
    String? status,
    required int limit,
    required int offset,
    RequestCancellationToken? cancellation,
  }) async => _parseList(
    await _client.get(
      '/provider/assignments',
      query: {
        'limit': '$limit',
        'offset': '$offset',
        if (view != null) 'view': view.wireValue,
        'status': ?status,
      },
      cancellation: cancellation,
    ),
    ProviderAssignmentSummary.fromJson,
  );

  Future<ProviderAssignmentDetail> assignmentDetail(
    String id,
    RequestCancellationToken? cancellation,
  ) async {
    final raw = await _client.get(
      '/provider/assignments/$id',
      cancellation: cancellation,
    );
    if (raw is! Map<String, dynamic>) {
      throw const FormatException('Expected an object.');
    }
    return ProviderAssignmentDetail.fromJson(raw);
  }

  Future<void> acceptAssignment(String id, String key) async {
    await _client.post('/assignments/$id/accept', idempotencyKey: key);
  }

  Future<void> rejectAssignment(String id, String key, String? reason) async {
    await _client.post(
      '/assignments/$id/reject',
      idempotencyKey: key,
      body: {
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  Future<void> markOnTheWay(String id, String key) =>
      _command('/assignments/$id/on-the-way', key);

  Future<void> startCleaning(String id, String key) =>
      _command('/assignments/$id/start-cleaning', key);

  Future<void> completeCleaning(String id, String key) =>
      _command('/assignments/$id/complete-cleaning', key);

  Future<void> submitCompletionProof(
    String id,
    String key,
    CompletionProofInput proof,
  ) => _command('/assignments/$id/completion-proof', key, body: {
    'storageKey': proof.storageKey,
    'mimeType': proof.mimeType,
    'byteSize': proof.byteSize,
  });

  Future<void> collectCash(String id, String key, String amount) => _command(
    '/assignments/$id/collect-cash', key, body: {'amount': amount},
  );

  Future<void> markTeamNoShow(String id, String key) =>
      _command('/assignments/$id/team-no-show', key);

  Future<void> markCustomerNoShow(String id, String key) =>
      _command('/assignments/$id/customer-no-show', key);

  Future<void> _command(
    String path,
    String key, {
    Map<String, dynamic>? body,
  }) async {
    await _client.post(path, idempotencyKey: key, body: body);
  }

  Future<List<ProviderAssignmentSummary>> cashWorklist(
    String? state,
    RequestCancellationToken? cancellation,
  ) async => _parseList(
    await _client.get(
      '/provider/cash-worklist',
      query: {'state': ?state},
      cancellation: cancellation,
    ),
    ProviderAssignmentSummary.fromJson,
  );

  Future<List<ProviderNotification>> notifications({
    required int limit,
    required int offset,
    RequestCancellationToken? cancellation,
  }) async => _parseList(
    await _client.get(
      '/notifications',
      query: {'limit': '$limit', 'offset': '$offset'},
      cancellation: cancellation,
    ),
    ProviderNotification.fromJson,
  );

  Future<void> markNotificationRead(String id) async {
    await _client.patch(
      '/notifications/$id/read',
      body: const <String, dynamic>{},
    );
  }

  Future<List<SettlementSummary>> settlements(
    RequestCancellationToken? cancellation,
  ) async => _parseList(
    await _client.get('/settlements', cancellation: cancellation),
    SettlementSummary.fromJson,
  );

  Future<List<ProviderSettlementSummary>> providerSettlements(int limit, int offset, RequestCancellationToken? cancellation) async => _parseList(
    await _client.get('/provider/settlements', query: {'limit': '$limit', 'offset': '$offset'}, cancellation: cancellation),
    ProviderSettlementSummary.fromJson,
  );

  Future<ProviderSettlementDetail> providerSettlementDetail(String id, RequestCancellationToken? cancellation) async =>
      ProviderSettlementDetail.fromJson(_parseObject(await _client.get('/provider/settlements/$id', cancellation: cancellation)));

  Map<String, dynamic> _parseObject(Object? raw) {
    if (raw is! Map<String, dynamic>) throw const FormatException('Expected an object.');
    return raw;
  }

  List<dynamic> _list(Object? value, String field) {
    if (value is! List<dynamic>) throw FormatException('$field must be a list.');
    return value;
  }

  String _string(Object? value, String field) {
    if (value is! String) throw FormatException('$field must be a string.');
    return value;
  }

  List<T> _parseList<T>(Object? raw, T Function(Map<String, dynamic>) parse) {
    if (raw is! List<dynamic>) throw const FormatException('Expected a list.');
    return raw
        .map((value) {
          if (value is! Map<String, dynamic>) {
            throw const FormatException('Expected an object.');
          }
          return parse(value);
        })
        .toList(growable: false);
  }
}
