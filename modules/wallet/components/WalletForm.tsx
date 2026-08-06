"use client";

import { useActionState, useState, type ReactElement } from "react";
import type { Currency } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createWalletAction, updateWalletAction } from "../actions";
import { WALLET_TYPES, formatWalletType } from "../constants";
import type { WalletActionState } from "../types";
import type { WalletWithRelations } from "../repository";

const initialState: WalletActionState = { success: false };

type WalletFormProps = {
  mode: "create" | "edit";
  wallet?: WalletWithRelations;
  currencies: Currency[];
  trigger: ReactElement;
};

export default function WalletForm({
  mode,
  wallet,
  currencies,
  trigger,
}: WalletFormProps) {
  const [open, setOpen] = useState(false);

  const baseAction = mode === "create" ? createWalletAction : updateWalletAction;

  // Close the dialog once a submission succeeds. This runs inside the
  // action itself (after awaiting the real server action), i.e. inside the
  // transition React already starts for us via useActionState/form action —
  // not during render (react-hooks/refs) and not inside a useEffect
  // (react-hooks/set-state-in-effect), so it's safe on both counts.
  const [state, formAction, isPending] = useActionState(
    async (prevState: WalletActionState, formData: FormData) => {
      const result = await baseAction(prevState, formData);

      if (result.success) {
        setOpen(false);
      }

      return result;
    },
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Wallet" : "Edit Wallet"}
          </DialogTitle>

          <DialogDescription>
            {mode === "create"
              ? "Create a new cash, bank account, credit card, or e-wallet."
              : "Update this wallet's details."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {mode === "edit" && wallet && (
            <input type="hidden" name="id" value={wallet.id} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={wallet?.name}
              placeholder="BCA Visa"
              required
            />
            {state.fieldErrors?.name && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walletType">Wallet Type</Label>
            <Select
              name="walletType"
              defaultValue={wallet?.walletType ?? WALLET_TYPES[0]}
            >
              <SelectTrigger id="walletType" className="w-full">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatWalletType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.walletType && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.walletType[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currencyCode">Currency</Label>
            <Select
              name="currencyCode"
              defaultValue={wallet?.currency.code ?? currencies[0]?.code}
            >
              <SelectTrigger id="currencyCode" className="w-full">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} — {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.currencyCode && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.currencyCode[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bank">Bank (optional)</Label>
            <Input
              id="bank"
              name="bank"
              defaultValue={wallet?.bank ?? ""}
              placeholder="BCA"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              name="note"
              defaultValue={wallet?.note ?? ""}
              placeholder="Optional note about this wallet"
            />
          </div>

          {state.message && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : mode === "create"
                  ? "Create Wallet"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
