const RESERVED_WORDS = new Set([
  "rp",
  "idr",

  "cash",
  "tunai",

  "bca",
  "mandiri",
  "bri",
  "bni",
  "cimb",
  "permata",
  "jago",
  "seabank",

  "gopay",
  "ovo",
  "dana",

  "cc",
  "credit",
  "kartu",

  "transfer",
  "tf",
  "masuk",
  "keluar",
  "pemasukan",
  "pengeluaran",
  "income",
  "expense",

  "tanggal",
  "hari",
  "ini",
  "kemarin",
  "kemaren",
  "besok",
  "lusa",
  "today",
  "yesterday",
  "tomorrow",

  "gaji",
  "salary",
  "bonus",
  "thr",
  "refund",
  "cashback",

  "rb",
  "ribu",
  "k",
  "jt",
  "juta",
  "m",
  "miliar",
  "milyar",
]);

const MONTH_WORDS = new Set([
  "januari", "jan", "january",
  "februari", "feb", "february",
  "maret", "mar", "march",
  "april", "apr",
  "mei", "may",
  "juni", "jun", "june",
  "juli", "jul", "july",
  "agustus", "agu", "agt", "aug", "august",
  "september", "sep",
  "oktober", "okt", "oct", "october",
  "november", "nov",
  "desember", "des", "dec", "december",
]);

function removeDateExpressions(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b(20\d{2})[-/.]\d{1,2}[-/.]\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[-/.]\d{1,2}(?:[-/.]20\d{2})?\b/g, " ")
    .replace(/\b\d{1,2}\s+(?:januari|jan|january|februari|feb|february|maret|mar|march|april|apr|mei|may|juni|jun|june|juli|jul|july|agustus|agu|agt|aug|august|september|sep|oktober|okt|oct|october|november|nov|desember|des|dec|december)(?:\s+20\d{2})?\b/g, " ")
    .replace(/\b(?:januari|jan|january|februari|feb|february|maret|mar|march|april|apr|mei|may|juni|jun|june|juli|jul|july|agustus|agu|agt|aug|august|september|sep|oktober|okt|oct|october|november|nov|desember|des|dec|december)\s+\d{1,2}(?:\s+20\d{2})?\b/g, " ")
    .replace(/\b(?:tanggal|date)\s+\d{1,2}(?:\s+[a-z]+)?(?:\s+20\d{2})?\b/g, " ")
    .replace(/\b(?:hari ini|today|kemarin|kemaren|yesterday|besok|tomorrow|lusa)\b/g, " ");
}

export function findMerchant(text: string): string | undefined {
  const cleaned = removeDateExpressions(text);
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean);

  const merchant = tokens.filter((token) => {
    if (RESERVED_WORDS.has(token) || MONTH_WORDS.has(token)) {
      return false;
    }

    if (/^\d/.test(token)) {
      return false;
    }

    if (/^\d+[.,]?\d*(rb|ribu|k|jt|juta|m|miliar|milyar)?$/i.test(token)) {
      return false;
    }

    return true;
  });

  if (merchant.length === 0) {
    return undefined;
  }

  return merchant
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}
