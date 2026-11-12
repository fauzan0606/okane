import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PersonalExpenseGroup = {
  categoryId: string | null;
  subcategoryId: string | null;
  _sum: { amount: Prisma.Decimal | null };
  _count: { _all: number };
};

export async function getPersonalExpenseGroups(start: Date, end: Date, currencyId: string): Promise<PersonalExpenseGroup[]> {
  const [groups, splitExpenses] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId", "subcategoryId"],
      where: { kind: "STANDARD", type: "EXPENSE", transactionDate: { gte: start, lt: end }, wallet: { currencyId } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.findMany({
      where: { kind: "STANDARD", type: "EXPENSE", transactionDate: { gte: start, lt: end }, wallet: { currencyId }, splitBill: { isNot: null } },
      select: { amount: true, categoryId: true, subcategoryId: true, splitBill: { select: { personalAmount: true } } },
    }),
  ]);
  const grouped = new Map<string, PersonalExpenseGroup>();
  for (const group of groups) {
    grouped.set(`${group.categoryId ?? ""}:${group.subcategoryId ?? ""}`, {
      categoryId: group.categoryId,
      subcategoryId: group.subcategoryId,
      _sum: { amount: new Prisma.Decimal(group._sum.amount ?? 0) },
      _count: { _all: group._count._all },
    });
  }
  for (const transaction of splitExpenses) {
    const key = `${transaction.categoryId ?? ""}:${transaction.subcategoryId ?? ""}`;
    const group = grouped.get(key);
    if (!group) continue;
    const fullAmount = new Prisma.Decimal(transaction.amount);
    const personalAmount = new Prisma.Decimal(transaction.splitBill?.personalAmount ?? transaction.amount);
    group._sum.amount = new Prisma.Decimal(group._sum.amount ?? 0).minus(fullAmount.minus(personalAmount));
    if (personalAmount.lte(0)) group._count._all = Math.max(group._count._all - 1, 0);
  }
  return [...grouped.values()];
}
