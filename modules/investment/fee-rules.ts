import { InvestmentAssetType, InvestmentTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SOURCES = {
  indoPremierFees: "https://manual.indopremier.com/",
  stockSaleTax: "https://pajak.go.id/index.php/id/pph-pasal-4-ayat-2",
};

export async function refreshIndoPremierFeeRules(providerId: string, effectiveFrom = new Date()) {
  const provider = await prisma.investmentProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error("Provider not found.");
  if (!provider.name.toLowerCase().includes("indopremier")) throw new Error("Online refresh is currently supported for IndoPremier only.");

  const [brokerResponse, taxResponse] = await Promise.all([fetch(SOURCES.indoPremierFees, { cache: "no-store" }), fetch(SOURCES.stockSaleTax, { cache: "no-store" })]);
  if (!brokerResponse.ok || !taxResponse.ok) throw new Error("Official fee/tax source could not be reached.");
  const brokerText = await brokerResponse.text();
  const taxText = await taxResponse.text();

  const brokerMatch = brokerText.match(/fee transaksi saham[^]*?beli\s*([0-9]+(?:[.,][0-9]+)?)%\s*dan jual\s*([0-9]+(?:[.,][0-9]+)?)/i);
  const taxMatch = taxText.match(/0[.,]1\s*%[^\n]{0,120}jumlah bruto/i);
  if (!brokerMatch || !taxMatch) throw new Error("Could not safely parse the official fee/tax pages. No rule was changed.");

  const buyFee = Number(brokerMatch[1].replace(",", "."));
  const sellFee = Number(brokerMatch[2].replace(",", "."));
  const sellTax = 0.1;

  return prisma.$transaction(async tx => {
    const latest = await tx.investmentFeeRule.findMany({ where: { providerId, assetType: InvestmentAssetType.STOCK, transactionType: { in: [InvestmentTransactionType.BUY, InvestmentTransactionType.SELL] }, effectiveTo: null } });
    for (const rule of latest) await tx.investmentFeeRule.update({ where: { id: rule.id }, data: { effectiveTo: new Date(effectiveFrom.getTime() - 1) } });
    await tx.investmentFeeRule.createMany({ data: [
      { providerId, assetType: InvestmentAssetType.STOCK, transactionType: InvestmentTransactionType.BUY, feeRate: buyFee, taxRate: 0, fixedFee: 0, effectiveFrom, sourceUrl: SOURCES.indoPremierFees, sourceLabel: `Online refresh ${effectiveFrom.toISOString().slice(0, 10)}` },
      { providerId, assetType: InvestmentAssetType.STOCK, transactionType: InvestmentTransactionType.SELL, feeRate: sellFee, taxRate: sellTax, fixedFee: 0, effectiveFrom, sourceUrl: SOURCES.indoPremierFees, sourceLabel: `Online refresh ${effectiveFrom.toISOString().slice(0, 10)} + DJP`, note: taxSource: SOURCES.stockSaleTax },
    ] as any);
    return { buyFee, sellFee, sellTax, sources: SOURCES };
  });
}
