import '../customer/customer_models.dart';

Map<String, dynamic> objectMap(dynamic value) => value is Map<String, dynamic> ? value : const {};
List<Map<String, dynamic>> objectList(dynamic value) => value is List ? value.whereType<Map<String, dynamic>>().toList() : const [];
String field(Map<String, dynamic> map, String key) => '${map[key] ?? ''}';
DateTime? instant(dynamic value) => DateTime.tryParse('$value')?.toLocal();

class CustomerProperty {
  const CustomerProperty({required this.id, required this.type, required this.size, required this.rooms, required this.bathrooms});
  factory CustomerProperty.fromJson(Map<String, dynamic> json) => CustomerProperty(id: field(json, 'id'), type: field(json, 'type'), size: field(json, 'size'), rooms: (json['rooms'] as num).toInt(), bathrooms: (json['bathrooms'] as num).toInt());
  final String id, type, size;
  final int rooms, bathrooms;
}

class BookingInput {
  const BookingInput({required this.serviceId, required this.propertyId, required this.addressId, required this.extras, this.promotionCode});
  final String serviceId, propertyId, addressId;
  final Map<String, int> extras;
  final String? promotionCode;
  Map<String, dynamic> toJson() => {
    'serviceId': serviceId, 'propertyId': propertyId, 'addressId': addressId,
    'extras': [for (final id in extras.keys.toList()..sort()) {'serviceExtraId': id, 'quantity': extras[id]}],
    if (promotionCode != null && promotionCode!.isNotEmpty) 'promotionCode': promotionCode,
  };
}

class QuoteLine {
  const QuoteLine({required this.name, required this.amount});
  factory QuoteLine.fromJson(Map<String, dynamic> json) => QuoteLine(name: field(json, 'name'), amount: field(json, 'amount'));
  final String name, amount;
}

class QuoteExtra {
  const QuoteExtra({required this.name, required this.quantity, required this.lineTotal, this.serviceExtraId = ''});
  factory QuoteExtra.fromJson(Map<String, dynamic> json) => QuoteExtra(serviceExtraId: field(json, 'serviceExtraId'), name: field(json, 'name'), quantity: (json['quantity'] as num).toInt(), lineTotal: field(json, 'lineTotal'));
  final String serviceExtraId, name, lineTotal;
  final int quantity;
}

class BookingQuote {
  const BookingQuote({required this.id, required this.basePrice, required this.extrasTotal, required this.adjustments, required this.fees, required this.discount, required this.total, required this.currency, required this.expiresAt, required this.extras, required this.promotion});
  factory BookingQuote.fromJson(Map<String, dynamic> json) => BookingQuote(
    id: field(json, 'quoteId'), basePrice: field(json, 'basePrice'), extrasTotal: field(json, 'extrasTotal'),
    adjustments: objectList(json['adjustments']).map(QuoteLine.fromJson).toList(),
    fees: objectList(json['fees']).map(QuoteLine.fromJson).toList(), discount: field(json, 'discount'),
    total: field(json, 'total'), currency: field(json, 'currency'),
    expiresAt: DateTime.parse(field(json, 'expiresAt')), extras: objectList(json['extras']).map(QuoteExtra.fromJson).toList(),
    promotion: objectMap(json['promotion'])['code'] as String?,
  );
  final String id, basePrice, extrasTotal, discount, total, currency;
  final DateTime expiresAt;
  final List<QuoteLine> adjustments, fees;
  final List<QuoteExtra> extras;
  final String? promotion;
  bool get expired => !expiresAt.isAfter(DateTime.now());
}

class BookingPayment {
  const BookingPayment({required this.id, required this.method, required this.status, this.checkoutUrl, this.reference, this.refunds = const []});
  factory BookingPayment.fromJson(Map<String, dynamic> json) {
    final attempt = objectMap(json['attempt']);
    return BookingPayment(id: field(json, 'id'), method: field(json, 'method'), status: field(json, 'status'), checkoutUrl: attempt['checkoutUrl'] as String?, reference: attempt['providerReference'] as String?, refunds: objectList(json['refunds']).map(BookingRefund.fromJson).toList());
  }
  final String id, method, status;
  final String? checkoutUrl, reference;
  final List<BookingRefund> refunds;
}

class BookingRefund {
  const BookingRefund({required this.amount, required this.status});
  factory BookingRefund.fromJson(Map<String, dynamic> json) => BookingRefund(amount: field(json, 'amount'), status: field(json, 'status'));
  final String amount, status;
}

class BookingStatusEvent {
  const BookingStatusEvent({required this.status, required this.createdAt});
  factory BookingStatusEvent.fromJson(Map<String, dynamic> json) => BookingStatusEvent(status: field(json, 'newStatus'), createdAt: instant(json['createdAt']));
  final String status;
  final DateTime? createdAt;
}

class BookingDetail {
  const BookingDetail({required this.id, required this.number, required this.status, required this.paymentMethod, required this.price, required this.currency, required this.scheduledAt, required this.serviceName, required this.serviceNameAr, required this.address, required this.property, required this.extras, required this.priceSnapshot, required this.payments, required this.assignmentStatus, this.statusHistory = const []});
  factory BookingDetail.fromJson(Map<String, dynamic> json) {
    final service = objectMap(json['serviceSnapshot']);
    final address = objectMap(json['addressSnapshot']);
    final assignments = objectList(json['assignments']);
    return BookingDetail(
      id: field(json, 'id'), number: field(json, 'bookingNumber'), status: field(json, 'status'),
      paymentMethod: json['paymentMethod'] as String?, price: field(json, 'price'), currency: field(json, 'currency'),
      scheduledAt: instant(json['scheduledAt']), serviceName: field(service, 'name'), serviceNameAr: field(service, 'nameAr'),
      address: field(address, 'addressText'), property: objectMap(json['propertySnapshot']),
      extras: objectList(json['extras']), priceSnapshot: objectMap(json['priceSnapshot']),
      payments: objectList(json['payments']).map(BookingPayment.fromJson).toList(),
      assignmentStatus: assignments.isEmpty ? null : field(assignments.last, 'status'),
      statusHistory: objectList(json['history']).map(BookingStatusEvent.fromJson).toList(),
    );
  }
  final String id, number, status, price, currency, serviceName, serviceNameAr, address;
  final String? paymentMethod, assignmentStatus;
  final DateTime? scheduledAt;
  final Map<String, dynamic> property, priceSnapshot;
  final List<Map<String, dynamic>> extras;
  final List<BookingPayment> payments;
  final List<BookingStatusEvent> statusHistory;
  BookingPayment? get latestPayment => payments.isEmpty ? null : payments.last;
  bool get canCancel => const {'REQUESTED', 'PRICE_CONFIRMED', 'PAYMENT_PENDING', 'TEAM_ASSIGNED'}.contains(status);
}

class BookingSelection {
  CleaningService? service;
  CustomerProperty? property;
  CustomerAddress? address;
  DateTime? scheduledAt;
  final Map<String, int> extras = {};
  String promotionCode = '';
  String instructions = '';
  BookingInput? get input => service == null || property == null || address == null ? null : BookingInput(serviceId: service!.id, propertyId: property!.id, addressId: address!.id, extras: Map.of(extras), promotionCode: promotionCode.isEmpty ? null : promotionCode);
}
