import { Prisma } from "@prisma/client";

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

export function getInstallmentNumber(startDate: Date, referenceDate: Date, tenorMonths: number) {
  if (referenceDate < startDate) return 0;
  const months = (referenceDate.getFullYear() - startDate.getFullYear()) * 12 + (referenceDate.getMonth() - startDate.getMonth());
  const candidate = addMonths(startDate, months);
  const adjusted = referenceDate < candidate ? months - 1 : months;
  return Math.min(Math.max(adjusted + 1, 1), tenorMonths);
}

export function getInstallmentOccurrence(startDate: Date, installmentNumber: number) {
  return addMonths(startDate, installmentNumber - 1);
}

export function getInstallmentAmount(totalAmount: Prisma.Decimal, installmentAmount: Prisma.Decimal, installmentNumber: number, tenorMonths: number) {
  if (installmentNumber >= tenorMonths) {
    return totalAmount.minus(installmentAmount.times(tenorMonths - 1));
  }
  return installmentAmount;
}
