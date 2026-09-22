import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:home_clean_provider/application/auth/auth_controller.dart';
import 'package:home_clean_provider/application/provider/provider_operations_controller.dart';
import 'package:home_clean_provider/core/errors/app_exception.dart';
import 'package:home_clean_provider/core/localization/app_localizations.dart';
import 'package:home_clean_provider/domain/provider/provider_models.dart';
import 'package:home_clean_provider/presentation/assignments/assignment_detail_page.dart';
import 'package:home_clean_provider/presentation/assignments/assignment_inbox_page.dart';
import 'package:home_clean_provider/presentation/home/home_page.dart';
import 'package:home_clean_provider/presentation/notifications/notifications_page.dart';

import '../helpers/fakes.dart';

Widget app(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
  locale: locale,
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: child,
);

class WaitingRepository extends FakeProviderRepository {
  final gate = Completer<List<ProviderAssignmentSummary>>();
  @override
  Future<List<ProviderAssignmentSummary>> listAssignments({
    AssignmentView? view,
    String? status,
    int limit = 100,
    int offset = 0,
    cancellation,
  }) => gate.future;
}

class ErrorRepository extends FakeProviderRepository {
  @override
  Future<List<ProviderAssignmentSummary>> listAssignments({
    AssignmentView? view,
    String? status,
    int limit = 100,
    int offset = 0,
    cancellation,
  }) => throw const AppException(
    kind: AppExceptionKind.notFound,
    message: 'gone',
    statusCode: 404,
  );
}

