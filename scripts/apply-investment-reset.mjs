import fs from "node:fs";

const apiPath = "app/api/investments/v2/route.ts";
const uiPath = "modules/investment/components/InvestmentDashboardV6.tsx";

let api = fs.readFileSync(apiPath, "utf8");
let ui = fs.readFileSync(uiPath, "utf8");

const apiAnchor = '    if (action === "account.create") {';
const apiBlock = `    if (action === "investment.reset") {
      const confirmation = String(body.confirmation || "");
      if (confirmation !== "RESET INVESTMENT") return NextResponse.json({ error: "Confirmation text is required." }, { status: 400 });
      const result = await prisma.$transaction(async tx => {
        const accountIds = (await tx.investmentAccount.findMany({ select: { id: true } })).map(x => x.id);
        await tx.investmentCashMovement.deleteMany({ where: {} });
        await tx.investmentTransaction.deleteMany({ where: {} });
        await tx.investmentHolding.deleteMany({ where: {} });
        await tx.investmentCashAccount.deleteMany({ where: {} });
        await tx.investmentAccount.deleteMany({ where: {} });
        await tx.investmentFeeRule.deleteMany({ where: {} });
        await tx.investmentProvider.deleteMany({ where: {} });
        await tx.investmentAsset.deleteMany({ where: {} });
        return { accountsDeleted: accountIds.length };
      });
      return NextResponse.json(serialize({ ok: true, ...result }));
    }

`;
if (!api.includes('if (action === "investment.reset")')) {
  if (!api.includes(apiAnchor)) throw new Error("Investment API anchor not found.");
  api = api.replace(apiAnchor, apiBlock + apiAnchor);
}

const fnAnchor = '  async function accountAction(action: "account.close" | "account.delete", account: Account) { if (!window.confirm(`${action.endsWith("close") ? "Close" : "Delete"} ${account.provider.name}?`)) return; const ok = await run({ action, accountId: account.id }, action.endsWith("close") ? "Account closed." : "Account deleted."); if (ok) setAccountId(""); }';
const fnBlock = `${fnAnchor}\n  async function resetInvestmentData() {\n    const first = window.confirm("Reset ALL Investment data? This will remove all investment accounts, transactions, holdings, RDN accounts, assets and broker settings. Wallets and normal transactions will NOT be affected.");\n    if (!first) return;\n    const typed = window.prompt("Type RESET INVESTMENT to confirm.");\n    if (typed !== "RESET INVESTMENT") return;\n    setBusy(true); setMessage("");\n    try {\n      await postV2({ action: "investment.reset", confirmation: typed });\n      setAccountId("");\n      setLedger(null);\n      setSelectedAssetId("");\n      setClosedAssetId("");\n      await reload();\n      setMessage("Investment data reset successfully.");\n    } catch (e) {\n      setMessage(e instanceof Error ? e.message : "Investment reset failed.");\n    } finally {\n      setBusy(false);\n    }\n  }`;
if (!ui.includes('async function resetInvestmentData()')) {
  if (!ui.includes(fnAnchor)) throw new Error("Investment account action anchor not found.");
  ui = ui.replace(fnAnchor, fnBlock);
}

const headerAnchor = '<button type="button" onClick={()=>openAccountEditor()} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add account</button></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">';
const headerReplacement = '<div className="flex gap-2"><button type="button" onClick={()=>openAccountEditor()} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add account</button><button type="button" onClick={()=>void resetInvestmentData()} disabled={busy} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Reset Investment</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">';
if (!ui.includes('>Reset Investment</button>')) {
  if (!ui.includes(headerAnchor)) throw new Error("Investment account list header anchor not found.");
  ui = ui.replace(headerAnchor, headerReplacement);
}

fs.writeFileSync(apiPath, api);
fs.writeFileSync(uiPath, ui);
console.log("Applied Investment reset feature.");
