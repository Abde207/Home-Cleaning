import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/application/provider/provider_operations_controller.dart';
import 'package:home_clean_provider/core/errors/app_exception.dart';
import 'package:home_clean_provider/domain/provider/provider_models.dart';

import '../../helpers/fakes.dart';

class SlowProviderRepository extends FakeProviderRepository {
  final acceptGate = Completer<void>();
  @override
  Future<void> acceptAssignment(
    String id, {
    required String idempotencyKey,
  }) async {
    acceptCalls++;
    await acceptGate.future;
  }
}

class FailingProviderRepository extends FakeProviderRepository {
  FailingProviderRepository(this.failure);
  final AppException failure;
  @override
  Future<List<ProviderAssignmentSummary>> listAssignments({
    AssignmentView? view,
    String? status,
    int limit = 100,
    int offset = 0,
    cancellation,
  }) => throw failure;
  @override
  Future<void> acceptAssignment(String id, {required String idempotencyKey}) =>
      throw failure;
}

class TimeoutOnceRepository extends FakeProviderRepository {
  final List<String> keys = [];
  @override
  Future<void> startCleaning(
    String id, {
    required String idempotencyKey,
  }) async {
    keys.add(idempotencyKey);
    if (keys.length == 1) {
      throw const AppException(
        kind: AppExceptionKind.timeout,
        message: 'timeout',
      );
    }
    await super.startCleaning(id, idempotencyKey: idempotencyKey);
  }
}

class FailingDetailRepository extends FakeProviderRepository {
  FailingDetailRepository(this.failure);
  final AppException failure;
  @override
  Future<ProviderAssignmentDetail> assignmentDetail(
    String id, {
    cancellation,
  }) => throw failure;
}

