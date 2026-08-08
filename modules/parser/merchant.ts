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

  "rb",
  "ribu",
  "k",
  "jt",
  "juta",
  "m",
  "miliar",
  "milyar",

  "gaji",
  "salary",
  "bonus",
  "thr",
  "refund",
  "cashback",

  "transfer",
  "tf",
]);

export function findMerchant(
  text: string
): string | undefined {
  const tokens = text
    .toLowerCase()
    .split(/\s+/);

  const merchant = tokens.filter((token) => {
    if (RESERVED_WORDS.has(token)) {
      return false;
    }

    if (/^\d/.test(token)) {
      return false;
    }

    if (
      /^\d+[.,]?\d*(rb|ribu|k|jt|juta|m|miliar|milyar)?$/i.test(
        token
      )
    ) {
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
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}