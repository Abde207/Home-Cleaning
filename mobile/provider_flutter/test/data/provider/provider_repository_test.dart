import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/core/config/app_config.dart';
import 'package:home_clean_provider/core/errors/app_exception.dart';
import 'package:home_clean_provider/core/network/api_client.dart';
import 'package:home_clean_provider/data/provider/provider_remote_data_source.dart';
import 'package:home_clean_provider/data/provider/provider_repository_impl.dart';
import 'package:home_clean_provider/domain/provider/provider_models.dart';
import 'package:http/http.dart' as http;

import '../../helpers/fakes.dart';

http.Response envelope(Object? data) => http.Response(
  jsonEncode({
    'success': true,
    'data': data,
    'meta': {'requestId': 'r1'},
  }),
  200,
  headers: const {'content-type': 'application/json; charset=utf-8'},
);

ProviderRepositoryImpl repositoryWith(Object? Function(String path) response) {
  final api = ApiClient(
    config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'),
    tokenReader: () => testSession(),
    refreshSession: () async => false,
    httpClient: StubClient((request) => envelope(response(request.url.path))),
  );
  return ProviderRepositoryImpl(ProviderRemoteDataSource(api));
}

const company = {'id': 'company-1', 'name': 'Clean Co', 'status': 'ACTIVE'};
const team = {
  'id': 'team-1',
  'companyId': 'company-1',
  'internalCode': 'TEAM-1',
  'name': 'Team One',
  'status': 'AVAILABLE',
  'capacity': 2,
  'active': true,
};

