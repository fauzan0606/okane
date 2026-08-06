"use client";

import { useActionState } from "react";
import type { Currency } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";

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

import { deleteWalletAction } from "../actions";
import type { WalletActionState } from "../types";
import type { WalletWithRelations } from "../repository";

import WalletForm from "./WalletForm";

const initialState: WalletActionState = { success: false };

type WalletCardActionsProps = {
  wallet: WalletWithRelations;
  currencies: Currency[];
};

export default function WalletCardActions({
  wallet,
  currencies,
}: WalletCardActionsProps) {
  const [state, formAction, isPending] = useActionState(
    deleteWalletAction,
    initialState
  );

  return (
    <div className="flex items-center gap-1">
      <WalletForm
        mode="edit"
        wallet={wallet}
        currencies={currencies}
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${wallet.name}`}
          >
            <Pencil />
          </Button>
        }
      />

      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Archive ${wallet.name}`}
            >
              <Trash2 />
            </Button>
          }
        />

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive wallet?</DialogTitle>
            <DialogDescription>
              {`"${wallet.name}" will be archived and hidden from your wallet list. This does not delete its transaction history.`}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction}>
            <input type="hidden" name="id" value={wallet.id} />

            {state.message && (
              <p className="mb-2 text-xs text-destructive">
                {state.message}
              </p>
            )}

            <DialogFooter showCloseButton>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending}
              >
                {isPending ? "Archiving..." : "Archive"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
