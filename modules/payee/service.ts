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