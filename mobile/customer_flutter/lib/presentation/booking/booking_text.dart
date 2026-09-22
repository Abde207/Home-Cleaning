import 'package:flutter/widgets.dart';

class BookingText {
  BookingText(BuildContext context) : ar = Localizations.localeOf(context).languageCode == 'ar';
  final bool ar;
  String get service => ar ? 'الخدمة' : 'Service';
  String get extras => ar ? 'الإضافات' : 'Extras';
  String get next => ar ? 'متابعة' : 'Continue';
  String get property => ar ? 'العقار' : 'Property';
  String get address => ar ? 'العنوان' : 'Address';
  String get addProperty => ar ? 'إضافة عقار' : 'Add property';
  String get addAddress => ar ? 'إضافة عنوان' : 'Add address';
  String get chooseTime => ar ? 'اختر التاريخ والوقت' : 'Choose date and time';
  String get slotNotice => ar ? 'الوقت المطلوب يخضع للتحقق من الخادم وتوفر فريق العمل.' : 'Requested time is subject to server validation and team availability.';
  String get quote => ar ? 'عرض السعر' : 'Get quote';
  String get refreshQuote => ar ? 'تحديث السعر' : 'Refresh quote';
  String get quoteExpired => ar ? 'انتهت صلاحية عرض السعر.' : 'This quote has expired.';
  String get expires => ar ? 'ينتهي' : 'Expires';
  String get base => ar ? 'السعر الأساسي' : 'Base price';
  String get discount => ar ? 'الخصم' : 'Discount';
  String get total => ar ? 'الإجمالي' : 'Total';
  String get fees => ar ? 'الرسوم' : 'Fees';
  String get adjustments => ar ? 'التعديلات' : 'Adjustments';
  String get review => ar ? 'مراجعة الحجز' : 'Review booking';
  String get paymentMethod => ar ? 'طريقة الدفع' : 'Payment method';
  String get cash => ar ? 'نقداً' : 'Cash';
  String get online => ar ? 'إلكتروني' : 'Online';
  String get cashNotice => ar ? 'سيتم الدفع نقداً لاحقاً. لم يتم التحصيل بعد.' : 'Pay cash later. No cash has been collected yet.';
  String get onlineNotice => ar ? 'سيبقى الدفع معلقاً حتى يؤكده الخادم.' : 'Payment stays pending until the server confirms it.';
  String get confirm => ar ? 'تأكيد الحجز' : 'Confirm booking';
  String get notConfirmed => ar ? 'الحجز غير مؤكد حتى يستجيب الخادم.' : 'The booking is not confirmed until the server responds.';
  String get retry => ar ? 'إعادة المحاولة' : 'Retry';
  String get resume => ar ? 'متابعة الحجز' : 'Resume booking';
  String get refresh => ar ? 'تحديث الحالة' : 'Refresh status';
  String get cancelBooking => ar ? 'إلغاء الحجز' : 'Cancel booking';
  String get cancelQuestion => ar ? 'هل تريد طلب إلغاء الحجز؟' : 'Request cancellation of this booking?';
  String get retryPayment => ar ? 'إعادة محاولة الدفع' : 'Retry payment';
  String get paymentPending => ar ? 'الدفع الإلكتروني قيد الانتظار. تحقق من الحالة لاحقاً.' : 'Online payment is pending. Refresh to check its status.';
  String get openCheckout => ar ? 'فتح صفحة الدفع الآمنة' : 'Open secure checkout';
  String get checkoutUnavailable => ar ? 'تعذر فتح صفحة الدفع. حاول مرة أخرى.' : 'Could not open checkout. Try again.';
  String get mockGateway => ar ? 'رابط الدفع الحالي تجريبي ولا يدعم إتمام الدفع داخل التطبيق.' : 'The current checkout URL is a backend mock and cannot complete payment in the app.';
  String get newBooking => ar ? 'حجز جديد' : 'New booking';
  String get rooms => ar ? 'الغرف' : 'Rooms';
  String get bathrooms => ar ? 'الحمامات' : 'Bathrooms';
  String get size => ar ? 'المساحة' : 'Size';
  String get type => ar ? 'النوع' : 'Type';
  String get promotion => ar ? 'رمز العرض' : 'Promotion code';
  String get instructions => ar ? 'تعليمات إضافية' : 'Instructions';
  String get assignment => ar ? 'حالة التعيين' : 'Assignment status';
  String get paymentStatus => ar ? 'حالة الدفع' : 'Payment status';
  String get bookingStatus => ar ? 'حالة الحجز' : 'Booking status';
  String get timeline => ar ? 'تسلسل حالة الحجز' : 'Booking timeline';
  String get refund => ar ? 'الاسترداد' : 'Refund';
  String get noLiveLocation => ar ? 'موقع الفريق ووقت الوصول غير متاحين حالياً.' : 'Team location and arrival time are currently unavailable.';
  String get loadFailed => ar ? 'تعذر تحميل البيانات. حاول مرة أخرى.' : 'Could not load the data. Try again.';
  String get noServices => ar ? 'لا توجد خدمات متاحة.' : 'No services available.';
  String get noAddresses => ar ? 'لا توجد عناوين. أضف عنواناً للمتابعة.' : 'No addresses. Add one to continue.';
  String get noProperties => ar ? 'لا توجد عقارات. أضف عقاراً للمتابعة.' : 'No properties. Add one to continue.';
  String get invalid => ar ? 'تحقق من البيانات المطلوبة.' : 'Check the required fields.';
  String get conflict => ar ? 'تغيرت حالة الحجز أو الوقت المطلوب. حدّث البيانات وحاول مرة أخرى.' : 'The booking state or requested time changed. Refresh and try again.';
  String get signIn => ar ? 'انتهت الجلسة. سجّل الدخول مجدداً.' : 'Your session expired. Sign in again.';
  String get network => ar ? 'تعذر الاتصال. أعد المحاولة بنفس الطلب.' : 'Connection failed. Retry the same request.';
  String propertyType(String value) => switch (value) {
    'APARTMENT' => ar ? 'شقة' : 'Apartment',
    'HOUSE' => ar ? 'منزل' : 'House',
    'VILLA' => ar ? 'فيلا' : 'Villa',
    'OFFICE' => ar ? 'مكتب' : 'Office',
    _ => value,
  };
  String status(String value) {
    final labels = <String, (String, String)>{
      'REQUESTED': ('Requested', 'مطلوب'), 'PRICE_CONFIRMED': ('Price confirmed', 'تم تأكيد السعر'),
      'PAYMENT_PENDING': ('Payment pending', 'الدفع قيد الانتظار'), 'CASH_SELECTED': ('Cash selected', 'تم اختيار النقد'),
      'PAYMENT_CONFIRMED': ('Payment confirmed', 'تم تأكيد الدفع'), 'SEARCHING_FOR_TEAM': ('Searching for a team', 'جارٍ البحث عن فريق'),
      'TEAM_ASSIGNED': ('Team assigned', 'تم تعيين فريق'), 'TEAM_ACCEPTED': ('Team accepted', 'قبل الفريق'),
      'TEAM_ON_THE_WAY': ('Team on the way', 'الفريق في الطريق'), 'CLEANING_STARTED': ('Cleaning started', 'بدأ التنظيف'),
      'CLEANING_COMPLETED': ('Cleaning completed', 'انتهى التنظيف'), 'PAYMENT_RECONCILIATION': ('Payment reconciliation', 'تسوية الدفع'),
      'COMPLETED': ('Completed', 'مكتمل'), 'CANCELLED': ('Cancelled', 'ملغى'), 'NO_TEAM_AVAILABLE': ('No team available', 'لا يوجد فريق متاح'),
      'REJECTED': ('Assignment rejected', 'تم رفض التعيين'), 'TEAM_NO_SHOW': ('Team did not arrive', 'لم يحضر الفريق'),
      'CUSTOMER_NO_SHOW': ('Customer unavailable', 'العميل غير متاح'), 'REFUND_PENDING': ('Refund pending', 'الاسترداد قيد الانتظار'),
      'REFUNDED': ('Refunded', 'تم الاسترداد'), 'PENDING': ('Pending', 'قيد الانتظار'), 'FAILED': ('Failed', 'فشل'),
      'CONFIRMED': ('Confirmed', 'مؤكد'), 'RECONCILED': ('Reconciled', 'تمت التسوية'), 'PARTIALLY_REFUNDED': ('Partially refunded', 'استرداد جزئي'),
      'ONLINE': ('Online', 'إلكتروني'), 'CASH': ('Cash', 'نقداً'),
      'OFFERED': ('Offered', 'معروض'), 'ACCEPTED': ('Accepted', 'مقبول'),
      'EXPIRED': ('Expired', 'منتهي'), 'CASH_COLLECTED': ('Cash collected', 'تم تحصيل النقد'),
      'SUCCEEDED': ('Succeeded', 'نجح'),
    };
    final pair = labels[value];
    return pair == null ? value.replaceAll('_', ' ') : ar ? pair.$2 : pair.$1;
  }
}
