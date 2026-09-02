import XLSX from "xlsx";
import { InvestmentAssetType, InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;
const SOURCE = "__OKANE_DIVIDEND_EXCEL__";

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const serial = Math.floor(value);
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value ?? "").trim().replace(/[^0-9,.-]/g, "");
  if (!s) return null;
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = s.length - comma - 1;
    s = decimals <= 2 ? s.replace(".", "").replace(",", ".") : s.replace(/,/g, "");
  } else {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function firstValue(row: Record<string, unknown>, aliases: string[]) {
  const keys = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
  for (const alias of aliases) {
    const key = keys.get(normalizeHeader(alias));
    if (key) return row[key];
  }
  return undefined;
}

export async function importInvestmentDividendWorkbook(input: { accountId: string; buffer: Buffer; fileName: string }) {
  const account = await prisma.investmentAccount.findUnique({ where: { id: input.accountId }, include: { cashAccount: true } });
  if (!account) throw new Error("Investment account not found.");

  const workbook = XLSX.read(input.buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel file has no worksheet.");
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  if (!rows.length) return { imported: 0, skipped: 0, errors: [], fileName: input.fileName };

  const imported: Array<{ row: number; symbol: string; amount: string }> = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  const errors: Array<{ row: number; reason: string }> = [];

  await prisma.$transaction(async (tx) => {
    let cashDelta = new D(0);
    for (let i = 0; i < rows.length; i += 1) {
      const rowNo = i + 2;
      try {
        const date = parseExcelDate(firstValue(rows[i], ["TANGGAL", "TGL", "TGL DIVIDEN", "TANGGAL DIVIDEN", "PAY DATE", "PAYMENT DATE", "DATE"]));
        const rawSymbol = firstValue(rows[i], ["STOCKS", "STOCK", "SYMBOL", "TICKER", "KODE SAHAM", "KODE"]);
        const amount = parseAmount(firstValue(rows[i], ["DIVIDEND", "DIVIDEND AMOUNT", "DIVIDEND VALUE", "NET DIVIDEND", "NET", "JUMLAH DIVIDEN", "AMOUNT", "VALUE"]));
        const symbol = String(rawSymbol ?? "").trim().toUpperCase();
        if (!date) throw new Error("Tanggal tidak valid.");
        if (!symbol) throw new Error("Kode saham kosong.");
        if (amount == null || amount <= 0) throw new Error("Nilai dividend harus lebih besar dari 0.");

        let asset = await tx.investmentAsset.findFirst({ where: { symbol, currencyId: account.currencyId } });
        if (!asset) {
          asset = await tx.investmentAsset.create({ data: { symbol, name: symbol, assetType: InvestmentAssetType.STOCK, currencyId: account.currencyId, unitName: "share" } });
        }

        const duplicate = await tx.investmentTransaction.findFirst({
          where: {
            accountId: account.id,
            assetId: asset.id,
            transactionType: InvestmentTransactionType.DIVIDEND,
            transactionDate: date,
            netCashAmount: new D(amount),
          },
          select: { id: true },
        });
        if (duplicate) {
          skipped.push({ row: rowNo, reason: "Dividend dengan tanggal, saham, dan nilai yang sama sudah ada." });
          continue;
        }

        const note = `${SOURCE}${JSON.stringify({ fileName: input.fileName, sheet: firstSheet, row: rowNo })}`;
        await tx.investmentTransaction.create({
          data: {
            accountId: account.id,
            assetId: asset.id,
            transactionType: InvestmentTransactionType.DIVIDEND,
            transactionDate: date,
            quantity: new D(0),
            unitPrice: new D(0),
            grossAmount: new D(amount),
            feeAmount: new D(0),
            taxAmount: new D(0),
            otherCharges: new D(0),
            totalCashAmount: new D(amount),
            netCashAmount: new D(amount),
            costBasisAmount: new D(0),
            currencyId: account.currencyId,
            fundingCashAccountId: account.cashAccount?.id ?? null,
            note,
          },
        });
        cashDelta = cashDelta.plus(amount);
        imported.push({ row: rowNo, symbol, amount: new D(amount).toString() });
      } catch (error) {
        errors.push({ row: rowNo, reason: error instanceof Error ? error.message : "Baris tidak dapat diproses." });
      }
    }
    if (account.cashAccount && !cashDelta.isZero()) {
      await tx.investmentCashAccount.update({ where: { id: account.cashAccount.id }, data: { balance: { increment: cashDelta } } });
    }
  });

  return { imported: imported.length, skipped: skipped.length, errors, fileName: input.fileName, details: { imported, skipped } };
}
