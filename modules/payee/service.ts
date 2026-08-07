import {
  createPayee,
  deletePayee,
  getPayeeById,
  getPayees,
  updatePayee,
} from "./repository";

import {
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

    note: input.note || null,

    sortOrder: 0,
    isActive: true,
  });
}

export async function updatePayeeService(
  id: string,
  input: UpdatePayeeInput
) {
  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.note !== undefined) {
    data.note = input.note;
  }

  return updatePayee(id, data);
}

export async function deletePayeeService(id: string) {
  return deletePayee(id);
}
import { prisma } from "@/lib/prisma";

export async function findOrCreatePayeeByName(
  name: string
) {
  const merchant = name.trim();

  if (!merchant) {
    return null;
  }

  const existing = await prisma.payee.findFirst({
    where: {
      name: {
        equals: merchant,
        mode: "insensitive",
      },
      isActive: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.payee.create({
    data: {
      name: merchant,
      isActive: true,
    },
  });
}