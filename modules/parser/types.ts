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
  }[];

  categories: {
    id: string;
    name: string;
  }[];
};

export type ParsedTransaction = {
  tokens: Token[];

  merchant?: string;

  amount?: number;

  wallet?: ParserWallet;

  category?: ParserCategory;

  type: "INCOME" | "EXPENSE";
};

export type SmartTransactionResult = {
  parsed: ParsedTransaction;

  wallets: {
    id: string;
    name: string;
  }[];

  categories: {
    id: string;
    name: string;
  }[];
};