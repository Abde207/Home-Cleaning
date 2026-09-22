Map<String, dynamic> _map(Object? value, String field) {
  if (value is Map<String, dynamic>) return value;
  throw FormatException('$field must be an object.');
}

List<dynamic> _list(Object? value, String field) {
  if (value is List<dynamic>) return value;
  throw FormatException('$field must be a list.');
}

String _string(Object? value, String field) {
  if (value is String) return value;
  throw FormatException('$field must be a string.');
}

DateTime _date(Object? value, String field) =>
    DateTime.parse(_string(value, field)).toUtc();

double _decimal(Object? value, String field) {
  final parsed = value is num ? value.toDouble() : double.tryParse('$value');
  if (parsed == null || !parsed.isFinite) {
    throw FormatException('$field must be numeric.');
  }
  return parsed;
}

enum ProviderRole {
  companyManager('COMPANY_MANAGER'),
  teamLeaderCleaner('TEAM_LEADER_CLEANER'),
  customer('CUSTOMER'),
  homeCleanAdmin('HOME_CLEAN_ADMIN'),
  dispatcher('DISPATCHER'),
  unknown('UNKNOWN');

  const ProviderRole(this.wireValue);
  final String wireValue;

  factory ProviderRole.parse(String value) => ProviderRole.values.firstWhere(
    (role) => role.wireValue == value,
    orElse: () => ProviderRole.unknown,
  );
}

class ProviderScope {
  ProviderScope({
    required this.role,
    required this.companyId,
    required this.teamId,
    required Iterable<String> permissions,
  }) : permissions = Set.unmodifiable(permissions);

  factory ProviderScope.fromJson(Map<String, dynamic> json) => ProviderScope(
    role: ProviderRole.parse(_string(json['role'], 'role')),
    companyId: json['companyId'] as String?,
    teamId: json['teamId'] as String?,
    permissions: _list(
      json['permissions'],
      'permissions',
    ).map((value) => _string(value, 'permission')),
  );

  final ProviderRole role;
  final String? companyId;
  final String? teamId;
  final Set<String> permissions;

  bool get isProviderScope => switch (role) {
    ProviderRole.companyManager =>
      companyId != null &&
          teamId == null &&
          permissions.contains('company:own') &&
          permissions.contains('team:company'),
    ProviderRole.teamLeaderCleaner =>
      companyId != null &&
          teamId != null &&
          permissions.contains('assignment:team') &&
          permissions.contains('job:team'),
    _ => false,
  };

  bool get isManager => role == ProviderRole.companyManager && isProviderScope;
  bool get isCleaner =>
      role == ProviderRole.teamLeaderCleaner && isProviderScope;
}

class ProviderIdentity {
  ProviderIdentity({
    required this.id,
    required this.name,
    required this.phone,
    required this.locale,
    required List<ProviderScope> scopes,
  }) : scopes = List.unmodifiable(scopes);

  factory ProviderIdentity.fromJson(Map<String, dynamic> json) =>
      ProviderIdentity(
        id: _string(json['id'], 'id'),
        name: json['name'] as String?,
        phone: _string(json['phone'], 'phone'),
        locale: _string(json['locale'], 'locale'),
        scopes: _list(
          json['scopes'],
          'scopes',
        ).map((value) => ProviderScope.fromJson(_map(value, 'scope'))).toList(),
      );

  final String id;
  final String? name;
  final String phone;
  final String locale;
  final List<ProviderScope> scopes;

  List<ProviderScope> get providerScopes =>
      scopes.where((scope) => scope.isProviderScope).toList(growable: false);
  bool get isProviderAuthorized => providerScopes.isNotEmpty;
  bool get canViewSettlements => providerScopes.any(
    (scope) => scope.permissions.contains('settlement:company'),
  );
  bool get canViewCashWorklist =>
      providerScopes.any((scope) => scope.permissions.contains('cash:team'));
}

