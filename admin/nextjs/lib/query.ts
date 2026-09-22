export function queryString(values: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  const result = query.toString();
  return result ? `?${result}` : '';
}
