class CustomerProfile {
  const CustomerProfile({required this.id, required this.name, required this.phone, required this.locale});

  factory CustomerProfile.fromJson(Map<String, dynamic> json) => CustomerProfile(
        id: '${json['id'] ?? ''}',
        name: '${json['name'] ?? ''}',
        phone: '${json['phone'] ?? ''}',
        locale: '${json['locale'] ?? 'en'}',
      );

  final String id;
  final String name;
  final String phone;
  final String locale;
}

class ServiceExtra {
  const ServiceExtra({required this.id, required this.name, required this.nameAr, required this.price});

  factory ServiceExtra.fromJson(Map<String, dynamic> json) => ServiceExtra(
        id: '${json['id'] ?? ''}',
        name: '${json['name'] ?? ''}',
        nameAr: '${json['nameAr'] ?? json['name'] ?? ''}',
        price: '${json['price'] ?? ''}',
      );

  final String id;
  final String name;
  final String nameAr;
  final String price;
}

class CleaningService {
  const CleaningService({required this.id, required this.code, required this.name, required this.nameAr, required this.description, required this.basePrice, required this.durationMinutes, required this.extras});

  factory CleaningService.fromJson(Map<String, dynamic> json) => CleaningService(
        id: '${json['id'] ?? ''}',
        code: '${json['code'] ?? ''}',
        name: '${json['name'] ?? ''}',
        nameAr: '${json['nameAr'] ?? json['name'] ?? ''}',
        description: '${json['description'] ?? ''}',
        basePrice: '${json['basePrice'] ?? ''}',
        durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
        extras: ((json['extras'] as List<dynamic>?) ?? const []).whereType<Map<String, dynamic>>().map(ServiceExtra.fromJson).toList(growable: false),
      );

  final String id;
  final String code;
  final String name;
  final String nameAr;
  final String description;
  final String basePrice;
  final int durationMinutes;
  final List<ServiceExtra> extras;
}

class CustomerAddress {
  const CustomerAddress({required this.id, required this.label, required this.addressText, required this.latitude, required this.longitude, required this.isDefault, required this.validationStatus});

  factory CustomerAddress.fromJson(Map<String, dynamic> json) => CustomerAddress(
        id: '${json['id'] ?? ''}',
        label: '${json['label'] ?? ''}',
        addressText: '${json['addressText'] ?? ''}',
        latitude: (json['latitude'] as num?)?.toDouble() ?? double.tryParse('${json['latitude']}'),
        longitude: (json['longitude'] as num?)?.toDouble() ?? double.tryParse('${json['longitude']}'),
        isDefault: json['isDefault'] == true,
        validationStatus: '${json['validationStatus'] ?? ''}',
      );

  final String id;
  final String label;
  final String addressText;
  final double? latitude;
  final double? longitude;
  final bool isDefault;
  final String validationStatus;
}

class BookingSummary {
  const BookingSummary({required this.id, required this.bookingNumber, required this.status, required this.scheduledAt, required this.price, required this.currency});

  factory BookingSummary.fromJson(Map<String, dynamic> json) => BookingSummary(
        id: '${json['id'] ?? ''}',
        bookingNumber: '${json['bookingNumber'] ?? ''}',
        status: '${json['status'] ?? ''}',
        scheduledAt: DateTime.tryParse('${json['scheduledAt'] ?? ''}')?.toLocal(),
        price: '${json['price'] ?? ''}',
        currency: '${json['currency'] ?? 'JOD'}',
      );

  final String id;
  final String bookingNumber;
  final String status;
  final DateTime? scheduledAt;
  final String price;
  final String currency;
}

class CustomerNotification {
  const CustomerNotification({required this.id, required this.type, required this.title, required this.body, required this.readAt, required this.createdAt, this.bookingId, this.status});

  factory CustomerNotification.fromJson(Map<String, dynamic> json) {
    final payload = json['payload'] is Map<String, dynamic> ? json['payload'] as Map<String, dynamic> : const <String, dynamic>{};
    final event = payload['payload'] is Map<String, dynamic> ? payload['payload'] as Map<String, dynamic> : const <String, dynamic>{};
    return CustomerNotification(
      id: '${json['id'] ?? ''}',
      type: '${json['type'] ?? ''}',
      title: '${payload['title'] ?? json['type'] ?? ''}',
      body: '${payload['body'] ?? ''}',
      readAt: DateTime.tryParse('${json['readAt'] ?? ''}')?.toLocal(),
      createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}')?.toLocal(),
      bookingId: event['bookingId'] is String ? event['bookingId'] as String : null,
      status: event['newStatus'] is String ? event['newStatus'] as String : event['status'] is String ? event['status'] as String : null,
    );
  }

  final String id;
  final String type;
  final String title;
  final String body;
  final DateTime? readAt;
  final DateTime? createdAt;
  final String? bookingId, status;
  bool get isRead => readAt != null;
}
