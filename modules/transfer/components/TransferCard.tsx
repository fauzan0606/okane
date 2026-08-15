"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteTransferAction, updateTransferAction } from "../actions";

type WalletOption = {
  id: string;
  name: string;
  walletType: string;
  currentBalance: number;
  currency: { code: string; symbol: string };
};

type Transfer = {
  id: string;
  transferDate: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  feeAmount: number;
  origin: "MANUAL" | "CREDIT_CARD_PAYMENT";
  fromWallet: { name: string; currency: { code: string; symbol: string } };
  toWallet: { name: string; currency: { code: string; symbol: string } };
};

function formatMoney(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
}

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update transfer.";
}

export default function TransferCard({ transfer, wallets }: { transfer: Transfer; wallets: WalletOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [fromWalletId, setFromWalletId] = useState(transfer.fromWalletId);
  const [toWalletId, setToWalletId] = useState(transfer.toWalletId);

  async function submit(formData: FormData) {
    setPending(true);
    try {
      await updateTransferAction(formData);
      toast.success("Transfer updated successfully.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this transfer? The source and destination balances will be restored, including the transfer fee.")) return;
    setDeletePending(true);
    try {
      const formData = new FormData();
      formData.set("id", transfer.id);
      await deleteTransferAction(formData);
      toast.success("Transfer deleted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete transfer.");
    } finally {
      setDeletePending(false);
    }
  }

  const manual = transfer.origin === "MANUAL";
  const manualWallets = wallets.filter((wallet) => wallet.walletType !== "CREDIT_CARD");
  const selectedSource = manualWallets.find((wallet) => wallet.id === fromWalletId);
  const destinationWallets = manualWallets.filter((wallet) => wallet.id !== fromWalletId && (!selectedSource || wallet.currency.code === selectedSource.currency.code));

  return (
    <article className="rounded-[18px] border border-[#30465D] bg-[#172A3D] px-4 py-4 md:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${manual ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300" : "border-blue-400/15 bg-blue-400/10 text-blue-300"}`}>
              {manual ? "TRANSFER" : "CC PAYMENT"}
            </span>
            <span className="text-[10px] text-slate-600"><CalendarDays size={11} className="mr-1 inline" />{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(transfer.transferDate))}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-white">{transfer.fromWallet.name}</span>
            <ArrowRight size={14} className="text-slate-600" />
            <span className="font-semibold text-white">{transfer.toWallet.name}</span>
          </div>
          {!manual && <p className="mt-1 text-[10px] text-slate-600">Manage this payment from Credit Cards &gt; Payment History.</p>}
        </div>

        <div className="flex items-end justify-between gap-5 md:justify-end">
          <div>
            <p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Amount</p>
            <p className="mt-0.5 text-sm font-bold text-white">{formatMoney(transfer.amount, transfer.fromWallet.currency.symbol)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.08em] text-slate-600">Fee</p>
            <p className={`mt-0.5 text-sm font-semibold ${transfer.feeAmount > 0 ? "text-amber-300" : "text-slate-400"}`}>{transfer.feeAmount > 0 ? formatMoney(transfer.feeAmount, transfer.fromWallet.currency.symbol) : "—"}</p>
          </div>
          {manual && (
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => setOpen(true)} disabled={pending || deletePending} aria-label="Edit transfer"><Pencil size={14} /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-300" onClick={remove} disabled={pending || deletePending} aria-label="Delete transfer"><Trash2 size={14} /></Button>
            </div>
          )}
          {!manual && <MoreHorizontal size={16} className="text-slate-600" />}
        </div>
      </div>

      {manual && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="!w-[calc(100vw-1.5rem)] !max-w-[700px] rounded-[24px] border border-[#30465D] bg-[#0E1925] text-white sm:!w-[calc(100vw-3rem)]">
            <DialogHeader>
              <DialogTitle>Edit Transfer</DialogTitle>
              <DialogDescription className="text-slate-500">Changing a transfer recalculates the affected wallet balances and transfer fee.</DialogDescription>
            </DialogHeader>
            <form action={submit} className="space-y-5">
              <input type="hidden" name="id" value={transfer.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>From Wallet</Label>
                  <Select name="fromWalletId" value={fromWalletId} onValueChange={(value) => setFromWalletId(value ?? "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select source wallet" /></SelectTrigger>
                    <SelectContent>{manualWallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code} · {formatMoney(wallet.currentBalance, wallet.currency.symbol)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>To Wallet</Label>
                  <Select name="toWalletId" value={toWalletId} onValueChange={(value) => setToWalletId(value ?? "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select destination wallet" /></SelectTrigger>
                    <SelectContent>{destinationWallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5"><Label htmlFor={`transfer-date-${transfer.id}`}>Date</Label><Input id={`transfer-date-${transfer.id}`} name="transferDate" type="date" defaultValue={dateInputValue(transfer.transferDate)} required /></div>
                <div className="space-y-1.5"><Label htmlFor={`transfer-amount-${transfer.id}`}>Amount</Label><Input id={`transfer-amount-${transfer.id}`} name="amount" type="number" min="0.01" step="0.01" defaultValue={transfer.amount} required /></div>
                <div className="space-y-1.5"><Label htmlFor={`transfer-fee-${transfer.id}`}>Fee</Label><Input id={`transfer-fee-${transfer.id}`} name="feeAmount" type="number" min="0" step="0.01" defaultValue={transfer.feeAmount} /></div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending} className="bg-emerald-500 text-[#06110b] hover:bg-emerald-400">{pending ? "Saving..." : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}
