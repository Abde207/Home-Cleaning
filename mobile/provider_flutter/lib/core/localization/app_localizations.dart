import 'package:flutter/material.dart';

class AppLocalizations {
  const AppLocalizations(this.locale);
  final Locale locale;

  static const supportedLocales = [Locale('ar'), Locale('en')];
  static const delegate = _AppLocalizationsDelegate();
  static AppLocalizations of(BuildContext context) =>
      Localizations.of<AppLocalizations>(context, AppLocalizations)!;

  bool get isArabic => locale.languageCode == 'ar';
  String get appName => _t('appName');
  String get providerPortal => _t('providerPortal');
  String get welcome => _t('welcome');
  String get signInSubtitle => _t('signInSubtitle');
  String get phoneNumber => _t('phoneNumber');
  String get phoneHint => _t('phoneHint');
  String get sendCode => _t('sendCode');
  String get verificationCode => _t('verificationCode');
  String get verify => _t('verify');
  String get resend => _t('resend');
  String get home => _t('home');
  String get assignments => _t('assignments');
  String get assignmentDetails => _t('assignmentDetails');
  String get activeJob => _t('activeJob');
  String get team => _t('team');
  String get notifications => _t('notifications');
  String get profile => _t('profile');
  String get financials => _t('financials');
  String get logout => _t('logout');
  String get retry => _t('retry');
  String get loading => _t('loading');
  String get empty => _t('empty');
  String get foundationReady => _t('foundationReady');
  String get foundationOnly => _t('foundationOnly');
  String get operationalOverview => _t('operationalOverview');
  String get companies => _t('companies');
  String get teams => _t('teams');
  String get role => _t('role');
  String get permissions => _t('permissions');
  String get comingLater => _t('comingLater');
  String get accessDeniedTitle => _t('accessDeniedTitle');
  String get accessDeniedBody => _t('accessDeniedBody');
  String get errorTitle => _t('errorTitle');
  String get networkError => _t('networkError');
  String get timeoutError => _t('timeoutError');
  String get sessionExpired => _t('sessionExpired');
  String get forbidden => _t('forbidden');
  String get unavailable => _t('unavailable');
  String get conflict => _t('conflict');
  String get invalidInput => _t('invalidInput');
  String get serverError => _t('serverError');
  String get invalidResponse => _t('invalidResponse');
  String get configurationError => _t('configurationError');
  String get confirm => _t('confirm');
  String get cancel => _t('cancel');
  String get pendingOffers => _t('pendingOffers');
  String get acceptedActive => _t('acceptedActive');
  String get history => _t('history');
  String get noAssignments => _t('noAssignments');
  String get noPendingOffers => _t('noPendingOffers');
  String get noActiveAssignments => _t('noActiveAssignments');
  String get acceptOffer => _t('acceptOffer');
  String get rejectOffer => _t('rejectOffer');
  String get acceptOfferConfirmation => _t('acceptOfferConfirmation');
  String get rejectionReason => _t('rejectionReason');
  String get location => _t('location');
  String get property => _t('property');
  String get propertyType => _t('propertyType');
  String get size => _t('size');
  String get rooms => _t('rooms');
  String get bathrooms => _t('bathrooms');
  String get extras => _t('extras');
  String get instructions => _t('instructions');
  String get cashRequired => _t('cashRequired');
  String get cashWorklist => _t('cashWorklist');
  String get noCashDue => _t('noCashDue');
  String get noNotifications => _t('noNotifications');
  String get viewAll => _t('viewAll');
  String get capacity => _t('capacity');
  String get onTheWay => _t('onTheWay');
  String get startWork => _t('startWork');
  String get completeWork => _t('completeWork');
  String get teamNoShow => _t('teamNoShow');
  String get customerNoShow => _t('customerNoShow');
  String get collectCash => _t('collectCash');
  String get submitProof => _t('submitProof');
  String get completionProof => _t('completionProof');
  String get proofReference => _t('proofReference');
  String get proofMimeType => _t('proofMimeType');
  String get proofByteSize => _t('proofByteSize');
  String get proofReferenceHelp => _t('proofReferenceHelp');
  String get noProof => _t('noProof');
  String get confirmOperationalAction => _t('confirmOperationalAction');
  String get cashConfirmation => _t('cashConfirmation');
  String get teamManagement => _t('teamManagement');
  String get createTeam => _t('createTeam');
  String get editTeam => _t('editTeam');
  String get teamName => _t('teamName');
  String get internalCode => _t('internalCode');
  String get activeTeam => _t('activeTeam');
  String get teamStatus => _t('teamStatus');
  String get noTeams => _t('noTeams');
  String get teamMembers => _t('teamMembers');
  String get noTeamMembers => _t('noTeamMembers');
  String get availability => _t('availability');
  String get addAvailability => _t('addAvailability');
  String get noAvailability => _t('noAvailability');
  String get startsAt => _t('startsAt');
  String get endsAt => _t('endsAt');
  String get available => _t('available');
  String get unavailableStatus => _t('unavailableStatus');
  String get serviceCapabilities => _t('serviceCapabilities');
  String get noCapabilities => _t('noCapabilities');
  String get lastLocation => _t('lastLocation');
  String get noTeamLocation => _t('noTeamLocation');
  String get settlements => _t('settlements');
  String get noSettlements => _t('noSettlements');
  String get settlementPeriod => _t('settlementPeriod');
  String get payableAmount => _t('payableAmount');
  String get paidAmount => _t('paidAmount');
  String get workItems => _t('workItems');
  String get completedWork => _t('completedWork');
  String get noWorkItems => _t('noWorkItems');
  String get payouts => _t('payouts');
  String get noPayouts => _t('noPayouts');
  String get reconciliation => _t('reconciliation');
  String get notReconciled => _t('notReconciled');
  String get difference => _t('difference');
  String get readOnlyFinancialNotice => _t('readOnlyFinancialNotice');

