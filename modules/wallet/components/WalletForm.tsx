"use client";

import { useActionState, useState, type ReactElement } from "react";
import { toast } from "sonner";
import type { Currency } from "@prisma/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWalletAction, updateWalletAction } from "../actions";
import { WALLET_TYPES, formatWalletType } from "../constants";
import type { WalletActionState } from "../types";
import type { WalletClientData } from "../repository";

const initialState: WalletActionState = { success: false };
type WalletFormProps = { mode: "create" | "edit"; wallet?: WalletClientData; currencies: Currency[]; trigger: ReactElement };

export default function WalletForm({ mode, wallet, currencies, trigger }: WalletFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [walletType, setWalletType] = useState(wallet?.walletType ?? WALLET_TYPES[0]);
  const baseAction = mode === "create" ? createWalletAction : updateWalletAction;
  const [state, formAction, isPending] = useActionState(async (prevState: WalletActionState, formData: FormData) => {
    const result = await baseAction(prevState, formData);
    if (result.success) {
      toast.success(mode === "create" ? "Wallet created successfully." : "Wallet updated successfully.");
      if (mode === "create") setFormKey((k) => k + 1);
      setOpen(false);
    } else if (result.message) toast.error(result.message);
    return result;
  }, initialState);

  const defaultCurrencyCode = wallet?.currency.code ?? currencies.find((currency) => currency.code === "IDR")?.code ?? currencies[0]?.code;
  const defaultBalance = wallet?.currentBalance ?? "0";
  const isCreditCard = walletType === "CREDIT_CARD";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && mode === "create") setFormKey((k) => k + 1); setOpen(isOpen); }}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Wallet" : "Edit Wallet"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Create a new cash, bank account, credit card, or e-wallet." : "Update this wallet's details and current balance."}</DialogDescription>
        </DialogHeader>
        <form key={formKey} action={formAction} className="space-y-4">
          {mode === "edit" && wallet && <input type="hidden" name="id" value={wallet.id} />}
          <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={wallet?.name} placeholder="BCA Visa" required />{state.fieldErrors?.name && <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="walletType">Wallet Type</Label><Select name="walletType" value={walletType} onValueChange={(value) => setWalletType(value as typeof walletType)}><SelectTrigger id="walletType" className="w-full"><SelectValue placeholder="Select a type" /></SelectTrigger><SelectContent>{WALLET_TYPES.map((type) => <SelectItem key={type} value={type}>{formatWalletType(type)}</SelectItem>)}</SelectContent></Select>{state.fieldErrors?.walletType && <p className="text-xs text-destructive">{state.fieldErrors.walletType[0]}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="currencyCode">Currency</Label><Select name="currencyCode" defaultValue={defaultCurrencyCode}><SelectTrigger id="currencyCode" className="w-full"><SelectValue placeholder="Select a currency" /></SelectTrigger><SelectContent>{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code} — {currency.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="currentBalance">{mode === "create" ? "Opening Balance" : "Current Balance"}</Label><Input id="currentBalance" name="currentBalance" type="number" inputMode="decimal" step="any" defaultValue={defaultBalance} placeholder="0" required /><p className="text-xs text-slate-500">{mode === "create" ? "Starting balance for this wallet." : "Set the wallet's current balance manually."}</p>{state.fieldErrors?.currentBalance && <p className="text-xs text-destructive">{state.fieldErrors.currentBalance[0]}</p>}</div>
          {isCreditCard && <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div><p className="text-sm font-semibold text-white">Credit Card Settings</p><p className="mt-1 text-xs text-slate-500">Used to calculate billing cycles and due dates.</p></div><div className="space-y-1.5"><Label htmlFor="creditLimit">Credit Limit</Label><Input id="creditLimit" name="creditLimit" type="number" inputMode="decimal" step="any" defaultValue={wallet?.creditCard?.creditLimit ?? ""} placeholder="20000000" required />{state.fieldErrors?.creditLimit && <p className="text-xs text-destructive">{state.fieldErrors.creditLimit[0]}</p>}</div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="billingDate">Billing Day</Label><Input id="billingDate" name="billingDate" type="number" min="1" max="31" defaultValue={wallet?.creditCard?.billingDate ?? ""} placeholder="15" required />{state.fieldErrors?.billingDate && <p className="text-xs text-destructive">{state.fieldErrors.billingDate[0]}</p>}</div><div className="space-y-1.5"><Label htmlFor="dueDate">Due Day</Label><Input id="dueDate" name="dueDate" type="number" min="1" max="31" defaultValue={wallet?.creditCard?.dueDate ?? ""} placeholder="5" required />{state.fieldErrors?.dueDate && <p className="text-xs text-destructive">{state.fieldErrors.dueDate[0]}</p>}</div></div></div>}
          <div className="space-y-1.5"><Label htmlFor="bank">Bank (optional)</Label><Input id="bank" name="bank" defaultValue={wallet?.bank ?? ""} placeholder="BCA" /></div>
          <div className="space-y-1.5"><Label htmlFor="note">Note (optional)</Label><Textarea id="note" name="note" defaultValue={wallet?.note ?? ""} placeholder="Optional note about this wallet" /></div>
          {state.message && <p className="text-xs text-destructive">{state.message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => { setFormKey((k) => k + 1); setOpen(false); }} disabled={isPending}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving..." : mode === "create" ? "Create Wallet" : "Save Changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
