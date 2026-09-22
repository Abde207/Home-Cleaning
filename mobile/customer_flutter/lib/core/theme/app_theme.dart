import 'package:flutter/material.dart';

class AppTheme {
  static const primary = Color(0xFF0B7285);
  static const accent = Color(0xFFF4A261);
  static const surface = Color(0xFFF7FAFC);
  static ThemeData light() => ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: primary).copyWith(secondary: accent), scaffoldBackgroundColor: surface, fontFamily: 'sans-serif');
}

class AppSpacing {
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}
