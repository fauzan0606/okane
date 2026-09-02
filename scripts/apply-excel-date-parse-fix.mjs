import fs from "node:fs";

const path = "modules/investment/service-v3.ts";
let source = fs.readFileSync(path, "utf8");

const old = `      const parsed = xlsx.SSF.parse_date_code(value);\n      if (parsed && parsed.y && parsed.m && parsed.d) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));`;
const replacement = `      // Excel's serial date uses the 1899-12-30 epoch for the calendar date.\n      // Only the integer portion matters here because the importer stores dates,\n      // not times. Using UTC avoids browser/server timezone shifts.\n      const serial = Math.floor(value);\n      const epoch = Date.UTC(1899, 11, 30);\n      return new Date(epoch + serial * 86400000);`;

if (!source.includes(old)) {
  if (source.includes(replacement)) {
    console.log("Excel date parser fix already applied.");
    process.exit(0);
  }
  throw new Error("Excel parse_date_code call was not found.");
}

source = source.replace(old, replacement);
fs.writeFileSync(path, source);
console.log("Fixed Excel serial date parsing.");
