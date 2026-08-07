import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PayeeWithRelations =
  Prisma.PayeeGetPayload<object>;

export async function getPayees(): Promise<PayeeWithRelations[]> {
  return prisma.payee.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function getPayeeById(
  id: string
): Promise<PayeeWithRelations | null> {
  return prisma.payee.findUnique({
    where: {
      id,
    },
  });
}

export async function createPayee(
  data: Prisma.PayeeCreateInput
) {
  return prisma.payee.create({
    data,
  });
}

export async function updatePayee(
  id: string,
  data: Prisma.PayeeUpdateInput
) {
  return prisma.payee.update({
    where: {
      id,
    },
    data,
  });
}

export async function deletePayee(id: string) {
  return prisma.payee.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
}