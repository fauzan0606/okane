export type BudgetItemView = {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  amount: number;
  budgetAmount: number;
  actualAmount: number;
  remainingAmount: number;
  percentage: number;
};

export type BudgetOverview = {
  budgetId: string;
  name: string;
  month: string;
  mode: "NONE" | "OVERALL" | "CATEGORY";
  currency: { id: string; code: string; name: string; symbol: string; decimalPlaces: number };
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  unbudgetedActual: number;
  incomeEstimate: number;
  recommendedTotalBudget: number;
  items: BudgetItemView[];
};

export type BudgetSuggestionItem = {
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  recommendedAmount: number;
  historicalAverage: number;
  previousBudget: number;
};

export type BudgetSuggestion = {
  month: string;
  currencyCode: string;
  incomeEstimate: number;
  historicalExpenseAverage: number;
  previousBudgetTotal: number;
  recommendedTotalBudget: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  items: BudgetSuggestionItem[];
};
