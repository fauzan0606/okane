import fs from "node:fs";

const path = "modules/investment/service-v3.ts";
let source = fs.readFileSync(path, "utf8");

const oldRead = 'const workbook = xlsx.read(input.buffer, { type: "buffer", cellDates: true });';
const newRead = 'const workbook = xlsx.read(input.buffer, { type: "buffer", cellDates: false });';

if (!source.includes(oldRead)) {
  if (!source.includes(newRead)) throw new Error("Investment workbook read configuration was not found.");
} else {
  source = source.replace(oldRead, newRead);
}

const anchor = '  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: true }) as Record<string, unknown>[];';
const helper = `${anchor}\n\n  // Excel stores calendar dates as serials. Convert them to UTC-midnight calendar dates\n  // so the same date survives Prisma/JSON/browser timezone conversions without shifting.\n  const excelCalendarDate = (value: unknown): Date | null => {\n    if (typeof value === "number" && Number.isFinite(value)) {\n      const parsed = xlsx.SSF.parse_date_code(value);\n      if (parsed && parsed.y && parsed.m && parsed.d) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));\n    }\n    if (value instanceof Date && !Number.isNaN(value.getTime())) {\n      return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));\n    }\n    if (typeof value === "string") {\n      const text = value.trim();\n      let match = text.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);\n      if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));\n      match = text.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})/);\n      if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));\n    }\n    return null;\n  };`;

if (!source.includes('const excelCalendarDate = (value: unknown): Date | null =>')) {
  if (!source.includes(anchor)) throw new Error("Investment workbook row parser anchor was not found.");
  source = source.replace(anchor, helper);
}

const oldRow = 'const row = rows[i]; const rowNo = i + 2; const date = row["TGL BELI"]; const symbol = String(row["STOCKS"] ?? "").trim().toUpperCase(); const lots = Number(row["LOT"] ?? 0); const buyPrice = Number(row["BUY"] ?? 0); const gross = Number(row["BUY PRICE"] ?? 0); const fee = Number(row["FEE"] ?? 0); const total = Number(row["TOTAL BUY"] ?? 0); const sell = Number(row["SELL"] ?? 0); const sellDate = row["TGL JUAL"]; const sellFee = Number(row["FEE_1"] ?? 0);';
const newRow = 'const row = rows[i]; const rowNo = i + 2; const date = excelCalendarDate(row["TGL BELI"]); const symbol = String(row["STOCKS"] ?? "").trim().toUpperCase(); const lots = Number(row["LOT"] ?? 0); const buyPrice = Number(row["BUY"] ?? 0); const gross = Number(row["BUY PRICE"] ?? 0); const fee = Number(row["FEE"] ?? 0); const total = Number(row["TOTAL BUY"] ?? 0); const sell = Number(row["SELL"] ?? 0); const sellDate = excelCalendarDate(row["TGL JUAL"]); const sellFee = Number(row["FEE_1"] ?? 0);';
if (source.includes(oldRow)) source = source.replace(oldRow, newRow);
else if (!source.includes(newRow)) throw new Error("Investment workbook row date parsing line was not found.");

fs.writeFileSync(path, source);
console.log("Investment Excel date handling fixed.");
