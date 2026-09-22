/// Shared pagination shape used by future customer repositories.
/// Backend list endpoints currently return arrays; this model stays separate
/// from display widgets so a paged contract can be adopted without UI coupling.
class ApiPage<T> {
  const ApiPage({required this.items, required this.limit, required this.offset});
  final List<T> items;
  final int limit;
  final int offset;
}
