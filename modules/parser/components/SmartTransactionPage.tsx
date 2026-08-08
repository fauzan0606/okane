"use client";

import {
  useEffect,
  useState,
} from "react";

import { Input } from "@/components/ui/input";

import {
  parseTransactionAction,
} from "../actions";

import EditablePreview from "./EditablePreview";

import type {
  SmartTransactionResult,
} from "../types";

type SmartTransactionPageProps = {
  wallets: {
    id: string;
    name: string;
  }[];

  categories: {
    id: string;
    name: string;
  }[];
};

export default function SmartTransactionPage({
  wallets,
  categories,
}: SmartTransactionPageProps) {
  const [text, setText] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<
      SmartTransactionResult | undefined
    >(undefined);

  useEffect(() => {
    const keyword = text.trim();

    if (!keyword) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const parsed =
          await parseTransactionAction(
            keyword
          );

        setResult(parsed);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () =>
      clearTimeout(timer);
  }, [text]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div>
        <p className="text-sm font-medium text-blue-600">
          SMART TRANSACTION
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Smart Transaction
        </h1>

        <p className="mt-2 text-slate-500">
          Tulis transaksi dengan bahasa natural, lalu periksa sebelum menyimpan.
        </p>
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="transaction-input"
        >
          Deskripsi transaksi
        </label>

        <Input
          id="transaction-input"
          value={text}
          onChange={(e) => {
            const value = e.target.value;

            setText(value);

            if (!value.trim()) {
              setResult(undefined);
            }
          }}
          placeholder="Contoh: Starbucks 50rb BCA"
          autoFocus
        />

        {loading && (
          <p className="text-sm text-slate-500">
            Membaca transaksi...
          </p>
        )}
      </div>

      {result && (
        <EditablePreview
          key={text}
          result={result.parsed}
          wallets={wallets}
          categories={categories}
          onSaved={() => {
            setText("");
            setResult(undefined);
          }}
        />
      )}
    </div>
  );
}
