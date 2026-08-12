export type Token = {
  raw: string;
  normalized: string;
};

export type ParserWallet = {
  id: string;
  name: string;
  score: number;
};

export type ParserCategory = {
  id: string;
  name: string;
};

export type ParserContext = {
  wallets: {
    id: string;
    name: string;
    bank?: string | null;
  }[];

  categories: {
    id: string;
    name: string;
  }[];
};

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type ParserConfidence = {
  level: ConfidenceLevel;
  reason: string;
};

export type ParsedTransaction = {
  tokens: Token[];

  transactionDate: string;

  merchant?: string;

  amount?: number;

  wallet?: ParserWallet;

  category?: ParserCategory;

  type: "INCOME" | "EXPENSE";

  confidence: ParserConfidence;
};

export type SmartTransactionResult = {
  parsed: ParsedTransaction;

  wallets: {
    id: string;
    name: string;
    bank?: string | null;
  }[];

  categories: {
    id: string;
    name: string;
  }[];
};
