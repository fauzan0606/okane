"use client";

import {
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  saveParsedTransactionAction,
} from "../actions";

import type {
  ParsedTransaction,
} from "../types";

type Option = {
  id: string;
  name: string;
};

type EditablePreviewProps = {
  result: ParsedTransaction;
  wallets: Option[];
  categories: Option[];
};

export default function EditablePreview({
  result,
  wallets,
  categories,
}: EditablePreviewProps) {
  const [parsed, setParsed] =
    useState(result);

  const [isPending, startTransition] =
    useTransition();

  function updateWallet(walletId: string | null) {
    const wallet = wallets.find(
      (item) => item.id === walletId
    );

    setParsed((current) => ({
      ...current,
      wallet: wallet
        ? {
            ...wallet,
            score: current.wallet?.score ?? 0,
          }
        : undefined,
    }));
  }

  function updateCategory(categoryId: string | null) {
    const category = categories.find(
      (item) => item.id === categoryId
    );

    setParsed((current) => ({
      ...current,
      category,
    }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveParsedTransactionAction(parsed);

        alert(
          "Transaction saved successfully."
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to save transaction."
        );
      }
    });
  }

  return (
    <Card className="border-slate-700 bg-[#182335] shadow-xl">
      <div className="space-y-6 text-white">
        <div>
          <p className="text-sm font-medium text-blue-300">
            REVIEW & EDIT
          </p>

          <h2 className="mt-1 text-2xl font-semibold">
            Transaction Preview
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Periksa dan sesuaikan detail sebelum menyimpan.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              className="text-slate-200"
              htmlFor="merchant"
            >
              Merchant
            </Label>

            <Input
              id="merchant"
              className="border-slate-600 bg-white text-slate-950 placeholder:text-slate-400"
              value={parsed.merchant ?? ""}
              onChange={(event) => {
                const merchant = event.target.value.trim();

                setParsed((current) => ({
                  ...current,
                  merchant: merchant || undefined,
                }));
              }}
              placeholder="Nama merchant"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              className="text-slate-200"
              htmlFor="amount"
            >
              Amount
            </Label>

            <Input
              id="amount"
              className="border-slate-600 bg-white text-slate-950 placeholder:text-slate-400"
              type="number"
              min="1"
              step="1"
              value={parsed.amount ?? ""}
              onChange={(event) => {
                const value = event.target.valueAsNumber;

                setParsed((current) => ({
                  ...current,
                  amount: Number.isFinite(value)
                    ? value
                    : undefined,
                }));
              }}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              className="text-slate-200"
              htmlFor="type"
            >
              Type
            </Label>

            <Select
              value={parsed.type}
              onValueChange={(value) => {
                if (value === "INCOME" || value === "EXPENSE") {
                  setParsed((current) => ({
                    ...current,
                    type: value,
                  }));
                }
              }}
            >
              <SelectTrigger
                id="type"
                className="w-full border-slate-600 bg-white text-slate-950"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="EXPENSE">
                  Expense
                </SelectItem>

                <SelectItem value="INCOME">
                  Income
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              className="text-slate-200"
              htmlFor="wallet"
            >
              Wallet
            </Label>

            <Select
              value={parsed.wallet?.id ?? null}
              onValueChange={updateWallet}
            >
              <SelectTrigger
                id="wallet"
                className="w-full border-slate-600 bg-white text-slate-950"
              >
                <SelectValue placeholder="Pilih wallet" />
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
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label
              className="text-slate-200"
              htmlFor="category"
            >
              Category
            </Label>

            <Select
              value={parsed.category?.id ?? null}
              onValueChange={updateCategory}
            >
              <SelectTrigger
                id="category"
                className="w-full border-slate-600 bg-white text-slate-950"
              >
                <SelectValue placeholder="Pilih category" />
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
        </div>

        <Button
          className="w-full bg-blue-600 text-white hover:bg-blue-500"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending
            ? "Saving..."
            : "Save Transaction"}
        </Button>
      </div>
    </Card>
  );
}