class ProviderCompany {
  const ProviderCompany({
    required this.id,
    required this.name,
    required this.status,
  });

  factory ProviderCompany.fromJson(Map<String, dynamic> json) =>
      ProviderCompany(
        id: _string(json['id'], 'id'),
        name: _string(json['name'], 'name'),
        status: _string(json['status'], 'status'),
      );

  final String id;
  final String name;
  final String status;
}

class ProviderTeam {
  const ProviderTeam({
    required this.id,
    required this.companyId,
    required this.internalCode,
    required this.name,
    required this.status,
    required this.capacity,
    required this.active,
  });

  factory ProviderTeam.fromJson(Map<String, dynamic> json) => ProviderTeam(
    id: _string(json['id'], 'id'),
    companyId: _string(json['companyId'], 'companyId'),
    internalCode: _string(json['internalCode'], 'internalCode'),
    name: _string(json['name'], 'name'),
    status: _string(json['status'], 'status'),
    capacity: json['capacity'] as int,
    active: json['active'] as bool,
  );

  final String id;
  final String companyId;
  final String internalCode;
  final String name;
  final String status;
  final int capacity;
  final bool active;
}

class ProviderTeamDetail {
  const ProviderTeamDetail({
    required this.team,
    required this.company,
    required this.latitude,
    required this.longitude,
    required this.locationAt,
    required this.updatedAt,
  });
  factory ProviderTeamDetail.fromJson(Map<String, dynamic> json) =>
      ProviderTeamDetail(
        team: ProviderTeam.fromJson(json),
        company: ProviderCompany.fromJson(_map(json['company'], 'company')),
        latitude: json['latitude'] == null
            ? null
            : _decimal(json['latitude'], 'latitude'),
        longitude: json['longitude'] == null
            ? null
            : _decimal(json['longitude'], 'longitude'),
        locationAt: json['locationAt'] == null
            ? null
            : _date(json['locationAt'], 'locationAt'),
        updatedAt: _date(json['updatedAt'], 'updatedAt'),
      );
  final ProviderTeam team;
  final ProviderCompany company;
  final double? latitude;
  final double? longitude;
  final DateTime? locationAt;
  final DateTime updatedAt;
}

class ProviderTeamMember {
  const ProviderTeamMember({required this.id, required this.name, required this.role});
  factory ProviderTeamMember.fromJson(Map<String, dynamic> json) =>
      ProviderTeamMember(
        id: _string(json['id'], 'id'),
        name: json['name'] as String?,
        role: _string(json['role'], 'role'),
      );
  final String id;
  final String? name;
  final String role;
}

class ProviderTeamAvailability {
  const ProviderTeamAvailability({
    required this.id,
    required this.startsAt,
    required this.endsAt,
    required this.available,
  });
  factory ProviderTeamAvailability.fromJson(Map<String, dynamic> json) =>
      ProviderTeamAvailability(
        id: _string(json['id'], 'id'),
        startsAt: _date(json['startsAt'], 'startsAt'),
        endsAt: _date(json['endsAt'], 'endsAt'),
        available: json['available'] as bool,
      );
  final String id;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool available;
}

class ProviderServiceOption {
  const ProviderServiceOption({required this.id, required this.name, required this.nameAr});
  factory ProviderServiceOption.fromJson(Map<String, dynamic> json) =>
      ProviderServiceOption(
        id: _string(json['id'], 'id'),
        name: _string(json['name'], 'name'),
        nameAr: _string(json['nameAr'], 'nameAr'),
      );
  final String id;
  final String name;
  final String nameAr;
}

class ProviderContext {
  ProviderContext({
    required this.identity,
    required List<ProviderCompany> companies,
    required List<ProviderTeam> teams,
  }) : companies = List.unmodifiable(companies),
       teams = List.unmodifiable(teams);

  final ProviderIdentity identity;
  final List<ProviderCompany> companies;
  final List<ProviderTeam> teams;
}

