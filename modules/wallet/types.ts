import { WalletType } from "@prisma/client";

export interface CreateWalletInput {
  name: string;
  walletType: WalletType;
  currencyCode: string;

  bank?: string;
  note?: string;
}

export interface UpdateWalletInput {
  name?: string;
  walletType?: WalletType;
  currencyCode?: string;

  bank?: string;
  note?: string;
}

export type WalletActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};