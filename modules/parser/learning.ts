import type {
  ParsedTransaction,
} from "./types";

type LearningOption = {
  id: string;
  name: string;
};

type HistoricalTransaction = {
  wallet: LearningOption;
  category: LearningOption | null;
  amount: {
    toNumber: () => number;
  };
};

function mostUsedOption(
  options: (LearningOption | null)[]
): LearningOption | undefined {
  const counts = new Map<
    string,
    { option: LearningOption; count: number }
  >();

  for (const option of options) {
    if (!option) {
      continue;
    }

    const current = counts.get(option.id);

    counts.set(option.id, {
      option,
      count: (current?.count ?? 0) + 1,
    });
  }

  let recommendation:
    | { option: LearningOption; count: number }
    | undefined;

  for (const candidate of counts.values()) {
    if (!recommendation || candidate.count > recommendation.count) {
      recommendation = candidate;
    }
  }

  return recommendation?.option;
}

export function applyTransactionLearning(
  parsed: ParsedTransaction,
  history: HistoricalTransaction[]
): ParsedTransaction {
  if (!parsed.merchant || history.length === 0) {
    return parsed;
  }

  const wallet = mostUsedOption(
    history.map((transaction) => transaction.wallet)
  );

  const category = mostUsedOption(
    history.map((transaction) => transaction.category)
  );

  return {
    ...parsed,
    wallet: parsed.wallet ??
      (wallet && {
        ...wallet,
        score: 0,
      }),
    category: parsed.category ?? category,
    amount: parsed.amount ?? history[0]?.amount.toNumber(),
  };
}
