import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/domain/provider/provider_models.dart';

void main() {
  test('parses backend identity and recognizes a manager provider scope', () {
    final identity = ProviderIdentity.fromJson({
      'id': 'u1',
      'name': 'Rana',
      'phone': '+962790000001',
      'locale': 'ar',
      'scopes': [
        {
          'role': 'COMPANY_MANAGER',
          'companyId': 'c1',
          'teamId': null,
          'permissions': ['company:own', 'team:company', 'assignment:company'],
        },
      ],
    });
    expect(identity.isProviderAuthorized, isTrue);
    expect(identity.providerScopes.single.companyId, 'c1');
  });

  test('customer identity is not authorized for provider routes', () {
    final identity = ProviderIdentity.fromJson({
      'id': 'u1',
      'name': null,
      'phone': '+962790000001',
      'locale': 'en',
      'scopes': [
        {
          'role': 'CUSTOMER',
          'companyId': null,
          'teamId': null,
          'permissions': ['booking:own'],
        },
      ],
    });
    expect(identity.isProviderAuthorized, isFalse);
  });

  test('cleaner scope requires both backend company and team scope', () {
    final scope = ProviderScope.fromJson({
      'role': 'TEAM_LEADER_CLEANER',
      'companyId': 'c1',
      'teamId': null,
      'permissions': ['assignment:team', 'job:team'],
    });
    expect(scope.isProviderScope, isFalse);
  });

  test('parses the exact provider team projection', () {
    final team = ProviderTeam.fromJson({
      'id': 't1',
      'companyId': 'c1',
      'internalCode': 'TEAM-1',
      'name': 'North',
      'status': 'AVAILABLE',
      'capacity': 3,
      'active': true,
    });
    expect(team.companyId, 'c1');
    expect(team.capacity, 3);
  });

  test('parses the exact dispatch offer projection', () {
    final offer = ProviderOffer.fromJson({
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
        'longitude': 35.91,
      },
      'instructions': null,
    });
    expect(offer.serviceNameAr, 'تنظيف عميق');
    expect(offer.latitude, 31.95);
  });

  test(
    'parses company-scoped settlement summary without calculating money',
    () {
      final settlement = SettlementSummary.fromJson({
        'id': 's1',
        'companyId': 'c1',
        'reference': 'HC-SET-1',
        'status': 'CALCULATED',
        'periodStart': '2026-09-01T00:00:00Z',
        'periodEnd': '2026-09-15T00:00:00Z',
        'total': '41.25',
        'currency': 'JOD',
        'version': 1,
        'createdAt': '2026-09-16T00:00:00Z',
        'updatedAt': '2026-09-16T00:00:00Z',
      });
      expect(settlement.total, '41.25');
      expect(settlement.currency, 'JOD');
    },
  );
}
