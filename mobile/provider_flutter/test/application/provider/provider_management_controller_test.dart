import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/application/provider/provider_management_controller.dart';

import '../../helpers/fakes.dart';

void main() {
  test('team list and detail recover authoritative scoped projections', () async {
    final repository = FakeProviderRepository();
    final controller = ProviderManagementController(repository);
    await controller.loadTeams();
    expect(controller.teams.single.id, 'team-1');
    await controller.openTeam('team-1');
    expect(controller.selectedTeam!.company.id, 'company-1');
    expect(controller.members.single.name, 'Cleaner');
    expect(controller.capabilityIds, {'service-1'});
  });

  test('team commands refresh the authoritative list and detail', () async {
    final repository = FakeProviderRepository();
    final controller = ProviderManagementController(repository);
    await controller.openTeam('team-1');
    expect(await controller.updateStatus('team-1', 'BUSY'), isTrue);
    expect(await controller.replaceCapabilities('team-1', {'service-1'}), isTrue);
    expect(repository.teamMutationCalls, 2);
    expect(controller.selectedTeam!.team.id, 'team-1');
  });

  test('settlement list and detail remain repository projections', () async {
    final repository = FakeProviderRepository()
      ..settlementRows = [testSettlementSummary()]
      ..settlementValue = testSettlementDetail();
    final controller = ProviderManagementController(repository);
    await controller.loadSettlements();
    expect(controller.settlements.single.total, '72.00');
    await controller.openSettlement('settlement-1');
    expect(controller.selectedSettlement!.workItems.single.bookingNumber, 'HC-1');
    expect(controller.selectedSettlement!.payouts.single.reference, 'PAYOUT-1');
  });

  test('clear removes team and financial state after logout', () async {
    final repository = FakeProviderRepository()..settlementRows = [testSettlementSummary()];
    final controller = ProviderManagementController(repository);
    await controller.loadTeams();
    await controller.loadSettlements();
    controller.clear();
    expect(controller.teams, isEmpty);
    expect(controller.settlements, isEmpty);
    expect(controller.selectedTeam, isNull);
    expect(controller.selectedSettlement, isNull);
  });
}
