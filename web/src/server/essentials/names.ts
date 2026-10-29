export function normalizeEssentialName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanEssentialName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export type ParsedEssentialDictionaryLine = {
  name: string;
  normalizedName: string;
};

export function parseEssentialDictionary(text: string): ParsedEssentialDictionaryLine[] {
  const seen = new Set<string>();
  const items: ParsedEssentialDictionaryLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const name = cleanEssentialName(trimmed);
    const normalizedName = normalizeEssentialName(name);
    if (!normalizedName || seen.has(normalizedName)) continue;

    seen.add(normalizedName);
    items.push({ name, normalizedName });
  }

  return items;
}
