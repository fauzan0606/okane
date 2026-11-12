export function personalExpenseAmount(transaction: {
  amount: unknown;
  splitBill?: { personalAmount: unknown } | null;
}) {
  return transaction.splitBill ? Number(transaction.splitBill.personalAmount) : Number(transaction.amount);
}
