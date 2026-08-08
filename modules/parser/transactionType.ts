const INCOME_KEYWORDS = [
  "gaji",
  "salary",
  "bonus",
  "thr",
  "refund",
  "cashback",
  "dividen",
  "bunga",
];

export function detectTransactionType(
  text: string
): "INCOME" | "EXPENSE" {
  const input = text.toLowerCase();

  if (
    INCOME_KEYWORDS.some((keyword) =>
      input.includes(keyword)
    )
  ) {
    return "INCOME";
  }

  return "EXPENSE";
}