void main() {
  testWidgets('dashboard renders server-backed pending and active work', (
    tester,
  ) async {
    final repository = FakeProviderRepository()
      ..assignmentRows = [testAssignment()];
    final auth = AuthController(FakeAuthRepository(), repository)
      ..status = AuthStatus.authenticated
      ..identity = managerIdentity()
      ..providerContext = managerContext();
    await tester.pumpWidget(
      app(
        HomePage(
          auth: auth,
          operations: ProviderOperationsController(repository),
          onNavigate: (_) {},
          onOpenAssignment: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Pending offers'), findsOneWidget);
    expect(find.text('HC-1'), findsWidgets);
    expect(find.textContaining('Team One'), findsWidgets);
  });

  testWidgets('assignment inbox shows loading then empty state', (
    tester,
  ) async {
    final repository = WaitingRepository();
    final controller = ProviderOperationsController(repository);
    await tester.pumpWidget(
      app(
        AssignmentInboxPage(
          controller: controller,
          onNavigate: (_) {},
          onOpenAssignment: (_) {},
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    repository.gate.complete([]);
    await tester.pumpAndSettle();
    expect(find.text('No assignments in this view.'), findsOneWidget);
  });

  testWidgets('assignment inbox renders safe error state', (tester) async {
    await tester.pumpWidget(
      app(
        AssignmentInboxPage(
          controller: ProviderOperationsController(ErrorRepository()),
          onNavigate: (_) {},
          onOpenAssignment: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('This operational record is no longer available.'),
      findsOneWidget,
    );
  });

  testWidgets('assignment detail accepts once through confirmation', (
    tester,
  ) async {
    final repository = FakeProviderRepository();
    String? activeJob;
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
          onOpenActiveJob: (id) => activeJob = id,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1000));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Accept offer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(repository.acceptCalls, 1);
    expect(activeJob, 'assignment-1');
  });

  testWidgets('assignment detail sends an optional rejection reason', (
    tester,
  ) async {
    final repository = FakeProviderRepository();
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1000));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reject offer'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Unavailable');
    await tester.tap(find.text('Reject offer').last);
    await tester.pumpAndSettle();
    expect(repository.rejectCalls, 1);
  });

  testWidgets(
    'assignment notification navigates by reference without trusting payload state',
    (tester) async {
      final repository = FakeProviderRepository()
        ..notificationRows = [
          ProviderNotification(
            id: 'n1',
            type: 'ASSIGNMENT_OFFERED',
            category: 'TRANSACTIONAL',
            referenceType: 'OUTBOX_EVENT',
            referenceId: 'assignment-1',
            payload: const {'status': 'REJECTED'},
            readAt: null,
            deliveredAt: null,
            createdAt: DateTime.utc(2030),
          ),
        ];
      String? opened;
      await tester.pumpWidget(
        app(
          NotificationsPage(
            controller: ProviderOperationsController(repository),
            onNavigate: (_) {},
            onOpenAssignment: (id) => opened = id,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('New assignment offer'));
      await tester.pumpAndSettle();
      expect(opened, 'assignment-1');
      expect(repository.readCalls, 1);
    },
  );

  testWidgets('Arabic assignment inbox is RTL and localized', (tester) async {
    final repository = FakeProviderRepository()
      ..assignmentRows = [testAssignment()];
    await tester.pumpWidget(
      app(
        AssignmentInboxPage(
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
          onOpenAssignment: (_) {},
        ),
        locale: const Locale('ar'),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      Directionality.of(tester.element(find.text('المهام').first)),
      TextDirection.rtl,
    );
    expect(find.text('العروض المعلّقة'), findsOneWidget);
    expect(find.text('معروضة'), findsOneWidget);
  });

  testWidgets('active job marks on the way once through confirmation', (
    tester,
  ) async {
    final repository = FakeProviderRepository();
    final summary = testAssignment(
      status: 'ACCEPTED',
      bookingStatus: 'TEAM_ACCEPTED',
      canAccept: false,
      canReject: false,
      canMarkOnTheWay: true,
    );
    repository.assignmentValue = testAssignmentDetail(summary: summary);
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
          activeJob: true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mark on the way'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(repository.onTheWayCalls, 1);
  });

  testWidgets('completion proof submits existing immutable reference metadata', (
    tester,
  ) async {
    final repository = FakeProviderRepository();
    final summary = testAssignment(
      status: 'COMPLETED',
      bookingStatus: 'CLEANING_COMPLETED',
      canAccept: false,
      canReject: false,
    );
    repository.assignmentValue = testAssignmentDetail(
      summary: summary,
      canSubmitCompletionProof: true,
    );
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1500));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit proof reference'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('proof-reference')), 'approved/proof-1');
    await tester.enterText(find.byKey(const Key('proof-size')), '128');
    await tester.tap(find.text('Submit proof reference').last);
    await tester.pumpAndSettle();
    expect(repository.proofCalls, 1);
  });

  testWidgets('cash collection remains a server command', (
    tester,
  ) async {
    final repository = FakeProviderRepository();
    final summary = testAssignment(
      status: 'COMPLETED',
      bookingStatus: 'CLEANING_COMPLETED',
      canAccept: false,
      canReject: false,
      cash: const ProviderCashProjection(
        expectedAmount: '25.00',
        currency: 'JOD',
        collectionState: 'EXPECTED',
        canCollect: true,
      ),
    );
    repository.assignmentValue = testAssignmentDetail(summary: summary);
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1500));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm cash collected'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(repository.cashCalls, 1);
  });

  testWidgets('customer no-show remains a server command', (tester) async {
    final repository = FakeProviderRepository();
    final noShowSummary = testAssignment(
      status: 'ACCEPTED',
      bookingStatus: 'CLEANING_STARTED',
      canAccept: false,
      canReject: false,
      canMarkCustomerNoShow: true,
    );
    repository.assignmentValue = testAssignmentDetail(summary: noShowSummary);
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1500));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Customer no-show'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(repository.customerNoShowCalls, 1);
  });

  testWidgets('Arabic active job action is RTL and localized', (tester) async {
    final repository = FakeProviderRepository();
    final summary = testAssignment(
      status: 'ACCEPTED',
      bookingStatus: 'TEAM_ON_THE_WAY',
      canAccept: false,
      canReject: false,
      canStartCleaning: true,
    );
    repository.assignmentValue = testAssignmentDetail(summary: summary);
    await tester.pumpWidget(
      app(
        AssignmentDetailPage(
          assignmentId: 'assignment-1',
          controller: ProviderOperationsController(repository),
          onNavigate: (_) {},
          activeJob: true,
        ),
        locale: const Locale('ar'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await tester.pumpAndSettle();
    expect(find.text('بدء العمل'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('بدء العمل'))),
      TextDirection.rtl,
    );
  });
}
