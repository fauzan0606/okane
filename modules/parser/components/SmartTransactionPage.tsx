"use client";

import {
  useEffect,
  useState,
} from "react";

import { Input } from "@/components/ui/input";

import {
  parseTransactionAction,
} from "../actions";

import ParserPreview from "./ParserPreview";

import type {
  ParsedTransaction,
} from "../types";

export default function SmartTransactionPage() {
  const [text, setText] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<
      ParsedTransaction | undefined
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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Smart Transaction
        </h1>

        <p className="mt-2 text-zinc-500">
          Describe your transaction naturally.
        </p>
      </div>

      <div className="space-y-2 rounded-3xl border p-6">
        <Input
          value={text}
          onChange={(e) => {
            const value = e.target.value;

            setText(value);

            if (!value.trim()) {
              setResult(undefined);
            }
          }}
          placeholder="Starbucks 50rb cc bca"
          autoFocus
        />

        {loading && (
          <p className="text-sm text-zinc-500">
            Parsing...
          </p>
        )}
      </div>

      {result && (
        <ParserPreview
          result={result}
        />
      )}
    </div>
  );
}