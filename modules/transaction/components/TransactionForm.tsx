"use client";

import {
  useActionState,
  useState,
  type ReactElement,
} from "react";

import { toast } from "sonner";
import type {
  Category,
  Payee,

  Wallet,
} from "@prisma/client";

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

import {
  createTransactionAction,
  updateTransactionAction,
} from "../actions";

import {
  TRANSACTION_TYPES,
  formatTransactionType,
} from "../constants";

import type {
  TransactionActionState,
} from "../types";

import type {
  TransactionWithRelations,
} from "../repository";

const initialState: TransactionActionState = {
  success: false,
};

type TransactionFormProps = {
  mode: "create" | "edit";

  transaction?: TransactionWithRelations;

  wallets: Wallet[];
  categories: Category[];
  payees: Payee[];

  trigger: ReactElement;
};

export default function TransactionForm({
  mode,
  transaction,
  wallets,
  categories,
  payees,
  trigger,
}: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const baseAction =
    mode === "create"
      ? createTransactionAction
      : updateTransactionAction;

  const [state, formAction, isPending] =
    useActionState(
      async (
        prevState: TransactionActionState,
        formData: FormData
      ) => {
        const result = await baseAction(
          prevState,
          formData
        );

        if (result.success) {
          toast.success(
            mode === "create"
              ? "Transaction created successfully."
              : "Transaction updated successfully."
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

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Add Transaction"
              : "Edit Transaction"}
          </DialogTitle>

          <DialogDescription>
            Record an income or expense.
          </DialogDescription>
        </DialogHeader>
                <form
          key={formKey}
          action={formAction}
          className="space-y-4"
        >
          {mode === "edit" && transaction && (
            <input
              type="hidden"
              name="id"
              value={transaction.id}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="transactionDate">
                Date
              </Label>

              <Input
                id="transactionDate"
                name="transactionDate"
                type="date"
                defaultValue={
                  transaction
                    ? new Date(transaction.transactionDate)
                        .toISOString()
                        .slice(0, 10)
                    : new Date()
                        .toISOString()
                        .slice(0, 10)
                }
                required
              />

              {state.fieldErrors?.transactionDate && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.transactionDate[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">
                Type
              </Label>

              <Select
                name="type"
                defaultValue={
                  transaction?.type ??
                  TRANSACTION_TYPES[0]
                }
              >
                <SelectTrigger
                  id="type"
                  className="w-full"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>

                <SelectContent>
                  {TRANSACTION_TYPES.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                    >
                      {formatTransactionType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {state.fieldErrors?.type && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.type[0]}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">
              Amount
            </Label>

            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              defaultValue={
                transaction?.amount?.toString()
              }
              placeholder="100000"
              required
            />

            {state.fieldErrors?.amount && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.amount[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walletId">
              Wallet
            </Label>

            <Select
              name="walletId"
              defaultValue={
                transaction?.walletId
              }
            >
                <SelectTrigger
                  id="walletId"
                  className="w-full"
                >
                  <SelectValue placeholder="Select wallet">
                    {(walletId: string | null) =>
                      wallets.find(
                        (wallet) => wallet.id === walletId
                      )?.name ?? "Select wallet"}
                  </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {wallets.map((wallet) => (
                  <SelectItem
                    key={wallet.id}
                    value={wallet.id}
                  >
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {state.fieldErrors?.walletId && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.walletId[0]}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">
                Category
              </Label>

              <Select
                name="categoryId"
                defaultValue={
                  transaction?.categoryId ??
                  ""
                }
              >
                <SelectTrigger
                  id="categoryId"
                  className="w-full"
                >
                  <SelectValue placeholder="Optional">
                    {(categoryId: string | null) =>
                      categories.find(
                        (category) => category.id === categoryId
                      )?.name ?? "Optional"}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
  <Label htmlFor="merchant">
    Merchant
  </Label>

  <Input
    id="merchant"
    name="merchant"
    list="merchant-list"
    defaultValue={
      transaction?.payee?.name ?? ""
    }
    placeholder="Merchant"
  />

  <datalist id="merchant-list">
    {payees.map((payee) => (
      <option
        key={payee.id}
        value={payee.name}
      />
    ))}
  </datalist>
</div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Note
            </Label>

            <Textarea
              id="note"
              name="note"
              defaultValue={
                transaction?.note ?? ""
              }
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
                  ? "Create Transaction"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