void main() {
  test(
    'dashboard loads authoritative pending, active and notification sections',
    () async {
      final repository = FakeProviderRepository()
        ..assignmentRows = [testAssignment()]
        ..notificationRows = [
          ProviderNotification(
            id: 'n1',
            type: 'ASSIGNMENT_OFFERED',
            category: 'TRANSACTIONAL',
            referenceType: 'OUTBOX_EVENT',
            referenceId: 'assignment-1',
            payload: const {},
            readAt: null,
            deliveredAt: null,
            createdAt: DateTime.utc(2030),
          ),
        ];
      final controller = ProviderOperationsController(repository);
      await controller.loadDashboard(managerIdentity());
      expect(controller.pendingAssignments.single.id, 'assignment-1');
      expect(controller.activeAssignments.single.id, 'assignment-1');
      expect(controller.notifications.single.id, 'n1');
      expect(controller.dashboardError, isNull);
    },
  );

  test(
    'assignment inbox and detail are recovered from repository state',
    () async {
      final repository = FakeProviderRepository()
        ..assignmentRows = [
          testAssignment(
            status: 'ACCEPTED',
            canAccept: false,
            canReject: false,
          ),
        ];
      final controller = ProviderOperationsController(repository);
      await controller.loadAssignments(AssignmentView.active);
      await controller.loadDetail('assignment-1');
      expect(controller.inboxView, AssignmentView.active);
      expect(controller.assignments.single.status, 'ACCEPTED');
      expect(controller.detail!.summary.id, 'assignment-1');
    },
  );

  test(
    'accept and reject invoke command repositories and refresh detail',
    () async {
      final repository = FakeProviderRepository();
      final controller = ProviderOperationsController(repository);
      expect(await controller.accept('assignment-1'), isTrue);
      expect(await controller.reject('assignment-1', 'Unavailable'), isTrue);
      expect(repository.acceptCalls, 1);
      expect(repository.rejectCalls, 1);
      expect(controller.detail!.summary.id, 'assignment-1');
    },
  );

  test(
    'duplicate taps are blocked while an accept command is in flight',
    () async {
      final repository = SlowProviderRepository();
      final controller = ProviderOperationsController(repository);
      final first = controller.accept('assignment-1');
      await Future<void>.delayed(Duration.zero);
      expect(await controller.accept('assignment-1'), isFalse);
      expect(repository.acceptCalls, 1);
      repository.acceptGate.complete();
      expect(await first, isTrue);
    },
  );

  test(
    'operational conflicts remain visible for authoritative refresh',
    () async {
      final controller = ProviderOperationsController(
        FailingProviderRepository(
          const AppException(
            kind: AppExceptionKind.conflict,
            code: 'ASSIGNMENT_EXPIRED',
            message: 'conflict',
            statusCode: 409,
          ),
        ),
      );
      expect(await controller.accept('assignment-1'), isFalse);
      expect(controller.detailError?.kind, AppExceptionKind.conflict);
      expect(controller.detailError?.code, 'ASSIGNMENT_EXPIRED');
    },
  );

  test(
    'assignment notification resolves its assignment only after read attempt',
    () async {
      final repository = FakeProviderRepository();
      final controller = ProviderOperationsController(repository);
      final id = await controller.openNotification(
        ProviderNotification(
          id: 'n1',
          type: 'ASSIGNMENT_OFFERED',
          category: 'TRANSACTIONAL',
          referenceType: 'OUTBOX_EVENT',
          referenceId: 'assignment-1',
          payload: const {'status': 'stale'},
          readAt: null,
          deliveredAt: null,
          createdAt: DateTime.utc(2030),
        ),
      );
      expect(id, 'assignment-1');
      expect(repository.readCalls, 1);
    },
  );

  test(
    'forbidden list failure produces an error instead of local fallback data',
    () async {
      final controller = ProviderOperationsController(
        FailingProviderRepository(
          const AppException(
            kind: AppExceptionKind.forbidden,
            message: 'forbidden',
            statusCode: 403,
          ),
        ),
      );
      await controller.loadAssignments();
      expect(controller.assignments, isEmpty);
      expect(controller.inboxError?.kind, AppExceptionKind.forbidden);
    },
  );

  test('job execution commands refresh authoritative assignment detail', () async {
    final repository = FakeProviderRepository();
    final controller = ProviderOperationsController(repository);
    expect(await controller.markOnTheWay('assignment-1'), isTrue);
    expect(await controller.startCleaning('assignment-1'), isTrue);
    expect(await controller.completeCleaning('assignment-1'), isTrue);
    expect(
      await controller.submitCompletionProof(
        'assignment-1',
        const CompletionProofInput(
          storageKey: 'approved/proof-1',
          mimeType: 'image/jpeg',
          byteSize: 128,
        ),
      ),
      isTrue,
    );
    expect(await controller.collectCash('assignment-1', '25.00'), isTrue);
    expect(await controller.markTeamNoShow('assignment-1'), isTrue);
    expect(await controller.markCustomerNoShow('assignment-1'), isTrue);
    expect(repository.onTheWayCalls, 1);
    expect(repository.startCalls, 1);
    expect(repository.completeCalls, 1);
    expect(repository.proofCalls, 1);
    expect(repository.cashCalls, 1);
    expect(repository.teamNoShowCalls, 1);
    expect(repository.customerNoShowCalls, 1);
    expect(controller.detail?.summary.id, 'assignment-1');
  });

  test('timeout retry reuses the same command idempotency key', () async {
    final repository = TimeoutOnceRepository();
    final controller = ProviderOperationsController(repository);
    expect(await controller.startCleaning('assignment-1'), isFalse);
    expect(controller.detailError?.kind, AppExceptionKind.timeout);
    expect(await controller.startCleaning('assignment-1'), isTrue);
    expect(repository.keys, hasLength(2));
    expect(repository.keys[1], repository.keys[0]);
  });

  for (final failure in <AppException>[
    const AppException(kind: AppExceptionKind.unauthorized, message: '401', statusCode: 401),
    const AppException(kind: AppExceptionKind.forbidden, message: '403', statusCode: 403),
    const AppException(kind: AppExceptionKind.notFound, message: '404', statusCode: 404),
    const AppException(kind: AppExceptionKind.conflict, message: '409', statusCode: 409),
  ]) {
    test('detail recovery preserves ${failure.statusCode} failure state', () async {
      final controller = ProviderOperationsController(FailingDetailRepository(failure));
      await controller.loadDetail('assignment-1');
      expect(controller.detail, isNull);
      expect(controller.detailError?.statusCode, failure.statusCode);
    });
  }
}
