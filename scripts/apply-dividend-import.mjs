import fs from 'node:fs';

const servicePath = 'modules/investment/service-v3.ts';
const apiPath = 'app/api/investments/v2/route.ts';
const uiPath = 'modules/investment/components/InvestmentDashboardV6.tsx';

let service = fs.readFileSync(servicePath, 'utf8');
let api = fs.readFileSync(apiPath, 'utf8');
let ui = fs.readFileSync(uiPath, 'utf8');

const dividendService = String.raw`

export async function importInvestmentDividendWorkbook(input: { accountId: string; buffer: Buffer; fileName: string }) {
  const xlsx = await (Function("return import('xlsx')")() as Promise<any>);
  const workbook = xlsx.read(input.buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames.find((name: string) => /dividend|dividen/i.test(name)) ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error('No worksheet was found in the dividend file.');
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true }) as Record<string, unknown>[];
  const normalizeHeader = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const aliases = {
    date: ['TANGGAL', 'TGL', 'TGL DIVIDEN', 'TANGGAL DIVIDEN', 'PAY DATE', 'PAYMENT DATE', 'DATE'],
    symbol: ['STOCKS', 'STOCK', 'SYMBOL', 'TICKER', 'KODE SAHAM', 'KODE'],
    amount: ['DIVIDEND', 'DIVIDEND AMOUNT', 'DIVIDEND VALUE', 'NET DIVIDEND', 'NET', 'JUMLAH DIVIDEN', 'AMOUNT', 'VALUE']
  } as const;
  const findValue = (row: Record<string, unknown>, names: readonly string[]) => {
    const wanted = new Set(names.map(normalizeHeader));
    return Object.entries(row).find(([key]) => wanted.has(normalizeHeader(key)))?.[1];
  };
  const parseDate = (value: unknown): Date | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    const text = String(value ?? '').trim();
    let m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return null;
  };
  const parseAmount = (value: unknown): Prisma.Decimal | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return new D(value);
    let text = String(value ?? '').trim().replace(/[^0-9,.-]/g, '');
    if (!text) return null;
    if (text.includes('.') && text.includes(',')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    else if (text.includes(',')) { const parts = text.split(','); text = parts.length === 2 && parts[1].length <= 2 ? parts[0].replace(/\./g, '') + '.' + parts[1] : text.replace(/,/g, ''); }
    else if ((text.match(/\./g) || []).length > 1) text = text.replace(/\./g, '');
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? new D(n) : null;
  };
  const account = await prisma.investmentAccount.findUnique({ where: { id: input.accountId }, include: { cashAccount: true } });
  if (!account) throw new Error('Investment account not found.');
  let imported = 0; let skipped = 0; const warnings: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]; const rowNo = i + 2;
      const date = parseDate(findValue(row, aliases.date));
      const symbol = String(findValue(row, aliases.symbol) ?? '').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
      const amount = parseAmount(findValue(row, aliases.amount));
      if (!date || !symbol || !amount) { skipped += 1; if (Object.values(row).some(v => v != null && String(v).trim() !== '')) warnings.push('Row ' + rowNo + ' skipped: date, stock and dividend are required.'); continue; }
      let asset = await tx.investmentAsset.findFirst({ where: { symbol, currencyId: account.currencyId } });
      if (!asset) asset = await tx.investmentAsset.create({ data: { symbol, name: symbol, assetType: 'STOCK', countryCode: 'ID', currencyId: account.currencyId, unitName: 'share' } });
      const duplicate = await tx.investmentTransaction.findFirst({ where: { accountId: account.id, assetId: asset.id, transactionType: InvestmentTransactionType.DIVIDEND, transactionDate: date, netCashAmount: amount } });
      if (duplicate) { skipped += 1; continue; }
      const note = '__OKANE_DIVIDEND_IMPORT__' + JSON.stringify({ source: 'DIVIDEND_EXCEL', sourceFile: input.fileName, sourceRow: rowNo, sheet: sheetName });
      await tx.investmentTransaction.create({ data: { accountId: account.id, assetId: asset.id, transactionType: InvestmentTransactionType.DIVIDEND, transactionDate: date, quantity: new D(0), unitPrice: new D(0), grossAmount: amount, feeAmount: new D(0), taxAmount: new D(0), otherCharges: new D(0), totalCashAmount: amount, netCashAmount: amount, costBasisAmount: new D(0), currencyId: account.currencyId, fundingCashAccountId: account.cashAccount?.id, note } });
      if (account.cashAccount) await tx.investmentCashAccount.update({ where: { id: account.cashAccount.id }, data: { balance: { increment: amount } } });
      imported += 1;
    }
  });
  return { imported, skipped, warnings, fileName: input.fileName, sheetName };
}
`;