void main() {
  test(
    'loads company and team context from existing scoped provider APIs',
    () async {
      final repository = repositoryWith(
        (path) => switch (path) {
          '/api/v1/provider/companies' => [company],
          '/api/v1/provider/teams' => [team],
          _ => throw StateError(path),
        },
      );
      final context = await repository.loadContext(managerIdentity());
      expect(context.companies.single.name, 'Clean Co');
      expect(context.teams.single.id, 'team-1');
    },
  );

  test(
    'fails closed if a provider response crosses authenticated company scope',
    () async {
      final repository = repositoryWith(
        (path) => switch (path) {
          '/api/v1/provider/companies' => [company],
          '/api/v1/provider/teams' => [
            {...team, 'companyId': 'foreign-company'},
          ],
          _ => throw StateError(path),
        },
      );
      await expectLater(
        repository.loadContext(managerIdentity()),
        throwsA(
          isA<AppException>()
              .having(
                (error) => error.kind,
                'kind',
                AppExceptionKind.serialization,
              )
              .having(
                (error) => error.code,
                'code',
                'PROVIDER_CONTEXT_INVALID',
              ),
        ),
      );
    },
  );

  test(
    'parses existing offer and notification API response contracts',
    () async {
      final repository = repositoryWith((path) {
        if (path.endsWith('/dispatch/offers')) {
          return [
            {
              'id': 'a1',
              'bookingId': 'b1',
              'companyId': 'company-1',
              'teamId': 'team-1',
              'company': {'id': 'company-1', 'name': 'Clean Co'},
              'team': {'id': 'team-1', 'name': 'Team One'},
              'status': 'OFFERED',
              'assignedAt': '2026-09-21T10:00:00Z',
              'expiresAt': '2026-09-21T10:10:00Z',
              'startsAt': '2026-09-22T10:00:00Z',
              'endsAt': '2026-09-22T12:00:00Z',
              'bookingNumber': 'HC-1',
              'service': {
                'name': 'Deep clean',
                'nameAr': 'تنظيف عميق',
                'durationMinutes': 120,
              },
              'location': {
                'addressText': 'Amman',
                'latitude': '31.95',
                'longitude': '35.91',
              },
              'instructions': 'Gate 2',
            },
          ];
        }
        if (path.endsWith('/notifications')) {
          return [
            {
              'id': 'n1',
              'type': 'ASSIGNMENT_OFFERED',
              'category': 'TRANSACTIONAL',
              'referenceType': 'OUTBOX_EVENT',
              'referenceId': 'a1',
              'payload': {'title': 'Assignment offered'},
              'readAt': null,
              'deliveredAt': null,
              'createdAt': '2026-09-21T10:00:00Z',
            },
          ];
        }
        throw StateError(path);
      });
      final offers = await repository.listOffers();
      final notifications = await repository.listNotifications();
      expect(offers.single.bookingNumber, 'HC-1');
      expect(offers.single.teamName, 'Team One');
      expect(notifications.single.type, 'ASSIGNMENT_OFFERED');
    },
  );

  test('parses provider assignment list and detail projections', () async {
    final assignment = {
      'id': 'a1',
      'bookingId': 'b1',
      'bookingNumber': 'HC-1',
      'status': 'OFFERED',
      'bookingStatus': 'TEAM_ASSIGNED',
      'startsAt': '2026-09-22T10:00:00Z',
      'endsAt': '2026-09-22T12:00:00Z',
      'assignedAt': '2026-09-21T10:00:00Z',
      'expiresAt': '2026-09-21T10:10:00Z',
      'acceptedAt': null,
      'rejectionReason': null,
      'company': {'id': 'company-1', 'name': 'Clean Co', 'status': 'ACTIVE'},
      'team': {
        'id': 'team-1',
        'name': 'Team One',
        'status': 'AVAILABLE',
        'active': true,
      },
      'service': {
        'name': 'Deep clean',
        'nameAr': 'تنظيف عميق',
        'durationMinutes': 120,
      },
      'location': {
        'addressText': 'Amman',
        'label': 'Home',
        'latitude': '31.95',
        'longitude': '35.91',
      },
      'canAccept': true,
      'canReject': true,
      'canMarkOnTheWay': false,
      'canStartCleaning': false,
      'canCompleteCleaning': false,
      'canMarkTeamNoShow': false,
      'canMarkCustomerNoShow': false,
      'cash': null,
      'property': {
        'type': 'APARTMENT',
        'size': '90',
        'rooms': 3,
        'bathrooms': 2,
      },
      'extras': [
        {'name': 'Oven', 'quantity': 1},
      ],
      'instructions': 'Gate 2',
      'completionProofs': const [],
      'canSubmitCompletionProof': false,
    };
    final repository = repositoryWith(
      (path) =>
          path.endsWith('/provider/assignments/a1') ? assignment : [assignment],
    );
    final rows = await repository.listAssignments(view: AssignmentView.pending);
    final detail = await repository.assignmentDetail('a1');
    expect(rows.single.team.id, 'team-1');
    expect(detail.property.rooms, 3);
    expect(detail.extras.single.name, 'Oven');
  });

  test('parses and rechecks existing company-scoped settlement list', () async {
    final repository = repositoryWith(
      (path) => switch (path) {
        '/api/v1/provider/companies' => [company],
        '/api/v1/provider/teams' => [team],
        '/api/v1/settlements' => [
          {
            'id': 's1',
            'companyId': 'company-1',
            'reference': 'HC-SET-1',
            'status': 'CALCULATED',
            'periodStart': '2026-09-01T00:00:00Z',
            'periodEnd': '2026-09-15T00:00:00Z',
            'total': '41.25',
            'currency': 'JOD',
            'version': 1,
            'createdAt': '2026-09-16T00:00:00Z',
            'updatedAt': '2026-09-16T00:00:00Z',
          },
        ],
        _ => throw StateError(path),
      },
    );
    await repository.loadContext(managerIdentity());
    final rows = await repository.listSettlements();
    expect(rows.single.companyId, 'company-1');
  });

  test('job commands use authoritative endpoints, payloads and keys', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
      config: const AppConfig(apiBaseUrl: 'https://api.example.test/api/v1'),
      tokenReader: () => testSession(),
      refreshSession: () async => false,
      httpClient: StubClient((request) {
        requests.add(request as http.Request);
        return envelope({'accepted': true});
      }),
    );
    final repository = ProviderRepositoryImpl(ProviderRemoteDataSource(api));
    await repository.markOnTheWay('a1', idempotencyKey: 'way-1');
    await repository.startCleaning('a1', idempotencyKey: 'start-1');
    await repository.completeCleaning('a1', idempotencyKey: 'complete-1');
    await repository.submitCompletionProof(
      'a1',
      idempotencyKey: 'proof-1',
      proof: const CompletionProofInput(
        storageKey: 'approved/proof-1',
        mimeType: 'image/jpeg',
        byteSize: 128,
      ),
    );
    await repository.collectCash(
      'a1',
      idempotencyKey: 'cash-1',
      amount: '25.00',
    );
    await repository.markTeamNoShow('a1', idempotencyKey: 'team-no-show-1');
    await repository.markCustomerNoShow(
      'a1',
      idempotencyKey: 'customer-no-show-1',
    );
    expect(
      requests.map((request) => request.url.path),
      containsAll(<String>[
        '/api/v1/assignments/a1/on-the-way',
        '/api/v1/assignments/a1/start-cleaning',
        '/api/v1/assignments/a1/complete-cleaning',
        '/api/v1/assignments/a1/completion-proof',
        '/api/v1/assignments/a1/collect-cash',
        '/api/v1/assignments/a1/team-no-show',
        '/api/v1/assignments/a1/customer-no-show',
      ]),
    );
    expect(requests[0].headers['Idempotency-Key'], 'way-1');
    expect(jsonDecode(requests[3].body)['storageKey'], 'approved/proof-1');
    expect(jsonDecode(requests[4].body)['amount'], '25.00');
  });

  test('parses scoped team detail and provider-safe settlement projections', () async {
    final repository = repositoryWith((path) => switch (path) {
      '/api/v1/provider/companies' => [company],
      '/api/v1/provider/teams' => [team],
      '/api/v1/provider/teams/team-1' => {
        ...team,
        'company': company,
        'latitude': '31.95',
        'longitude': '35.91',
        'locationAt': '2030-01-01T00:00:00Z',
        'updatedAt': '2030-01-01T00:00:00Z',
      },
      '/api/v1/provider/settlements' => [{
        'id': 's1', 'companyId': 'company-1', 'reference': 'HC-SET-1', 'status': 'PAID',
        'periodStart': '2030-01-01T00:00:00Z', 'periodEnd': '2030-02-01T00:00:00Z',
        'total': '72', 'currency': 'JOD', 'paidAmount': '72', 'payoutDirection': 'TO_PROVIDER',
        'latestReconciliationStatus': 'MATCHED', 'workItemCount': 1, 'company': company,
        'updatedAt': '2030-02-02T00:00:00Z',
      }],
      '/api/v1/provider/settlements/s1' => {
        'id': 's1', 'companyId': 'company-1', 'reference': 'HC-SET-1', 'status': 'PAID',
        'periodStart': '2030-01-01T00:00:00Z', 'periodEnd': '2030-02-01T00:00:00Z',
        'total': '72', 'currency': 'JOD', 'paidAmount': '72', 'payoutDirection': 'TO_PROVIDER',
        'company': company, 'updatedAt': '2030-02-02T00:00:00Z',
        'workItems': [{'id': 'i1', 'amount': '72', 'booking': {'bookingNumber': 'HC-1', 'scheduledAt': '2030-01-12T00:00:00Z', 'service': {'name': 'Deep clean', 'nameAr': 'تنظيف عميق'}}}],
        'payouts': [{'id': 'p1', 'amount': '72', 'direction': 'TO_PROVIDER', 'reference': 'PAY-1', 'paidAt': '2030-02-02T00:00:00Z'}],
        'latestReconciliation': {'status': 'MATCHED', 'difference': '0'},
      },
      _ => throw StateError(path),
    });
    await repository.loadContext(managerIdentity());
    final detail = await repository.teamDetail('team-1');
    final rows = await repository.listProviderSettlements();
    final settlement = await repository.providerSettlementDetail('s1');
    expect(detail.latitude, 31.95);
    expect(rows.single.paidAmount, '72');
    expect(settlement.workItems.single.serviceName, 'Deep clean');
    expect(settlement.reconciliationStatus, 'MATCHED');
  });
}
