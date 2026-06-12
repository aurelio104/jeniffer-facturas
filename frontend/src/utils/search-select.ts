export type SearchOption = { value: string; label: string; key?: string };

export function normalizeSearchText(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-\s]/g, '');
}

export function scoreOption(option: SearchOption, query: string): number {
  const q = query.trim();
  if (!q) return 1;

  const qNorm = normalizeSearchText(q);
  const labelNorm = normalizeSearchText(option.label);
  const valueNorm = normalizeSearchText(option.value);
  const labelLower = option.label.toLowerCase();
  const valueLower = option.value.toLowerCase();
  const qLower = q.toLowerCase();

  if (valueNorm === qNorm || valueLower === qLower) return 100;
  if (labelNorm === qNorm || labelLower === qLower) return 95;
  if (valueNorm.startsWith(qNorm) || valueLower.startsWith(qLower)) return 80;
  if (labelNorm.startsWith(qNorm) || labelLower.startsWith(qLower)) return 75;

  const tokens = qLower.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => labelLower.includes(t))) return 65;

  if (labelLower.includes(qLower)) return 50;
  if (valueNorm.includes(qNorm) || valueLower.includes(qLower)) return 40;
  return 0;
}

export function filterOptions(options: SearchOption[], query: string, limit = 12): SearchOption[] {
  const selectable = options.filter((o) => o.value !== '');
  const q = query.trim();
  if (!q) return selectable.slice(0, limit);

  return selectable
    .map((o) => ({ o, score: scoreOption(o, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.o.label.localeCompare(b.o.label))
    .slice(0, limit)
    .map((x) => x.o);
}

export function optionLabel(options: SearchOption[], value: string): string {
  const match = options.find((o) => o.value === value);
  return match?.label ?? value;
}
