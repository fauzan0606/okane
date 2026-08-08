import { prisma } from "@/lib/prisma";

import {
  createPayee,
  deletePayee,
  getPayeeById,
  getPayees,
  updatePayee,
} from "./repository";

import type {
  CreatePayeeInput,
  UpdatePayeeInput,
} from "./types";

export async function listPayees() {
  return getPayees();
}

export async function findPayee(id: string) {
  return getPayeeById(id);
}

export async function createPayeeService(
  input: CreatePayeeInput
) {
  return createPayee({
    name: input.name,
    note: input.note ?? null,
    sortOrder: 0,
    isActive: true,
  });
}

export async function updatePayeeService(
  id: string,
  input: UpdatePayeeInput
) {
  return updatePayee(id, {
    ...(input.name !== undefined && {
      name: input.name,
    }),

    ...(input.note !== undefined && {
      note: input.note,
    }),
  });
}

export async function deletePayeeService(id: string) {
  return deletePayee(id);
}

/**
 * Used internally by Transaction.
 * Returns an existing Payee (case-insensitive)
 * or creates a new one automatically.
 */
export async function findOrCreatePayeeByName(
  name?: string | null
) {
  const merchant = name?.trim();

  if (!merchant) {
    return null;
  }

  const payees = await prisma.payee.findMany({
    where: {
      isActive: true,
    },
  });

  const existing = payees.find(
    (payee) =>
      payee.name.toLowerCase() ===
      merchant.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  return createPayee({
    name: merchant,
    note: null,
    sortOrder: 0,
    isActive: true,
  });
}