"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransferAction } from "../actions";

type WalletOption = { id: string; name: string; walletType: string; currentBalance: number; currency: { code: string; symbol: string } };
type CashOption = { id: string; account: { name: string; provider: { name: string }; currency: { code: string } }; balance: number };

function formatMoney(value: number, symbol: string) { return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`; }
function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "Unable to create transfer."; }

export default function TransferForm({ wallets, investmentCashAccounts = [] }: { wallets: WalletOption[]; investmentCashAccounts?: CashOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const manualWallets = wallets.filter((wallet) => wallet.walletType !== "CREDIT_CARD");
  const sourceWallet = manualWallets.find((wallet) => wallet.id === sourceWalletId);
  const compatibleRdn = sourceWallet ? investmentCashAccounts.filter((c) => c.account.currency.code === sourceWallet.currency.code) : investmentCashAccounts;
  const destinationWallets = manualWallets.filter((wallet) => wallet.id !== sourceWalletId && (!sourceWallet || wallet.currency.code === sourceWallet.currency.code));
  const isRdnDestination = destinationId.startsWith("investmentCash:");
  const destinationWalletId = isRdnDestination ? "" : destinationId;
  const destinationCashId = isRdnDestination ? destinationId.slice("investmentCash:".length) : "";
  const destinationCash = investmentCashAccounts.find((c) => c.id === destinationCashId);

  async function submit(formData: FormData) {
    setPending(true);
    try {
      if (isRdnDestination) {
        const amount = Number(formData.get("amount"));
        const transferDate = String(formData.get("transferDate") || "");
        const r = await fetch("/api/investments/cash-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: "DEPOSIT", walletId: sourceWalletId, cashAccountId: destinationCashId, amount, date: new Date(`${transferDate}T12:00:00`).toISOString() }) });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "Investment cash transfer failed.");
        toast.success("Transfer to RDN created successfully.");
      } else {
        formData.set("toWalletId", destinationWalletId);
        await createTransferAction(formData);
        toast.success("Transfer created successfully.");
      }
      setOpen(false);
      setSourceWalletId("");
      setDestinationId("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function resetForm(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) { setSourceWalletId(""); setDestinationId(""); }
  }

  function handleSourceChange(value: string | null) { setSourceWalletId(value ?? ""); setDestinationId(""); }

  return (
    <Dialog open={open} onOpenChange={resetForm}>
      <DialogTrigger render={<Button type="button" className="gap-2 bg-emerald-500 px-4 text-xs font-bold text-[#06110b] hover:bg-emerald-400" />}>
        <ArrowLeftRight size={15} />
        + Transfer
      </DialogTrigger>
      <DialogContent showCloseButton className="!w-[calc(100vw-1.5rem)] !max-w-[760px] max-h-[92vh] overflow-y-auto rounded-[26px] border border-[#30465D] bg-[#0E1925] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:!w-[calc(100vw-3rem)]">
        <div className="p-5 sm:p-7 md:p-8">
          <DialogHeader className="mb-5 flex-row items-start gap-4 pr-10 sm:mb-6">
            <div><DialogTitle className="text-xl font-semibold text-white sm:text-2xl">New Transfer</DialogTitle><DialogDescription className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Move money between wallets or fund an investment RDN.</DialogDescription></div>
          </DialogHeader>

          <form action={submit} className="overflow-hidden rounded-[22px] border border-[#30465D] bg-[#0A1119]">
            <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="fromWalletId">From Wallet</Label><Select name="fromWalletId" required value={sourceWalletId} onValueChange={handleSourceChange}><SelectTrigger id="fromWalletId" className="w-full"><SelectValue placeholder="Select source wallet">{(id: string | null) => manualWallets.find((wallet) => wallet.id === id)?.name ?? "Select source wallet"}</SelectValue></SelectTrigger><SelectContent>{manualWallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code} · {formatMoney(wallet.currentBalance, wallet.currency.symbol)}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="destinationId">Destination</Label><Select name="destinationId" required value={destinationId} onValueChange={(value) => setDestinationId(value ?? "")}><SelectTrigger id="destinationId" className="w-full"><SelectValue placeholder={sourceWallet ? "Select destination" : "Select source first"}>{(id: string | null) => { if (!id) return "Select destination"; if (id.startsWith("investmentCash:")) { const c = investmentCashAccounts.find((x) => x.id === id.slice("investmentCash:".length)); return c ? `${c.account.provider.name} · ${c.account.name}` : "Investment RDN"; } return manualWallets.find((wallet) => wallet.id === id)?.name ?? "Select destination"; }}</SelectValue></SelectTrigger><SelectContent>{destinationWallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code} · {formatMoney(wallet.currentBalance, wallet.currency.symbol)}</SelectItem>)}{compatibleRdn.map((cash) => <SelectItem key={`investmentCash:${cash.id}`} value={`investmentCash:${cash.id}`}>RDN · {cash.account.provider.name} · {cash.account.name} · {formatMoney(cash.balance, cash.account.currency.code)}</SelectItem>)}</SelectContent></Select>{destinationCash && <p className="pt-1 text-[10px] text-slate-600">Investment cash / RDN selected.</p>}</div>
              </div>
              <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="transferDate">Date</Label><Input id="transferDate" name="transferDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div><div className="space-y-1.5 md:col-span-2"><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0" required /></div></div>
              {!isRdnDestination && <div><Label htmlFor="feeAmount">Transfer Fee <span className="text-muted-foreground">(optional)</span></Label><Input id="feeAmount" name="feeAmount" type="number" min="0" step="0.01" placeholder="0" className="mt-1.5" /></div>}
              {sourceWallet && <p className="text-[11px] text-slate-500">Available source balance: <span className="font-semibold text-slate-300">{formatMoney(sourceWallet.currentBalance, sourceWallet.currency.symbol)}</span>{isRdnDestination ? "." : ". Transfer amount plus fee cannot exceed this balance."}</p>}
            </div>
            <DialogFooter className="border-t border-[#30465D] bg-[#0E1925] p-4 sm:p-5"><Button type="button" variant="outline" onClick={() => resetForm(false)} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending || !sourceWalletId || !destinationId} className="bg-emerald-500 text-[#06110b] hover:bg-emerald-400"><ArrowRight size={16} />{pending ? "Transferring..." : isRdnDestination ? "Transfer to RDN" : "Transfer"}</Button></DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
