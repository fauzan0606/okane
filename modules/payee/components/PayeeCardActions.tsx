"use client";

import { useActionState } from "react";
import { toast } from "sonner";
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

import {
  deletePayeeAction,
} from "../actions";

import type {
  PayeeActionState,
} from "../types";

import type {
  PayeeWithRelations,
} from "../repository";

import PayeeForm from "./PayeeForm";

const initialState: PayeeActionState = {
  success: false,
};

type PayeeCardActionsProps = {
  payee: PayeeWithRelations;
};

export default function PayeeCardActions({
  payee,
}: PayeeCardActionsProps) {
  const [state, formAction, isPending] =
    useActionState(
      async (
        prevState: PayeeActionState,
        formData: FormData
      ) => {
        const result = await deletePayeeAction(
          prevState,
          formData
        );

        if (result.success) {
          toast.success(
            "Payee deleted successfully."
          );
        } else if (result.message) {
          toast.error(result.message);
        }

        return result;
      },
      initialState
    );

  return (
    <div className="flex items-center gap-1">
      <PayeeForm
        mode="edit"
        payee={payee}
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${payee.name}`}
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
              aria-label={`Delete ${payee.name}`}
            >
              <Trash2 />
            </Button>
          }
        />

        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete payee?
            </DialogTitle>

            <DialogDescription>
              {`"${payee.name}" will be archived and hidden from your payee list.`}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction}>
            <input
              type="hidden"
              name="id"
              value={payee.id}
            />

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
                {isPending
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}