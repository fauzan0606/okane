const MONTHS: Record<string, number> = {
  januari: 0, jan: 0, january: 0,
  februari: 1, feb: 1, february: 1,
  maret: 2, mar: 2, march: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5, june: 5,
  juli: 6, jul: 6, july: 6,
  agustus: 7, agu: 7, agt: 7, aug: 7, august: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, october: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, december: 11,
};

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildDate(day: number, month: number, year?: number): string | undefined {
  const now = new Date();
  const resolvedYear = year ?? now.getFullYear();
  const date = new Date(resolvedYear, month, day);

  if (
    date.getFullYear() !== resolvedYear ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return toDateOnly(date);
}

export function extractTransactionDate(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  const today = new Date();

  if (/\b(lusa)\b/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 2);
    return toDateOnly(date);
  }

  if (/\b(besok|tomorrow)\b/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return toDateOnly(date);
  }

  if (/\b(kemarin|kemaren|yesterday)\b/.test(normalized)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return toDateOnly(date);
  }

  if (/\b(hari ini|today)\b/.test(normalized)) {
    return toDateOnly(today);
  }

  // Explicit Indonesian date phrases such as:
  // "tanggal 7 aug", "tgl 7 agustus", "tanggal 7 aug 2026".
  const explicitTextMonth = normalized.match(
    /\b(?:tanggal|tgl)\s+(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?\b/
  );
  if (explicitTextMonth) {
    const [, day, monthName, year] = explicitTextMonth;
    const month = MONTHS[monthName];

    if (month !== undefined) {
      const result = buildDate(
        Number(day),
        month,
        year ? Number(year) : undefined
      );

      if (result) return result;
    }
  }

  const explicitNumeric = normalized.match(
    /\b(?:tanggal|tgl)\s+(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?\b/
  );
  if (explicitNumeric) {
    const [, day, month, year] = explicitNumeric;
    const result = buildDate(
      Number(day),
      Number(month) - 1,
      year ? Number(year) : undefined
    );

    if (result) return result;
  }

  const iso = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const [, year, month, day] = iso;
    const result = buildDate(Number(day), Number(month) - 1, Number(year));
    if (result) return result;
  }

  const numeric = normalized.match(
    /\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?\b/
  );
  if (numeric) {
    const [, day, month, year] = numeric;
    const result = buildDate(
      Number(day),
      Number(month) - 1,
      year ? Number(year) : undefined
    );
    if (result) return result;
  }

  const textMonth = normalized.match(
    /\b(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?\b/
  );
  if (textMonth) {
    const [, day, monthName, year] = textMonth;
    const month = MONTHS[monthName];

    if (month !== undefined) {
      const result = buildDate(
        Number(day),
        month,
        year ? Number(year) : undefined
      );

      if (result) return result;
    }
  }

  const monthFirst = normalized.match(
    /\b([a-z]+)\s+(\d{1,2})(?:\s+(20\d{2}))?\b/
  );
  if (monthFirst) {
    const [, monthName, day, year] = monthFirst;
    const month = MONTHS[monthName];

    if (month !== undefined) {
      const result = buildDate(
        Number(day),
        month,
        year ? Number(year) : undefined
      );

      if (result) return result;
    }
  }

  return toDateOnly(today);
}