enum AssignmentView { pending, active, history }

extension AssignmentViewWire on AssignmentView {
  String get wireValue => switch (this) {
    AssignmentView.pending => 'PENDING',
    AssignmentView.active => 'ACTIVE',
    AssignmentView.history => 'HISTORY',
  };
}

class ProviderAssignmentCompany {
  const ProviderAssignmentCompany({
    required this.id,
    required this.name,
    required this.status,
  });
  factory ProviderAssignmentCompany.fromJson(Map<String, dynamic> json) =>
      ProviderAssignmentCompany(
        id: _string(json['id'], 'company.id'),
        name: _string(json['name'], 'company.name'),
        status: _string(json['status'], 'company.status'),
      );
  final String id;
  final String name;
  final String status;
}

class ProviderAssignmentTeam {
  const ProviderAssignmentTeam({
    required this.id,
    required this.name,
    required this.status,
    required this.active,
  });
  factory ProviderAssignmentTeam.fromJson(Map<String, dynamic> json) =>
      ProviderAssignmentTeam(
        id: _string(json['id'], 'team.id'),
        name: _string(json['name'], 'team.name'),
        status: _string(json['status'], 'team.status'),
        active: json['active'] as bool,
      );
  final String id;
  final String name;
  final String status;
  final bool active;
}

class ProviderAssignmentService {
  const ProviderAssignmentService({
    required this.name,
    required this.nameAr,
    required this.durationMinutes,
  });
  factory ProviderAssignmentService.fromJson(Map<String, dynamic> json) =>
      ProviderAssignmentService(
        name: _string(json['name'], 'service.name'),
        nameAr: _string(json['nameAr'], 'service.nameAr'),
        durationMinutes: json['durationMinutes'] as int,
      );
  final String name;
  final String nameAr;
  final int durationMinutes;
}

class ProviderCashProjection {
  const ProviderCashProjection({
    required this.expectedAmount,
    required this.currency,
    required this.collectionState,
    required this.canCollect,
  });
  factory ProviderCashProjection.fromJson(Map<String, dynamic> json) =>
      ProviderCashProjection(
        expectedAmount: '${json['expectedAmount']}',
        currency: _string(json['currency'], 'cash.currency'),
        collectionState: _string(
          json['collectionState'],
          'cash.collectionState',
        ),
        canCollect: json['canCollect'] as bool,
      );
  final String expectedAmount;
  final String currency;
  final String collectionState;
  final bool canCollect;
}

class ProviderAssignmentSummary {
  const ProviderAssignmentSummary({
    required this.id,
    required this.bookingId,
    required this.bookingNumber,
    required this.status,
    required this.bookingStatus,
    required this.startsAt,
    required this.endsAt,
    required this.assignedAt,
    required this.expiresAt,
    required this.acceptedAt,
    required this.rejectionReason,
    required this.company,
    required this.team,
    required this.service,
    required this.addressText,
    required this.canAccept,
    required this.canReject,
    required this.canMarkOnTheWay,
    required this.canStartCleaning,
    required this.canCompleteCleaning,
    required this.canMarkTeamNoShow,
    required this.canMarkCustomerNoShow,
    required this.cash,
  });

