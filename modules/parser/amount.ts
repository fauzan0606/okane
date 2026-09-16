const MULTIPLIERS: Record<string, number> = {
  rb: 1_000,
  ribu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000_000,
  milyar: 1_000_000_000,
  miliar: 1_000_000_000,
};

function parseBaseNumber(raw: string): number | undefined {
  const value = raw.trim();
  if (!value) return undefined;

  // Indonesian grouped amounts such as 1.500.000 or 1,500,000.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) {
    const digits = value.replace(/[.,]/g, "");
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  // Decimal amounts such as 1,5 or 1.5.
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function extractAmount(input: string): number | undefined {
  const text = input.toLowerCase().replace(/rp\.?/g, "").trim();
  let largest: number | undefined;

  // Prefer explicit Indonesian shorthand because it is unambiguous:
  // 50rb, 50 rb, 1,5jt, 2 juta, 100k, etc.
  const shorthandRegex = /(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|m|miliar|milyar)\b/gi;
  for (const match of text.matchAll(shorthandRegex)) {
    const rawNumber = match[1];
    const suffix = match[2]?.toLowerCase();
    if (!rawNumber || !suffix) continue;

    const base = parseBaseNumber(rawNumber);
    const multiplier = MULTIPLIERS[suffix];
    if (base === undefined || multiplier === undefined) continue;

    const value = Math.round(base * multiplier);
    if (largest === undefined || value > largest) largest = value;
  }

  if (largest !== undefined) return largest;

  // Fall back to explicit rupiah/grouped numbers when no shorthand is present.
  const rupiahRegex = /(?:rp\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?![a-z])/gi;
  for (const match of text.matchAll(rupiahRegex)) {
    const rawNumber = match[1];
    if (!rawNumber) continue;

    const value = parseBaseNumber(rawNumber);
    if (value === undefined) continue;

    const rounded = Math.round(value);
    if (largest === undefined || rounded > largest) largest = rounded;
  }

  return largest;
}
