import fs from 'node:fs';

// Dividend Excel import patcher.
const servicePath = 'modules/investment/service-v3.ts';
const apiPath = 'app/api/investments/v2/route.ts';
const uiPath = 'modules/investment/components/InvestmentDashboardV6.tsx';

let service = fs.readFileSync(servicePath, 'utf8');
let api = fs.readFileSync(apiPath, 'utf8');
let ui = fs.readFileSync(uiPath, 'utf8');

const oldDateAliases = "date: ['TANGGAL', 'TGL', 'TGL DIVIDEN', 'TANGGAL DIVIDEN', 'PAY DATE', 'PAYMENT DATE', 'DATE']";
const newDateAliases = "date: ['TANGGAL', 'TGL', 'TGL DIVIDEN', 'TANGGAL DIVIDEN', 'TANGGAL DEVIDEN', 'TGL DEVIDEN', 'PAY DATE', 'PAYMENT DATE', 'DATE']";
const oldAmountAliases = "amount: ['DIVIDEND', 'DIVIDEND AMOUNT', 'DIVIDEND VALUE', 'NET DIVIDEND', 'NET', 'JUMLAH DIVIDEN', 'AMOUNT', 'VALUE']";
const newAmountAliases = "amount: ['DIVIDEND', 'DEVIDEN', 'DIVIDEND AMOUNT', 'DEVIDEN AMOUNT', 'DIVIDEND VALUE', 'DEVIDEN VALUE', 'NET DIVIDEND', 'NET DEVIDEN', 'NET', 'JUMLAH DIVIDEN', 'JUMLAH DEVIDEN', 'AMOUNT', 'VALUE']";

if (service.includes(oldDateAliases)) service = service.replace(oldDateAliases, newDateAliases);
if (service.includes(oldAmountAliases)) service = service.replace(oldAmountAliases, newAmountAliases);

// Also accept headers through normalized semantic matching so minor spelling differences
// such as DIVIDEN/DEVIDEN do not silently result in zero imported rows.
const oldFindValue = `  const findValue = (row: Record<string, unknown>, names: readonly string[]) => {
    const wanted = new Set(names.map(normalizeHeader));
    return Object.entries(row).find(([key]) => wanted.has(normalizeHeader(key)))?.[1];
  };`;
const newFindValue = `  const findValue = (row: Record<string, unknown>, names: readonly string[]) => {
    const wanted = new Set(names.map(normalizeHeader));
    const entries = Object.entries(row);
    const exact = entries.find(([key]) => wanted.has(normalizeHeader(key)));
    if (exact) return exact[1];
    return entries.find(([key]) => {
      const header = normalizeHeader(key);
      return [...wanted].some(name => header.replace(/DEVIDEN/g, 'DIVIDEN') === name.replace(/DEVIDEN/g, 'DIVIDEN'));
    })?.[1];
  };`;
if (service.includes(oldFindValue)) service = service.replace(oldFindValue, newFindValue);

fs.writeFileSync(servicePath, service);
fs.writeFileSync(apiPath, api);
fs.writeFileSync(uiPath, ui);
console.log('Applied dividend Excel import header fix.');