if (!service.includes('export async function importInvestmentDividendWorkbook')) service += dividendService;

const apiImportAnchor = 'importInvestmentWorkbook, refreshInvestmentStockPrices, setInvestmentCashBalance';
if (!api.includes('importInvestmentDividendWorkbook')) {
  if (!api.includes(apiImportAnchor)) throw new Error('Dividend API import anchor not found');
  api = api.replace(apiImportAnchor, 'importInvestmentDividendWorkbook, ' + apiImportAnchor);
}

const multipartAnchor = '      if (action !== "import.excel") return NextResponse.json({ error: "Unknown investment upload action." }, { status: 400 });';
if (!api.includes('action === "dividend.import.excel"')) {
  const multipartBlock = String.raw`      if (action === "dividend.import.excel") {
        const accountId = String(form.get("accountId") || "");
        const file = form.get("file");
        if (!accountId || !(file instanceof File)) return NextResponse.json({ error: "Account and Excel file are required." }, { status: 400 });
        return NextResponse.json(serialize(await importInvestmentDividendWorkbook({ accountId, buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name })));
      }
`;
  if (!api.includes(multipartAnchor)) throw new Error('Dividend API multipart anchor not found');
  api = api.replace(multipartAnchor, multipartBlock + multipartAnchor);
}

if (!ui.includes('function DividendImport')) {
  const uiAnchor = 'const assetLabel = (a: Asset) => a.symbol ? `${a.symbol} · ${a.name}` : a.name;';
  const component = String.raw`

function DividendImport({ accountId, onDone }: { accountId: string; onDone: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function handle(file: File) {
    if (!accountId) { setMessage('Pilih investment account terlebih dahulu.'); return; }
    setBusy(true); setMessage('');
    try {
      const form = new FormData();
      form.set('action', 'dividend.import.excel');
      form.set('accountId', accountId);
      form.set('file', file);
      const response = await fetch('/api/investments/v2', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Dividend import failed.');
      await onDone();
      setMessage('Imported ' + (data.imported ?? 0) + ', skipped ' + (data.skipped ?? 0) + '.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dividend import failed.');
    } finally {
      setBusy(false);
    }
  }
  return <div className='flex items-center gap-2'><label className='cursor-pointer rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300'>{busy ? 'Importing…' : 'Upload Excel'}<input type='file' accept='.xlsx,.xls,.csv' className='hidden' disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void handle(file); e.currentTarget.value = ''; }} /></label>{message && <span className='text-[10px] text-slate-500'>{message}</span>}</div>;
}
`;
  if (!ui.includes(uiAnchor)) throw new Error('Dividend UI helper anchor not found');
  ui = ui.replace(uiAnchor, uiAnchor + component);
}

if (!ui.includes('<DividendImport accountId={accountId}')) {
  const button = '<button type="button" onClick={()=>setDividendEdit({id:"",assetId:"",date:today(),amount:""})} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add Dividend</button>';
  if (!ui.includes(button)) throw new Error('Dividend UI button anchor not found');
  ui = ui.replace(button, button + '<DividendImport accountId={accountId} onDone={reload} />');
}

fs.writeFileSync(servicePath, service);
fs.writeFileSync(apiPath, api);
fs.writeFileSync(uiPath, ui);
console.log('Applied dividend Excel import feature.');
