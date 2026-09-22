import 'package:flutter/material.dart';

class AppLocalizations {
  const AppLocalizations(this.locale);
  final Locale locale;
  static const supportedLocales = [Locale('ar'), Locale('en')];
  static const delegate = _AppLocalizationsDelegate();
  static AppLocalizations of(BuildContext context) => Localizations.of<AppLocalizations>(context, AppLocalizations)!;

  String get appName => _t('appName');
  String get welcome => _t('welcome');
  String get signInSubtitle => _t('signInSubtitle');
  String get phoneNumber => _t('phoneNumber');
  String get phoneHint => _t('phoneHint');
  String get requestOtp => _t('requestOtp');
  String get verificationCode => _t('verificationCode');
  String get verify => _t('verify');
  String get resend => _t('resend');
  String get home => _t('home');
  String get services => _t('services');
  String get addresses => _t('addresses');
  String get booking => _t('booking');
  String get bookingDetails => _t('bookingDetails');
  String get payments => _t('payments');
  String get notifications => _t('notifications');
  String get profile => _t('profile');
  String get logout => _t('logout');
  String get foundationReady => _t('foundationReady');
  String get featureComingSoon => _t('featureComingSoon');
  String get errorTitle => _t('errorTitle');
  String get retry => _t('retry');
  String get emptyTitle => _t('emptyTitle');
  String get greeting => _t('greeting');
  String get bookNow => _t('bookNow');
  String get upcomingBooking => _t('upcomingBooking');
  String get noUpcomingBooking => _t('noUpcomingBooking');
  String get viewServices => _t('viewServices');
  String get viewAll => _t('viewAll');
  String get serviceDetails => _t('serviceDetails');
  String get duration => _t('duration');
  String get startingFrom => _t('startingFrom');
  String get minutes => _t('minutes');
  String get noServices => _t('noServices');
  String get noAddresses => _t('noAddresses');
  String get addAddress => _t('addAddress');
  String get editAddress => _t('editAddress');
  String get addressLabel => _t('addressLabel');
  String get addressText => _t('addressText');
  String get makeDefault => _t('makeDefault');
  String get save => _t('save');
  String get cancel => _t('cancel');
  String get delete => _t('delete');
  String get deleteAddressConfirm => _t('deleteAddressConfirm');
  String get name => _t('name');
  String get phone => _t('phone');
  String get language => _t('language');
  String get english => _t('english');
  String get arabic => _t('arabic');
  String get editProfile => _t('editProfile');
  String get profileSaved => _t('profileSaved');
  String get markRead => _t('markRead');
  String get noNotifications => _t('noNotifications');
  String get validationFailed => _t('validationFailed');
  String get requiredField => _t('requiredField');
  String get networkError => _t('networkError');
  String get invalidSession => _t('invalidSession');
  String get tapToOpen => _t('tapToOpen');
  String get status => _t('status');
  bool get _ar => locale.languageCode == 'ar';
  String get configurationError => _ar ? 'تعذر الاتصال بالخدمة. تحقق من إعدادات التطبيق.' : 'The service is not configured. Check the app settings.';
  String get invalidResponse => _ar ? 'وصلت استجابة غير متوقعة. حاول مرة أخرى.' : 'The service returned an unexpected response. Try again.';
  String get accessDenied => _ar ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء.' : 'You do not have permission to do that.';
  String get itemUnavailable => _ar ? 'هذا العنصر غير متاح الآن.' : 'This item is no longer available.';
  String get actionConflict => _ar ? 'تغيرت الحالة. حدّث الصفحة وحاول مرة أخرى.' : 'The state changed. Refresh and try again.';
  String get rateLimited => _ar ? 'طلبات كثيرة جداً. انتظر قليلاً ثم حاول مجدداً.' : 'Too many requests. Wait a moment and try again.';
  String get myBookings => _ar ? 'حجوزاتي' : 'My bookings';
  String get addressVerified => _ar ? 'تم التحقق من العنوان' : 'Address verified';
  String get addressNeedsReview => _ar ? 'العنوان بحاجة إلى مراجعة' : 'Address needs review';
  String get loadFailed => _ar ? 'تعذر تحميل البيانات. حاول مرة أخرى.' : 'Could not load the data. Try again.';
  String get invalidCode => _ar ? 'رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.' : 'The code is invalid or expired. Request a new code.';
  String _t(String key) => (_values[locale.languageCode] ?? _values['en']!)[key]!;

