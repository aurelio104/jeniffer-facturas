export function paramString(value: string | string[] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? value[0] ?? '' : value;
}
