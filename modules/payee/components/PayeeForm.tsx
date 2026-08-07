"use client";

import {
  useActionState,
  useState,
  type ReactElement,
} from "react";
import { toast } from "sonner";

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
  createPayeeAction,
  updatePayeeAction,
} from "../actions";

import type {
  PayeeActionState,
} from "../types";

import type {
  PayeeWithRelations,
} from "../repository";

const initialState: PayeeActionState = {
  success: false,
};

type PayeeFormProps = {
  mode: "create" | "edit";
  payee?: PayeeWithRelations;
  trigger: ReactElement;
};

export default function PayeeForm({
  mode,
  payee,
  trigger,
}: PayeeFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const baseAction =
    mode === "create"
      ? createPayeeAction
      : updatePayeeAction;

  const [state, formAction, isPending] =
    useActionState(
      async (
        prevState: PayeeActionState,
        formData: FormData
      ) => {
        const result = await baseAction(
          prevState,
          formData
        );

        if (result.success) {
          toast.success(
            mode === "create"
              ? "Payee created successfully."
              : "Payee updated successfully."
          );

          if (mode === "create") {
            setFormKey((k) => k + 1);
          }

          setOpen(false);
        } else if (result.message) {
          toast.error(result.message);
        }

        return result;
      },
      initialState
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && mode === "create") {
          setFormKey((k) => k + 1);
        }

        setOpen(isOpen);
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Add Payee"
              : "Edit Payee"}
          </DialogTitle>

          <DialogDescription>
            {mode === "create"
              ? "Create a new payee."
              : "Update this payee."}
          </DialogDescription>
        </DialogHeader>
                <form
          key={formKey}
          action={formAction}
          className="space-y-4"
        >
          {mode === "edit" && payee && (
            <input
              type="hidden"
              name="id"
              value={payee.id}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">
              Name
            </Label>

            <Input
              id="name"
              name="name"
              defaultValue={payee?.name}
              placeholder="Tokopedia"
              required
            />

            {state.fieldErrors?.name && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Note (optional)
            </Label>

            <Textarea
              id="note"
              name="note"
              defaultValue={payee?.note ?? ""}
              placeholder="Optional note"
            />
          </div>

          {state.message && (
            <p className="text-xs text-destructive">
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormKey((k) => k + 1);
                setOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending
                ? "Saving..."
                : mode === "create"
                  ? "Create Payee"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
              </DialogContent>
    </Dialog>
  );
}