  factory ProviderAssignmentSummary.fromJson(Map<String, dynamic> json) {
    final location = _map(json['location'], 'location');
    return ProviderAssignmentSummary(
      id: _string(json['id'], 'id'),
      bookingId: _string(json['bookingId'], 'bookingId'),
      bookingNumber: _string(json['bookingNumber'], 'bookingNumber'),
      status: _string(json['status'], 'status'),
      bookingStatus: _string(json['bookingStatus'], 'bookingStatus'),
      startsAt: _date(json['startsAt'], 'startsAt'),
      endsAt: _date(json['endsAt'], 'endsAt'),
      assignedAt: _date(json['assignedAt'], 'assignedAt'),
      expiresAt: _date(json['expiresAt'], 'expiresAt'),
      acceptedAt: json['acceptedAt'] == null
          ? null
          : _date(json['acceptedAt'], 'acceptedAt'),
      rejectionReason: json['rejectionReason'] as String?,
      company: ProviderAssignmentCompany.fromJson(
        _map(json['company'], 'company'),
      ),
      team: ProviderAssignmentTeam.fromJson(_map(json['team'], 'team')),
      service: ProviderAssignmentService.fromJson(
        _map(json['service'], 'service'),
      ),
      addressText: _string(location['addressText'], 'location.addressText'),
      canAccept: json['canAccept'] as bool,
      canReject: json['canReject'] as bool,
      canMarkOnTheWay: json['canMarkOnTheWay'] as bool,
      canStartCleaning: json['canStartCleaning'] as bool,
      canCompleteCleaning: json['canCompleteCleaning'] as bool,
      canMarkTeamNoShow: json['canMarkTeamNoShow'] as bool,
      canMarkCustomerNoShow: json['canMarkCustomerNoShow'] as bool,
      cash: json['cash'] == null
          ? null
          : ProviderCashProjection.fromJson(_map(json['cash'], 'cash')),
    );
  }

  final String id;
  final String bookingId;
  final String bookingNumber;
  final String status;
  final String bookingStatus;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime assignedAt;
  final DateTime expiresAt;
  final DateTime? acceptedAt;
  final String? rejectionReason;
  final ProviderAssignmentCompany company;
  final ProviderAssignmentTeam team;
  final ProviderAssignmentService service;
  final String addressText;
  final bool canAccept;
  final bool canReject;
  final bool canMarkOnTheWay;
  final bool canStartCleaning;
  final bool canCompleteCleaning;
  final bool canMarkTeamNoShow;
  final bool canMarkCustomerNoShow;
  final ProviderCashProjection? cash;
}

class ProviderCompletionProof {
  const ProviderCompletionProof({
    required this.id,
    required this.storageKey,
    required this.mimeType,
    required this.byteSize,
    required this.createdAt,
  });

  factory ProviderCompletionProof.fromJson(Map<String, dynamic> json) =>
      ProviderCompletionProof(
        id: _string(json['id'], 'proof.id'),
        storageKey: _string(json['storageKey'], 'proof.storageKey'),
        mimeType: _string(json['mimeType'], 'proof.mimeType'),
        byteSize: json['byteSize'] as int,
        createdAt: _date(json['createdAt'], 'proof.createdAt'),
      );

  final String id;
  final String storageKey;
  final String mimeType;
  final int byteSize;
  final DateTime createdAt;
}

class CompletionProofInput {
  const CompletionProofInput({
    required this.storageKey,
    required this.mimeType,
    required this.byteSize,
  });
  final String storageKey;
  final String mimeType;
  final int byteSize;
}

class ProviderAssignmentExtra {
  const ProviderAssignmentExtra({required this.name, required this.quantity});
  factory ProviderAssignmentExtra.fromJson(Map<String, dynamic> json) =>
      ProviderAssignmentExtra(
        name: _string(json['name'], 'extra.name'),
        quantity: json['quantity'] as int,
      );
  final String name;
  final int quantity;
}

class ProviderAssignmentProperty {
  const ProviderAssignmentProperty({
    required this.type,
    required this.size,
    required this.rooms,
    required this.bathrooms,
  });
  factory ProviderAssignmentProperty.fromJson(Map<String, dynamic> json) =>
      ProviderAssignmentProperty(
        type: _string(json['type'], 'property.type'),
        size: '${json['size']}',
        rooms: json['rooms'] as int,
        bathrooms: json['bathrooms'] as int,
      );
  final String type;
  final String size;
  final int rooms;
  final int bathrooms;
}

