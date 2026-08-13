import type { ParsedTransaction, ParserSubcategory } from "./types";

type LearningOption = { id: string; name: string };
type HistoricalTransaction = {
  wallet: LearningOption;
  category: LearningOption | null;
  subcategory: ParserSubcategory | null;
  amount: { toNumber: () => number };
};

function mostUsedOption(options: (LearningOption | null)[]) {
  const counts = new Map<string, { option: LearningOption; count: number }>();
  for (const option of options) {
    if (!option) continue;
    const current = counts.get(option.id);
    counts.set(option.id, { option, count: (current?.count ?? 0) + 1 });
  }
  let recommendation: { option: LearningOption; count: number } | undefined;
  for (const candidate of counts.values()) {
    if (!recommendation || candidate.count > recommendation.count) recommendation = candidate;
  }
  return recommendation?.option;
}

function mostUsedSubcategory(options: (ParserSubcategory | null)[]) {
  const counts = new Map<string, { option: ParserSubcategory; count: number }>();
  for (const option of options) {
    if (!option) continue;
    const current = counts.get(option.id);
    counts.set(option.id, { option, count: (current?.count ?? 0) + 1 });
  }
  let recommendation: { option: ParserSubcategory; count: number } | undefined;
  for (const candidate of counts.values()) {
    if (!recommendation || candidate.count > recommendation.count) recommendation = candidate;
  }
  return recommendation?.option;
}

export function applyTransactionLearning(parsed: ParsedTransaction, history: HistoricalTransaction[]): ParsedTransaction {
  if (!parsed.merchant || history.length === 0) return parsed;

  const wallet = mostUsedOption(history.map((transaction) => transaction.wallet));
  const category = mostUsedOption(history.map((transaction) => transaction.category));
  const subcategory = mostUsedSubcategory(history.map((transaction) => transaction.subcategory));

  const learnedCategory = parsed.category ?? category;
  const learnedSubcategory = parsed.subcategory ?? (
    subcategory && learnedCategory?.id === subcategory.categoryId ? subcategory : undefined
  );

  return {
    ...parsed,
    wallet: parsed.wallet ?? (wallet ? { ...wallet, score: 0 } : undefined),
    category: learnedCategory,
    subcategory: learnedSubcategory,
    amount: parsed.amount ?? history[0]?.amount.toNumber(),
    confidence: learnedSubcategory
      ? { level: "HIGH", reason: "Category and subcategory matched using transaction pattern and merchant history." }
      : parsed.confidence,
  };
}
