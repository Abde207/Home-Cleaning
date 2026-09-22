import 'package:flutter/foundation.dart';

import '../../core/errors/app_exception.dart';
import '../../core/services/request_metadata_service.dart';
import '../../domain/provider/provider_models.dart';
import '../../domain/provider/provider_repository.dart';

class ProviderOperationsController extends ChangeNotifier {
  ProviderOperationsController(
    this._repository, {
    RequestMetadataService? metadata,
  }) : _metadata = metadata ?? RequestMetadataService();

  final ProviderRepository _repository;
  final RequestMetadataService _metadata;

  bool dashboardLoading = false;
  AppException? dashboardError;
  List<ProviderAssignmentSummary> pendingAssignments = const [];
  List<ProviderAssignmentSummary> activeAssignments = const [];
  List<ProviderAssignmentSummary> cashAssignments = const [];
  List<ProviderNotification> notifications = const [];

  bool inboxLoading = false;
  AppException? inboxError;
  AssignmentView inboxView = AssignmentView.pending;
  List<ProviderAssignmentSummary> assignments = const [];

  bool detailLoading = false;
  AppException? detailError;
  ProviderAssignmentDetail? detail;

  bool notificationsLoading = false;
  AppException? notificationsError;

  final Set<String> _busyAssignments = {};
  final Map<String, String> _commandKeys = {};
  bool isAssignmentBusy(String id) => _busyAssignments.contains(id);

  Future<void> loadDashboard(ProviderIdentity identity) async {
    if (dashboardLoading) return;
    dashboardLoading = true;
    dashboardError = null;
    notifyListeners();
    try {
      final results = await Future.wait<Object>([
        _repository.listAssignments(view: AssignmentView.pending, limit: 5),
        _repository.listAssignments(view: AssignmentView.active, limit: 5),
        _repository.listNotifications(limit: 5),
        if (identity.canViewCashWorklist)
          _repository.cashWorklist(state: 'EXPECTED')
        else
          Future.value(<ProviderAssignmentSummary>[]),
      ]);
      pendingAssignments = results[0] as List<ProviderAssignmentSummary>;
      activeAssignments = results[1] as List<ProviderAssignmentSummary>;
      notifications = results[2] as List<ProviderNotification>;
      cashAssignments = results[3] as List<ProviderAssignmentSummary>;
    } on AppException catch (error) {
      dashboardError = error;
    } on Object catch (error) {
      dashboardError = AppException(
        kind: AppExceptionKind.serialization,
        message: 'Invalid provider dashboard response.',
        cause: error,
      );
    } finally {
      dashboardLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAssignments([AssignmentView? view]) async {
    if (inboxLoading) return;
    inboxView = view ?? inboxView;
    inboxLoading = true;
    inboxError = null;
    notifyListeners();
    try {
      assignments = await _repository.listAssignments(view: inboxView);
    } on AppException catch (error) {
      inboxError = error;
    } on Object catch (error) {
      inboxError = AppException(
        kind: AppExceptionKind.serialization,
        message: 'Invalid assignment response.',
        cause: error,
      );
    } finally {
      inboxLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadDetail(String id) async {
    detailLoading = true;
    detailError = null;
    detail = null;
    notifyListeners();
    try {
      detail = await _repository.assignmentDetail(id);
    } on AppException catch (error) {
      detailError = error;
    } on Object catch (error) {
      detailError = AppException(
        kind: AppExceptionKind.serialization,
        message: 'Invalid assignment detail.',
        cause: error,
      );
    } finally {
      detailLoading = false;
      notifyListeners();
    }
  }

  Future<bool> accept(String id) => _command(
    id,
    'accept',
    (key) => _repository.acceptAssignment(id, idempotencyKey: key),
  );

  Future<bool> reject(String id, String? reason) => _command(
    id,
    'reject',
    (key) =>
        _repository.rejectAssignment(id, idempotencyKey: key, reason: reason),
  );

  Future<bool> markOnTheWay(String id) => _command(
    id, 'on-the-way',
    (key) => _repository.markOnTheWay(id, idempotencyKey: key),
  );

  Future<bool> startCleaning(String id) => _command(
    id, 'start-cleaning',
    (key) => _repository.startCleaning(id, idempotencyKey: key),
  );

  Future<bool> completeCleaning(String id) => _command(
    id, 'complete-cleaning',
    (key) => _repository.completeCleaning(id, idempotencyKey: key),
  );

  Future<bool> submitCompletionProof(
    String id,
    CompletionProofInput proof,
  ) => _command(
    id, 'completion-proof',
    (key) => _repository.submitCompletionProof(
      id, idempotencyKey: key, proof: proof,
    ),
  );

  Future<bool> collectCash(String id, String amount) => _command(
    id, 'collect-cash',
    (key) => _repository.collectCash(
      id, idempotencyKey: key, amount: amount,
    ),
  );

  Future<bool> markTeamNoShow(String id) => _command(
    id, 'team-no-show',
    (key) => _repository.markTeamNoShow(id, idempotencyKey: key),
  );

  Future<bool> markCustomerNoShow(String id) => _command(
    id, 'customer-no-show',
    (key) => _repository.markCustomerNoShow(id, idempotencyKey: key),
  );

  Future<bool> _command(
    String id,
    String action,
    Future<void> Function(String key) run,
  ) async {
    if (_busyAssignments.contains(id)) return false;
    final command = '$action:$id';
    final key = _commandKeys.putIfAbsent(
      command,
      () => _metadata.idempotencyKey('assignment-$action'),
    );
    _busyAssignments.add(id);
    detailError = null;
    notifyListeners();
    try {
      await run(key);
      _commandKeys.remove(command);
      await loadDetail(id);
      return true;
    } on AppException catch (error) {
      detailError = error;
      if (!error.isOffline) _commandKeys.remove(command);
      return false;
    } finally {
      _busyAssignments.remove(id);
      notifyListeners();
    }
  }

  Future<void> loadNotifications() async {
    if (notificationsLoading) return;
    notificationsLoading = true;
    notificationsError = null;
    notifyListeners();
    try {
      notifications = await _repository.listNotifications();
    } on AppException catch (error) {
      notificationsError = error;
    } finally {
      notificationsLoading = false;
      notifyListeners();
    }
  }

  Future<String?> openNotification(ProviderNotification notification) async {
    if (notification.readAt == null) {
      try {
        await _repository.markNotificationRead(notification.id);
      } on AppException {
        /* Detail remains independently recoverable. */
      }
    }
    if (notification.type.startsWith('ASSIGNMENT_') &&
        notification.referenceId != null) {
      return notification.referenceId;
    }
    return null;
  }

  void clear() {
    pendingAssignments = const [];
    activeAssignments = const [];
    cashAssignments = const [];
    notifications = const [];
    assignments = const [];
    detail = null;
    dashboardError = inboxError = detailError = notificationsError = null;
    _busyAssignments.clear();
    _commandKeys.clear();
    notifyListeners();
  }
}