class ProviderAssignmentDetail {
  ProviderAssignmentDetail({
    required this.summary,
    required this.addressLabel,
    required this.latitude,
    required this.longitude,
    required this.property,
    required List<ProviderAssignmentExtra> extras,
    required this.instructions,
    required List<ProviderCompletionProof> completionProofs,
    required this.canSubmitCompletionProof,
  }) : extras = List.unmodifiable(extras),
       completionProofs = List.unmodifiable(completionProofs);
  factory ProviderAssignmentDetail.fromJson(Map<String, dynamic> json) {
    final location = _map(json['location'], 'location');
    return ProviderAssignmentDetail(
      summary: ProviderAssignmentSummary.fromJson(json),
      addressLabel: location['label'] as String?,
      latitude: _decimal(location['latitude'], 'location.latitude'),
      longitude: _decimal(location['longitude'], 'location.longitude'),
      property: ProviderAssignmentProperty.fromJson(
        _map(json['property'], 'property'),
      ),
      extras: _list(json['extras'], 'extras')
          .map(
            (value) => ProviderAssignmentExtra.fromJson(_map(value, 'extra')),
          )
          .toList(),
      instructions: json['instructions'] as String?,
      completionProofs: _list(json['completionProofs'], 'completionProofs')
          .map((value) => ProviderCompletionProof.fromJson(_map(value, 'proof')))
          .toList(),
      canSubmitCompletionProof: json['canSubmitCompletionProof'] as bool,
    );
  }
  final ProviderAssignmentSummary summary;
  final String? addressLabel;
  final double latitude;
  final double longitude;
  final ProviderAssignmentProperty property;
  final List<ProviderAssignmentExtra> extras;
  final String? instructions;
  final List<ProviderCompletionProof> completionProofs;
  final bool canSubmitCompletionProof;
}

class ProviderOffer {
  const ProviderOffer({
    required this.id,
    required this.bookingId,
    required this.companyId,
    required this.teamId,
    required this.companyName,
    required this.teamName,
    required this.status,
    required this.assignedAt,
    required this.expiresAt,
    required this.startsAt,
    required this.endsAt,
    required this.bookingNumber,
    required this.serviceName,
    required this.serviceNameAr,
    required this.durationMinutes,
    required this.addressText,
    required this.latitude,
    required this.longitude,
    required this.instructions,
  });

  factory ProviderOffer.fromJson(Map<String, dynamic> json) {
    final service = _map(json['service'], 'service');
    final location = _map(json['location'], 'location');
    final company = _map(json['company'], 'company');
    final team = _map(json['team'], 'team');
    return ProviderOffer(
      id: _string(json['id'], 'id'),
      bookingId: _string(json['bookingId'], 'bookingId'),
      companyId: _string(json['companyId'], 'companyId'),
      teamId: _string(json['teamId'], 'teamId'),
      companyName: _string(company['name'], 'company.name'),
      teamName: _string(team['name'], 'team.name'),
      status: _string(json['status'], 'status'),
      assignedAt: _date(json['assignedAt'], 'assignedAt'),
      expiresAt: _date(json['expiresAt'], 'expiresAt'),
      startsAt: _date(json['startsAt'], 'startsAt'),
      endsAt: _date(json['endsAt'], 'endsAt'),
      bookingNumber: _string(json['bookingNumber'], 'bookingNumber'),
      serviceName: _string(service['name'], 'service.name'),
      serviceNameAr: _string(service['nameAr'], 'service.nameAr'),
      durationMinutes: service['durationMinutes'] as int,
      addressText: _string(location['addressText'], 'location.addressText'),
      latitude: _decimal(location['latitude'], 'location.latitude'),
      longitude: _decimal(location['longitude'], 'location.longitude'),
      instructions: json['instructions'] as String?,
    );
  }

