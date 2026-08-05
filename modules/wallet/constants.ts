import { WalletType } from "@prisma/client";

export const WALLET_TYPES = [
  WalletType.CASH,
  WalletType.BANK_ACCOUNT,
  WalletType.CREDIT_CARD,
  WalletType.DEBIT_CARD,
  WalletType.E_WALLET,
  WalletType.FOREIGN_CASH,
  WalletType.INVESTMENT,
] as const;