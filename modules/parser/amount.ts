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

export function extractAmount(
  input: string
): number | undefined {
  const normalized = input
    .toLowerCase()
    .replace(/rp/gi, "")
    .replace(/\s+/g, "");

  const regex =
    /(\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta|m|miliar|milyar)?/g;

  let largest: number | undefined;

  for (const match of normalized.matchAll(regex)) {
    const rawNumber = match[1];
    const suffix = match[2];

    if (!rawNumber) {
      continue;
    }

    let value = Number(
      rawNumber.replace(",", ".")
    );

    if (Number.isNaN(value)) {
      continue;
    }

    if (suffix) {
      value *= MULTIPLIERS[suffix];
    }

    if (!largest || value > largest) {
      largest = Math.round(value);
    }
  }

  return largest;
}