  final String id;
  final String bookingId;
  final String companyId;
  final String teamId;
  final String companyName;
  final String teamName;
  final String status;
  final DateTime assignedAt;
  final DateTime expiresAt;
  final DateTime startsAt;
  final DateTime endsAt;
  final String bookingNumber;
  final String serviceName;
  final String serviceNameAr;
  final int durationMinutes;
  final String addressText;
  final double latitude;
  final double longitude;
  final String? instructions;
}

class ProviderNotification {
  ProviderNotification({
    required this.id,
    required this.type,
    required this.category,
    required this.referenceType,
    required this.referenceId,
    required Map<String, dynamic> payload,
    required this.readAt,
    required this.deliveredAt,
    required this.createdAt,
  }) : payload = Map.unmodifiable(payload);

  factory ProviderNotification.fromJson(Map<String, dynamic> json) =>
      ProviderNotification(
        id: _string(json['id'], 'id'),
        type: _string(json['type'], 'type'),
        category: _string(json['category'], 'category'),
        referenceType: json['referenceType'] as String?,
        referenceId: json['referenceId'] as String?,
        payload: _map(json['payload'], 'payload'),
        readAt: json['readAt'] == null ? null : _date(json['readAt'], 'readAt'),
        deliveredAt: json['deliveredAt'] == null
            ? null
            : _date(json['deliveredAt'], 'deliveredAt'),
        createdAt: _date(json['createdAt'], 'createdAt'),
      );

  final String id;
  final String type;
  final String category;
  final String? referenceType;
  final String? referenceId;
  final Map<String, dynamic> payload;
  final DateTime? readAt;
  final DateTime? deliveredAt;
  final DateTime createdAt;
}

