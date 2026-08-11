"use client";

import { useActionState, useState } from "react";
import { CircleDollarSign, Info, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createReceivableAction } from "../actions";

type Currency = { id: string; code: string; symbol: string };
type Wallet = { id: string; name: string; walletType: string; currency: { code: string } };
type FormState = { success: boolean; message?: string; fieldErrors?: Record<string, string[]> };

const initialState: FormState = { success: false };
const inputClass = "rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50";
const selectClass = "rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-emerald-400/50";

export default function ReceivableForm({ currencies, wallets, defaultCurrencyId, today }: { currencies: Currency[]; wallets: Wallet[]; defaultCurrencyId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    try {
      await createReceivableAction(formData);
      setFormKey((key) => key + 1);
      setOpen(false);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Unable to save receivable." };
    }
  }, initialState);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setFormKey((key) => key + 1); setOpen(nextOpen); }}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400"
          />
        }
      >
        <Plus size={15} />
        Add Receivable
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-[24px] border border-[#30465D] bg-[#0E1925] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
      >
        <div className="p-5 md:p-6">
          <DialogHeader className="flex-row items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
              <CircleDollarSign size={21} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">Add Receivable</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5 text-slate-500">Record money owed to you from a loan, shared expense, or someone using your wallet or credit card.</DialogDescription>
            </div>
          </DialogHeader>

          <form key={formKey} action={formAction} className="mt-5 overflow-hidden rounded-[20px] border border-[#30465D] bg-[#0A1119]">
            <div className="space-y-6 p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-slate-200">Person name <span className="text-emerald-400">*</span></span><input name="personName" required placeholder="e.g. Andi" className={`mt-2 w-full ${inputClass}`} /></label>
                <label className="block"><span className="text-sm font-medium text-slate-200">What is this for? <span className="text-emerald-400">*</span></span><input name="description" required placeholder="e.g. Dinner, Loan, Reimbursement" className={`mt-2 w-full ${inputClass}`} /></label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-slate-200">Amount <span className="text-emerald-400">*</span></span><div className="mt-2 flex overflow-hidden rounded-xl border border-[#30465D] bg-[#0A1119]"><select name="currencyId" required defaultValue={defaultCurrencyId} className="w-[112px] shrink-0 border-r border-[#30465D] bg-transparent px-3 py-3 text-sm text-slate-300 outline-none">{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code} · {currency.symbol}</option>)}</select><input name="amount" required inputMode="decimal" placeholder="0" className="min-w-0 w-full bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600" /></div></label>
                <label className="block"><span className="text-sm font-medium text-slate-200">From wallet <span className="text-emerald-400">*</span></span><select name="sourceWalletId" required className={`mt-2 w-full ${selectClass}`}><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}{wallet.walletType === "CREDIT_CARD" ? " · CC" : ""}</option>)}</select></label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><div className="flex items-center gap-1.5"><span className="text-sm font-medium text-slate-200">Loan Date <span className="text-emerald-400">*</span></span><span title="When did you give the money?" className="text-slate-600"><Info size={14} /></span></div><p className="mt-1 text-[10px] text-slate-600">When did you give the money?</p><input name="loanDate" type="date" required defaultValue={today} className={`mt-2 w-full ${inputClass}`} /></label>
                <label className="block"><div className="flex items-center gap-1.5"><span className="text-sm font-medium text-slate-200">Expected Payment Date</span><span title="When do you expect to receive it back?" className="text-slate-600"><Info size={14} /></span></div><p className="mt-1 text-[10px] text-slate-600">When do you expect to receive it back? (optional)</p><input name="dueDate" type="date" className={`mt-2 w-full ${inputClass}`} /></label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#30465D] bg-[#0E1925] p-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-white/20 hover:text-white">Cancel</button>
              <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#07110b] hover:bg-emerald-400">{pending ? "Saving..." : <><CircleDollarSign size={16} /> Save Receivable</>}</button>
            </div>
          </form>
          {state.message && <p className="mt-3 text-xs text-red-300">{state.message}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
