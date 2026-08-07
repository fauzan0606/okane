"use server";

import { revalidatePath } from "next/cache";

import {
  createPayeeService,
  updatePayeeService,
  deletePayeeService,
} from "./service";

import { payeeSchema } from "./schema";
import type { PayeeActionState } from "./types";

export async function createPayeeAction(
  _prevState: PayeeActionState,
  formData: FormData
): Promise<PayeeActionState> {
  const parsed = payeeSchema.safeParse({
    name: formData.get("name"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createPayeeService(parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create payee.",
    };
  }

  revalidatePath("/payee");

  return {
    success: true,
  };
}

export async function updatePayeeAction(
  _prevState: PayeeActionState,
  formData: FormData
): Promise<PayeeActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing payee id.",
    };
  }

  const parsed = payeeSchema.partial().safeParse({
    name: formData.get("name"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updatePayeeService(id, parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update payee.",
    };
  }

  revalidatePath("/payee");

  return {
    success: true,
  };
}

export async function deletePayeeAction(
  _prevState: PayeeActionState,
  formData: FormData
): Promise<PayeeActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing payee id.",
    };
  }

  try {
    await deletePayeeService(id);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete payee.",
    };
  }

  revalidatePath("/payee");

  return {
    success: true,
  };
}