  String roleLabel(ProviderRoleLabel role) => switch (role) {
    ProviderRoleLabel.manager => _t('companyManager'),
    ProviderRoleLabel.cleaner => _t('teamLeaderCleaner'),
  };

  String statusLabel(String status) {
    final key = 'status.$status';
    return (_values[locale.languageCode] ?? _values['en']!)[key] ??
        status.replaceAll('_', ' ').toLowerCase();
  }

  String notificationLabel(String type) {
    final key = 'notification.$type';
    return (_values[locale.languageCode] ?? _values['en']!)[key] ??
        _t('operationalNotification');
  }

  String _t(String key) =>
      (_values[locale.languageCode] ?? _values['en']!)[key]!;

  static const _values = <String, Map<String, String>>{
    'en': {
      'appName': 'Home Clean',
      'providerPortal': 'Provider Operations',
      'welcome': 'Welcome back',
      'signInSubtitle': 'Sign in with your authorized provider phone number.',
      'phoneNumber': 'Phone number',
      'phoneHint': '+962 7XXXXXXXX',
      'sendCode': 'Send verification code',
      'verificationCode': 'Verification code',
      'verify': 'Verify and continue',
      'resend': 'Send again',
      'home': 'Dashboard',
      'assignments': 'Assignments',
      'assignmentDetails': 'Assignment details',
      'activeJob': 'Active job',
      'team': 'Team',
      'notifications': 'Notifications',
      'profile': 'Profile',
      'financials': 'Financials',
      'logout': 'Log out',
      'retry': 'Try again',
      'loading': 'Loading provider workspace…',
      'empty': 'Nothing here yet',
      'foundationReady': 'Provider workspace is ready',
      'foundationOnly':
          'Operational workflows will be added in the next provider phases.',
      'operationalOverview': 'Operational overview',
      'companies': 'Companies',
      'teams': 'Teams',
      'role': 'Role',
      'permissions': 'Permissions',
      'comingLater': 'This route is prepared for a later Provider App phase.',
      'accessDeniedTitle': 'Provider access required',
      'accessDeniedBody':
          'This account does not have an active cleaning-company role. Access is decided by Home Clean on the server.',
      'errorTitle': 'Unable to continue',
      'networkError': 'Check the connection and try again.',
      'timeoutError': 'The request took too long. Try again.',
      'sessionExpired': 'Your session expired. Sign in again.',
      'forbidden': 'Your current provider role cannot access this resource.',
      'unavailable': 'This operational record is no longer available.',
      'conflict': 'The operational state changed. Refresh and try again.',
      'invalidInput': 'Check the entered information and try again.',
      'serverError': 'The service is temporarily unavailable.',
      'invalidResponse': 'The service returned an unexpected response.',
      'configurationError': 'The provider service is not configured.',
      'confirm': 'Confirm',
      'cancel': 'Cancel',
      'pendingOffers': 'Pending offers',
      'acceptedActive': 'Accepted & active',
      'history': 'History',
      'noAssignments': 'No assignments in this view.',
      'noPendingOffers': 'No pending offers.',
      'noActiveAssignments': 'No accepted or active assignments.',
      'acceptOffer': 'Accept offer',
      'rejectOffer': 'Reject offer',
      'acceptOfferConfirmation':
          'Accept this assignment for the targeted team?',
      'rejectionReason': 'Rejection reason (optional)',
      'location': 'Service address',
      'property': 'Property',
      'propertyType': 'Type',
      'size': 'Size',
      'rooms': 'Rooms',
      'bathrooms': 'Bathrooms',
      'extras': 'Extras',
      'instructions': 'Operational notes',
      'cashRequired': 'Cash requirement',
      'cashWorklist': 'Cash due on assigned work',
      'noCashDue': 'No assigned cash collection is currently due.',
      'noNotifications': 'No operational notifications.',
      'viewAll': 'View all',
      'capacity': 'Capacity',
      'onTheWay': 'Mark on the way',
      'startWork': 'Start work',
      'completeWork': 'Complete cleaning',
      'teamNoShow': 'Team no-show',
      'customerNoShow': 'Customer no-show',
      'collectCash': 'Confirm cash collected',
      'submitProof': 'Submit proof reference',
      'completionProof': 'Completion proof',
      'proofReference': 'Approved storage reference',
      'proofMimeType': 'MIME type',
      'proofByteSize': 'File size in bytes',
      'proofReferenceHelp':
          'This app does not upload files yet. Enter only a reference already stored by an approved system.',
      'noProof': 'Completion proof has not been recorded.',
      'confirmOperationalAction':
          'This updates the authoritative job state for the customer and provider.',
      'cashConfirmation': 'Confirm receipt of the exact displayed cash amount?',
      'teamManagement': 'Team management',
      'createTeam': 'Create team',
      'editTeam': 'Edit team',
      'teamName': 'Team name',
      'internalCode': 'Internal code',
      'activeTeam': 'Active team',
      'teamStatus': 'Operational status',
      'noTeams': 'No teams are available in your scope.',
      'teamMembers': 'Team members',
      'noTeamMembers': 'No active team members.',
      'availability': 'Availability schedule',
      'addAvailability': 'Add availability',
      'noAvailability': 'No availability periods.',
      'startsAt': 'Starts at (ISO 8601)',
      'endsAt': 'Ends at (ISO 8601)',
      'available': 'Available',
      'unavailableStatus': 'Unavailable',
      'serviceCapabilities': 'Service capabilities',
      'noCapabilities': 'No service capabilities configured.',
      'lastLocation': 'Last reported location',
      'noTeamLocation': 'No team location has been reported.',
      'settlements': 'Settlements',
      'noSettlements': 'No settlements are available.',
      'settlementPeriod': 'Period',
      'payableAmount': 'Payable amount',
      'paidAmount': 'Paid amount',
      'workItems': 'Completed jobs',
      'completedWork': 'Completed-work context',
      'noWorkItems': 'No completed-work items.',
      'payouts': 'Payout records',
      'noPayouts': 'No payout has been recorded.',
      'reconciliation': 'Reconciliation',
      'notReconciled': 'No reconciliation result is available.',
      'difference': 'Difference',
      'readOnlyFinancialNotice': 'Financial values are read-only and calculated by Home Clean.',
      'operationalNotification': 'Operational update',
      'notification.ASSIGNMENT_OFFERED': 'New assignment offer',
      'companyManager': 'Company manager',
      'teamLeaderCleaner': 'Team leader / cleaner',
      'status.AVAILABLE': 'Available',
      'status.BUSY': 'Busy',
      'status.OFFLINE': 'Offline',
      'status.PAUSED': 'Paused',
      'status.OFFERED': 'Offered',
      'status.ACCEPTED': 'Accepted',
      'status.REJECTED': 'Rejected',
      'status.EXPIRED': 'Expired',
      'status.CANCELLED': 'Cancelled',
      'status.COMPLETED': 'Completed',
      'status.CALCULATED': 'Calculated',
      'status.READY_FOR_REVIEW': 'Ready for review',
      'status.APPROVED': 'Approved',
      'status.PARTIALLY_PAID': 'Partially paid',
      'status.PAID': 'Paid',
      'status.RECONCILED': 'Reconciled',
      'status.CLOSED': 'Closed',
      'status.EXPECTED': 'Expected',
      'status.COLLECTED': 'Collected',
      'status.TEAM_ASSIGNED': 'Team assigned',
      'status.TEAM_ACCEPTED': 'Team accepted',
      'status.TEAM_ON_THE_WAY': 'On the way',
      'status.CLEANING_STARTED': 'Cleaning started',
      'status.CLEANING_COMPLETED': 'Cleaning completed',
      'status.PAYMENT_RECONCILIATION': 'Payment reconciliation',
      'status.APARTMENT': 'Apartment',
      'status.HOUSE': 'House',
      'status.VILLA': 'Villa',
      'status.OFFICE': 'Office',
    },
    'ar': {
      'appName': 'هوم كلين',
      'providerPortal': 'عمليات مزوّد الخدمة',
      'welcome': 'مرحباً بعودتك',
      'signInSubtitle': 'سجّل الدخول برقم الهاتف المعتمد لدى شركة التنظيف.',
      'phoneNumber': 'رقم الهاتف',
      'phoneHint': '+962 7XXXXXXXX',
      'sendCode': 'إرسال رمز التحقق',
      'verificationCode': 'رمز التحقق',
      'verify': 'تحقق واستمر',
      'resend': 'إرسال مرة أخرى',
      'home': 'لوحة العمليات',
      'assignments': 'المهام',
      'assignmentDetails': 'تفاصيل المهمة',
      'activeJob': 'المهمة النشطة',
      'team': 'الفريق',
      'notifications': 'الإشعارات',
      'profile': 'الملف الشخصي',
      'financials': 'الماليات',
      'logout': 'تسجيل الخروج',
      'retry': 'حاول مرة أخرى',
      'loading': 'جارٍ تحميل مساحة عمل المزوّد…',
      'empty': 'لا يوجد شيء هنا بعد',
      'foundationReady': 'مساحة عمل مزوّد الخدمة جاهزة',
      'foundationOnly':
          'ستُضاف إجراءات التشغيل في المراحل التالية لتطبيق المزوّد.',
      'operationalOverview': 'نظرة عامة على العمليات',
      'companies': 'الشركات',
      'teams': 'الفرق',
      'role': 'الدور',
      'permissions': 'الصلاحيات',
      'comingLater': 'تم تجهيز هذا المسار لمرحلة لاحقة من تطبيق المزوّد.',
      'accessDeniedTitle': 'يلزم دور مزوّد خدمة',
      'accessDeniedBody':
          'لا يملك هذا الحساب دوراً فعالاً لدى شركة تنظيف. يحدد خادم هوم كلين صلاحية الوصول.',
      'errorTitle': 'تعذر المتابعة',
      'networkError': 'تحقق من الاتصال وحاول مرة أخرى.',
      'timeoutError': 'استغرق الطلب وقتاً طويلاً. حاول مرة أخرى.',
      'sessionExpired': 'انتهت جلستك. سجّل الدخول مرة أخرى.',
      'forbidden': 'لا يسمح دور المزوّد الحالي بالوصول إلى هذا المورد.',
      'unavailable': 'لم يعد هذا السجل التشغيلي متاحاً.',
      'conflict': 'تغيرت الحالة التشغيلية. حدّث وحاول مرة أخرى.',
      'invalidInput': 'تحقق من المعلومات المدخلة وحاول مرة أخرى.',
      'serverError': 'الخدمة غير متاحة مؤقتاً.',
      'invalidResponse': 'أعادت الخدمة استجابة غير متوقعة.',
      'configurationError': 'خدمة المزوّد غير مهيأة.',
      'confirm': 'تأكيد',
      'cancel': 'إلغاء',
      'pendingOffers': 'العروض المعلّقة',
      'acceptedActive': 'المهام المقبولة والنشطة',
      'history': 'السجل',
      'noAssignments': 'لا توجد مهام في هذا العرض.',
      'noPendingOffers': 'لا توجد عروض معلّقة.',
      'noActiveAssignments': 'لا توجد مهام مقبولة أو نشطة.',
      'acceptOffer': 'قبول العرض',
      'rejectOffer': 'رفض العرض',
      'acceptOfferConfirmation': 'هل تريد قبول هذه المهمة للفريق المحدد؟',
      'rejectionReason': 'سبب الرفض (اختياري)',
      'location': 'عنوان الخدمة',
      'property': 'العقار',
      'propertyType': 'النوع',
      'size': 'المساحة',
      'rooms': 'الغرف',
      'bathrooms': 'الحمامات',
      'extras': 'الخدمات الإضافية',
      'instructions': 'ملاحظات التشغيل',
      'cashRequired': 'متطلبات التحصيل النقدي',
      'cashWorklist': 'النقد المطلوب للمهام المسندة',
      'noCashDue': 'لا يوجد تحصيل نقدي مطلوب حالياً.',
      'noNotifications': 'لا توجد إشعارات تشغيلية.',
      'viewAll': 'عرض الكل',
      'capacity': 'السعة',
      'onTheWay': 'تحديد أن الفريق في الطريق',
      'startWork': 'بدء العمل',
      'completeWork': 'إكمال التنظيف',
      'teamNoShow': 'عدم حضور الفريق',
      'customerNoShow': 'عدم حضور العميل',
      'collectCash': 'تأكيد تحصيل النقد',
      'submitProof': 'إرسال مرجع إثبات الإنجاز',
      'completionProof': 'إثبات الإنجاز',
      'proofReference': 'مرجع التخزين المعتمد',
      'proofMimeType': 'نوع الملف',
      'proofByteSize': 'حجم الملف بالبايت',
      'proofReferenceHelp':
          'لا يرفع التطبيق الملفات حالياً. أدخل فقط مرجعاً مخزناً مسبقاً في نظام معتمد.',
      'noProof': 'لم يتم تسجيل إثبات الإنجاز بعد.',
      'confirmOperationalAction':
          'سيؤدي هذا إلى تحديث حالة المهمة الرسمية للعميل ومزوّد الخدمة.',
      'cashConfirmation': 'هل تؤكد استلام المبلغ النقدي الظاهر بالكامل؟',
      'teamManagement': 'إدارة الفرق',
      'createTeam': 'إنشاء فريق',
      'editTeam': 'تعديل الفريق',
      'teamName': 'اسم الفريق',
      'internalCode': 'الرمز الداخلي',
      'activeTeam': 'فريق نشط',
      'teamStatus': 'الحالة التشغيلية',
      'noTeams': 'لا توجد فرق ضمن نطاق صلاحيتك.',
      'teamMembers': 'أعضاء الفريق',
      'noTeamMembers': 'لا يوجد أعضاء نشطون في الفريق.',
      'availability': 'جدول التوفر',
      'addAvailability': 'إضافة فترة توفر',
      'noAvailability': 'لا توجد فترات توفر.',
      'startsAt': 'وقت البدء (ISO 8601)',
      'endsAt': 'وقت الانتهاء (ISO 8601)',
      'available': 'متاح',
      'unavailableStatus': 'غير متاح',
      'serviceCapabilities': 'الخدمات التي ينفذها الفريق',
      'noCapabilities': 'لم تُحدد خدمات للفريق.',
      'lastLocation': 'آخر موقع مُبلّغ عنه',
      'noTeamLocation': 'لم يتم الإبلاغ عن موقع للفريق.',
      'settlements': 'التسويات',
      'noSettlements': 'لا توجد تسويات متاحة.',
      'settlementPeriod': 'الفترة',
      'payableAmount': 'المبلغ المستحق',
      'paidAmount': 'المبلغ المدفوع',
      'workItems': 'المهام المكتملة',
      'completedWork': 'سياق العمل المكتمل',
      'noWorkItems': 'لا توجد بنود عمل مكتملة.',
      'payouts': 'سجلات الدفعات',
      'noPayouts': 'لم يتم تسجيل دفعة.',
      'reconciliation': 'المطابقة',
      'notReconciled': 'لا توجد نتيجة مطابقة بعد.',
      'difference': 'الفرق',
      'readOnlyFinancialNotice': 'القيم المالية للعرض فقط ويحسبها نظام هوم كلين.',
      'operationalNotification': 'تحديث تشغيلي',
      'notification.ASSIGNMENT_OFFERED': 'عرض مهمة جديد',
      'companyManager': 'مدير شركة',
      'teamLeaderCleaner': 'قائد فريق / عامل تنظيف',
      'status.AVAILABLE': 'متاح',
      'status.BUSY': 'مشغول',
      'status.OFFLINE': 'غير متصل',
      'status.PAUSED': 'متوقف مؤقتاً',
      'status.OFFERED': 'معروضة',
      'status.ACCEPTED': 'مقبولة',
      'status.REJECTED': 'مرفوضة',
      'status.EXPIRED': 'منتهية',
      'status.CANCELLED': 'ملغاة',
      'status.COMPLETED': 'مكتملة',
      'status.CALCULATED': 'محسوبة',
      'status.READY_FOR_REVIEW': 'جاهزة للمراجعة',
      'status.APPROVED': 'معتمدة',
      'status.PARTIALLY_PAID': 'مدفوعة جزئياً',
      'status.PAID': 'مدفوعة',
      'status.RECONCILED': 'مطابقة',
      'status.CLOSED': 'مغلقة',
      'status.EXPECTED': 'مطلوب',
      'status.COLLECTED': 'تم التحصيل',
      'status.TEAM_ASSIGNED': 'تم إسناد الفريق',
      'status.TEAM_ACCEPTED': 'قبل الفريق',
      'status.TEAM_ON_THE_WAY': 'في الطريق',
      'status.CLEANING_STARTED': 'بدأ التنظيف',
      'status.CLEANING_COMPLETED': 'اكتمل التنظيف',
      'status.PAYMENT_RECONCILIATION': 'مطابقة الدفع',
      'status.APARTMENT': 'شقة',
      'status.HOUSE': 'منزل',
      'status.VILLA': 'فيلا',
      'status.OFFICE': 'مكتب',
    },
  };
}

enum ProviderRoleLabel { manager, cleaner }

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();
  @override
  bool isSupported(Locale locale) => AppLocalizations.supportedLocales.any(
    (item) => item.languageCode == locale.languageCode,
  );
  @override
  Future<AppLocalizations> load(Locale locale) async =>
      AppLocalizations(locale);
  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
