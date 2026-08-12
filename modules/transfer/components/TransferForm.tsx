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

function formatMoney(value: number, symbol: string) { return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`; }

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to create transfer.";
}

export default function TransferForm({ wallets }: { wallets: WalletOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    try {
      await createTransferAction(formData);
      toast.success("Transfer created successfully.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
      // Keep the dialog open so the user can correct the source wallet,
      // amount, or fee instead of seeing a runtime error page.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" className="gap-2 bg-emerald-500 px-4 text-xs font-bold text-[#06110b] hover:bg-emerald-400" />}>
        <ArrowLeftRight size={15} />
        + Transfer
      </DialogTrigger>
      <DialogContent showCloseButton className="!w-[calc(100vw-1.5rem)] !max-w-[760px] max-h-[92vh] overflow-y-auto rounded-[26px] border border-[#30465D] bg-[#0E1925] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:!w-[calc(100vw-3rem)]">
        <div className="p-5 sm:p-7 md:p-8">
          <DialogHeader className="mb-5 flex-row items-start gap-4 pr-10 sm:mb-6">
            <div>
              <DialogTitle className="text-xl font-semibold text-white sm:text-2xl">New Transfer</DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Move money between your own wallets without creating an income or expense transaction.</DialogDescription>
            </div>
          </DialogHeader>

          {wallets.length < 2 ? (
            <div className="rounded-[22px] border border-dashed border-amber-400/20 bg-[#0A1119] p-5 text-sm text-amber-200">You need at least two active wallets before creating a transfer.</div>
          ) : (
            <form action={submit} className="overflow-hidden rounded-[22px] border border-[#30465D] bg-[#0A1119]">
              <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fromWalletId">From Wallet</Label>
                    <Select name="fromWalletId" required defaultValue="">
                      <SelectTrigger id="fromWalletId" className="w-full"><SelectValue placeholder="Select source wallet">{(id: string | null) => wallets.find((wallet) => wallet.id === id)?.name ?? "Select source wallet"}</SelectValue></SelectTrigger>
                      <SelectContent>{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code} · {formatMoney(wallet.currentBalance, wallet.currency.symbol)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="toWalletId">To Wallet</Label>
                    <Select name="toWalletId" required defaultValue="">
                      <SelectTrigger id="toWalletId" className="w-full"><SelectValue placeholder="Select destination wallet">{(id: string | null) => wallets.find((wallet) => wallet.id === id)?.name ?? "Select destination wallet"}</SelectValue></SelectTrigger>
                      <SelectContent>{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="feeAmount">Transfer Fee <span className="text-muted-foreground">(optional)</span></Label><Input id="feeAmount" name="feeAmount" type="number" min="0" step="0.01" placeholder="0" /></div>
                </div>
                <input type="hidden" name="transferDate" value={new Date().toISOString().slice(0, 10)} />
              </div>
              <DialogFooter className="border-t border-[#30465D] bg-[#0E1925] p-4 sm:p-5">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending} className="bg-emerald-500 text-[#06110b] hover:bg-emerald-400"><ArrowRight size={16} />{pending ? "Transferring..." : "Transfer"}</Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