class SettlementSummary {
  const SettlementSummary({
    required this.id,
    required this.companyId,
    required this.reference,
    required this.status,
    required this.periodStart,
    required this.periodEnd,
    required this.total,
    required this.currency,
    required this.version,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SettlementSummary.fromJson(Map<String, dynamic> json) =>
      SettlementSummary(
        id: _string(json['id'], 'id'),
        companyId: _string(json['companyId'], 'companyId'),
        reference: _string(json['reference'], 'reference'),
        status: _string(json['status'], 'status'),
        periodStart: _date(json['periodStart'], 'periodStart'),
        periodEnd: _date(json['periodEnd'], 'periodEnd'),
        total: _string(json['total'], 'total'),
        currency: _string(json['currency'], 'currency'),
        version: json['version'] as int,
        createdAt: _date(json['createdAt'], 'createdAt'),
        updatedAt: _date(json['updatedAt'], 'updatedAt'),
      );

  final String id;
  final String companyId;
  final String reference;
  final String status;
  final DateTime periodStart;
  final DateTime periodEnd;
  final String total;
  final String currency;
  final int version;
  final DateTime createdAt;
  final DateTime updatedAt;
}

class ProviderSettlementSummary {
  const ProviderSettlementSummary({
    required this.id,
    required this.companyId,
    required this.reference,
    required this.status,
    required this.periodStart,
    required this.periodEnd,
    required this.total,
    required this.currency,
    required this.paidAmount,
    required this.payoutDirection,
    required this.latestReconciliationStatus,
    required this.workItemCount,
    required this.company,
    required this.updatedAt,
  });
  factory ProviderSettlementSummary.fromJson(Map<String, dynamic> json) =>
      ProviderSettlementSummary(
        id: _string(json['id'], 'id'),
        companyId: _string(json['companyId'], 'companyId'),
        reference: _string(json['reference'], 'reference'),
        status: _string(json['status'], 'status'),
        periodStart: _date(json['periodStart'], 'periodStart'),
        periodEnd: _date(json['periodEnd'], 'periodEnd'),
        total: '${json['total']}',
        currency: _string(json['currency'], 'currency'),
        paidAmount: '${json['paidAmount']}',
        payoutDirection: _string(json['payoutDirection'], 'payoutDirection'),
        latestReconciliationStatus: json['latestReconciliationStatus'] as String?,
        workItemCount: json['workItemCount'] as int,
        company: ProviderCompany.fromJson(_map(json['company'], 'company')),
        updatedAt: _date(json['updatedAt'], 'updatedAt'),
      );
  final String id;
  final String companyId;
  final String reference;
  final String status;
  final DateTime periodStart;
  final DateTime periodEnd;
  final String total;
  final String currency;
  final String paidAmount;
  final String payoutDirection;
  final String? latestReconciliationStatus;
  final int workItemCount;
  final ProviderCompany company;
  final DateTime updatedAt;
}

class ProviderSettlementWorkItem {
  const ProviderSettlementWorkItem({
    required this.id,
    required this.amount,
    required this.bookingNumber,
    required this.scheduledAt,
    required this.serviceName,
    required this.serviceNameAr,
  });
  factory ProviderSettlementWorkItem.fromJson(Map<String, dynamic> json) {
    final booking = _map(json['booking'], 'booking');
    final service = booking['service'] == null
        ? const <String, dynamic>{}
        : _map(booking['service'], 'service');
    return ProviderSettlementWorkItem(
      id: _string(json['id'], 'id'),
      amount: '${json['amount']}',
      bookingNumber: _string(booking['bookingNumber'], 'bookingNumber'),
      scheduledAt: _date(booking['scheduledAt'], 'scheduledAt'),
      serviceName: service['name'] as String?,
      serviceNameAr: service['nameAr'] as String?,
    );
  }
  final String id;
  final String amount;
  final String bookingNumber;
  final DateTime scheduledAt;
  final String? serviceName;
  final String? serviceNameAr;
}

class ProviderSettlementPayout {
  const ProviderSettlementPayout({
    required this.id,
    required this.amount,
    required this.direction,
    required this.reference,
    required this.paidAt,
  });
  factory ProviderSettlementPayout.fromJson(Map<String, dynamic> json) =>
      ProviderSettlementPayout(
        id: _string(json['id'], 'id'),
        amount: '${json['amount']}',
        direction: _string(json['direction'], 'direction'),
        reference: _string(json['reference'], 'reference'),
        paidAt: _date(json['paidAt'], 'paidAt'),
      );
  final String id;
  final String amount;
  final String direction;
  final String reference;
  final DateTime paidAt;
}

class ProviderSettlementDetail {
  ProviderSettlementDetail({
    required this.summary,
    required List<ProviderSettlementWorkItem> workItems,
    required List<ProviderSettlementPayout> payouts,
    required this.reconciliationStatus,
    required this.reconciliationDifference,
  }) : workItems = List.unmodifiable(workItems), payouts = List.unmodifiable(payouts);
  factory ProviderSettlementDetail.fromJson(Map<String, dynamic> json) {
    final reconciliation = json['latestReconciliation'] == null
        ? null
        : _map(json['latestReconciliation'], 'latestReconciliation');
    return ProviderSettlementDetail(
      summary: ProviderSettlementSummary.fromJson({
        ...json,
        'latestReconciliationStatus': reconciliation?['status'],
        'workItemCount': _list(json['workItems'], 'workItems').length,
      }),
      workItems: _list(json['workItems'], 'workItems')
          .map((value) => ProviderSettlementWorkItem.fromJson(_map(value, 'workItem')))
          .toList(),
      payouts: _list(json['payouts'], 'payouts')
          .map((value) => ProviderSettlementPayout.fromJson(_map(value, 'payout')))
          .toList(),
      reconciliationStatus: reconciliation?['status'] as String?,
      reconciliationDifference: reconciliation == null ? null : '${reconciliation['difference']}',
    );
  }
  final ProviderSettlementSummary summary;
  final List<ProviderSettlementWorkItem> workItems;
  final List<ProviderSettlementPayout> payouts;
  final String? reconciliationStatus;
  final String? reconciliationDifference;
}
