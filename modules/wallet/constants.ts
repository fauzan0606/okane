import { WalletType } from "@prisma/client";

export const HIDE_CREDIT_CARDS_IN_WALLETS_KEY = "okane.dashboard.hide-credit-cards-in-wallets.v1";

export const WALLET_TYPES = [
  WalletType.CASH,
  WalletType.BANK_ACCOUNT,
  WalletType.CREDIT_CARD,
  WalletType.DEBIT_CARD,
  WalletType.E_WALLET,
  WalletType.FOREIGN_CASH,
  WalletType.INVESTMENT,
] as const;

export function formatWalletType(walletType: WalletType): string {
  return walletType.replaceAll("_", " ");
}