  static const _values = <String, Map<String, String>>{
    'en': {'appName': 'Home Clean', 'welcome': 'Welcome to Home Clean', 'signInSubtitle': 'Clean homes, made simple.', 'phoneNumber': 'Phone number', 'phoneHint': '+962 7XXXXXXXX', 'requestOtp': 'Send verification code', 'verificationCode': 'Verification code', 'verify': 'Verify and continue', 'resend': 'Send again', 'home': 'Home', 'services': 'Services', 'addresses': 'Addresses', 'booking': 'Book a cleaning', 'bookingDetails': 'Booking details', 'payments': 'Payments', 'notifications': 'Notifications', 'profile': 'Profile', 'logout': 'Log out', 'foundationReady': 'Your customer app foundation is ready.', 'featureComingSoon': 'This customer feature will be added in the next Phase 12 sub-phase.', 'errorTitle': 'Something went wrong', 'retry': 'Try again', 'emptyTitle': 'Nothing here yet', 'greeting': 'Good to see you', 'bookNow': 'Book Cleaning', 'upcomingBooking': 'Upcoming booking', 'noUpcomingBooking': 'No upcoming bookings', 'viewServices': 'Explore services', 'viewAll': 'View all', 'serviceDetails': 'Service details', 'duration': 'Duration', 'startingFrom': 'Starting from', 'minutes': 'min', 'noServices': 'No services are available right now.', 'noAddresses': 'Add an address to make booking easier.', 'addAddress': 'Add address', 'editAddress': 'Edit address', 'addressLabel': 'Label', 'addressText': 'Address', 'makeDefault': 'Make this my default address', 'save': 'Save', 'cancel': 'Cancel', 'delete': 'Delete', 'deleteAddressConfirm': 'Remove this address?', 'name': 'Name', 'phone': 'Phone', 'language': 'Language', 'english': 'English', 'arabic': 'Arabic', 'editProfile': 'Edit profile', 'profileSaved': 'Profile updated.', 'markRead': 'Mark as read', 'noNotifications': 'You are all caught up.', 'validationFailed': 'We could not validate this address.', 'requiredField': 'This field is required.', 'networkError': 'Check your connection and try again.', 'invalidSession': 'Your session has expired. Please sign in again.', 'tapToOpen': 'Tap to view details', 'status': 'Status'},
    'ar': {'appName': 'هوم كلين', 'welcome': 'مرحباً بك في هوم كلين', 'signInSubtitle': 'تنظيف المنزل أصبح أسهل.', 'phoneNumber': 'رقم الهاتف', 'phoneHint': '+962 7XXXXXXXX', 'requestOtp': 'إرسال رمز التحقق', 'verificationCode': 'رمز التحقق', 'verify': 'تحقق واستمر', 'resend': 'إرسال مرة أخرى', 'home': 'الرئيسية', 'services': 'الخدمات', 'addresses': 'العناوين', 'booking': 'حجز خدمة تنظيف', 'bookingDetails': 'تفاصيل الحجز', 'payments': 'المدفوعات', 'notifications': 'الإشعارات', 'profile': 'الملف الشخصي', 'logout': 'تسجيل الخروج', 'foundationReady': 'تم تجهيز أساس تطبيق العملاء.', 'featureComingSoon': 'ستتم إضافة هذه الميزة في المرحلة الفرعية القادمة من المرحلة 12.', 'errorTitle': 'حدث خطأ ما', 'retry': 'حاول مرة أخرى', 'emptyTitle': 'لا يوجد شيء هنا بعد', 'greeting': 'سعداء برؤيتك', 'bookNow': 'احجز خدمة تنظيف', 'upcomingBooking': 'الحجز القادم', 'noUpcomingBooking': 'لا توجد حجوزات قادمة', 'viewServices': 'استكشف الخدمات', 'viewAll': 'عرض الكل', 'serviceDetails': 'تفاصيل الخدمة', 'duration': 'المدة', 'startingFrom': 'تبدأ من', 'minutes': 'دقيقة', 'noServices': 'لا توجد خدمات متاحة حالياً.', 'noAddresses': 'أضف عنواناً لتسهيل الحجز.', 'addAddress': 'إضافة عنوان', 'editAddress': 'تعديل العنوان', 'addressLabel': 'التسمية', 'addressText': 'العنوان', 'makeDefault': 'اجعل هذا العنوان الافتراضي', 'save': 'حفظ', 'cancel': 'إلغاء', 'delete': 'حذف', 'deleteAddressConfirm': 'هل تريد حذف هذا العنوان؟', 'name': 'الاسم', 'phone': 'الهاتف', 'language': 'اللغة', 'english': 'الإنجليزية', 'arabic': 'العربية', 'editProfile': 'تعديل الملف الشخصي', 'profileSaved': 'تم تحديث الملف الشخصي.', 'markRead': 'تحديد كمقروء', 'noNotifications': 'لا توجد إشعارات جديدة.', 'validationFailed': 'تعذر التحقق من هذا العنوان.', 'requiredField': 'هذا الحقل مطلوب.', 'networkError': 'تحقق من اتصالك وحاول مرة أخرى.', 'invalidSession': 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.', 'tapToOpen': 'اضغط لعرض التفاصيل', 'status': 'الحالة'},
  };
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();
  @override
  bool isSupported(Locale locale) => AppLocalizations.supportedLocales.any((item) => item.languageCode == locale.languageCode);
  @override
  Future<AppLocalizations> load(Locale locale) async => AppLocalizations(locale);
  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
