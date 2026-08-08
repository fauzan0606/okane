import type {
  ParserCategory,
  ParserContext,
} from "./types";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    "makan",
    "makan siang",
    "makan malam",
    "kantin",
    "warung",
    "restoran",
    "restaurant",
    "kopi",
    "coffee",
    "cafe",
    "starbucks",
    "grabfood",
    "gofood",
  ],
  transport: [
    "transport",
    "grab",
    "gojek",
    "ojek",
    "taxi",
    "taksi",
    "bensin",
    "parkir",
    "tol",
    "kereta",
    "bus",
  ],
  shopping: [
    "belanja",
    "shopping",
    "shop",
    "tokopedia",
    "shopee",
    "lazada",
  ],
  bills: [
    "listrik",
    "air",
    "internet",
    "wifi",
    "pulsa",
    "tagihan",
    "pln",
  ],
  salary: [
    "gaji",
    "salary",
    "bonus",
    "thr",
  ],
  income: [
    "refund",
    "cashback",
    "dividen",
    "bunga",
  ],
};

function getCategoryGroup(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("food") || normalized.includes("drink")) {
    return "food";
  }

  if (normalized.includes("transport")) {
    return "transport";
  }

  if (normalized.includes("shopping")) {
    return "shopping";
  }

  if (
    normalized.includes("bill") ||
    normalized.includes("utilit")
  ) {
    return "bills";
  }

  if (normalized.includes("salary")) {
    return "salary";
  }

  if (normalized.includes("income")) {
    return "income";
  }

  return normalized;
}

export function findCategory(
  text: string,
  context: ParserContext
): ParserCategory | undefined {
  const input = text.toLowerCase();

  for (const category of context.categories) {
    const group = getCategoryGroup(category.name);
    const keywords = CATEGORY_KEYWORDS[group] ?? [];

    if (keywords.some((keyword) => input.includes(keyword))) {
      return category;
    }
  }

  return undefined;
}
