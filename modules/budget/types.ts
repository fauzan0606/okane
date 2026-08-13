export type BudgetItemView = {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  budgetAmount: number;
  actualAmount: number;
  remainingAmount: number;
  percentage: number;
};

export type BudgetOverview = {
  budgetId: string;
  name: string;
  month: string;
  currency: { id: string; code: string; name: string; symbol: string; decimalPlaces: number };
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  unbudgetedActual: number;
  items: BudgetItemView[];
};
