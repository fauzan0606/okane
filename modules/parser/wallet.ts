import type { ParserContext } from "./types";

type WalletMatch = {
  id: string;
  name: string;
  score: number;
};

const ALIASES: Record<string, string[]> = {
  cash: [
    "cash",
    "tunai",
    "uang",
    "kontan",
  ],

  gopay: [
    "gopay",
    "go-pay",
    "go pay",
  ],

  ovo: [
    "ovo",
  ],

  dana: [
    "dana",
  ],

  seabank: [
    "seabank",
    "sea",
  ],

  bca: [
    "bca",
  ],

  mandiri: [
    "mandiri",
  ],

  bri: [
    "bri",
  ],

  bni: [
    "bni",
  ],

  cimb: [
    "cimb",
    "octo",
  ],

  permata: [
    "permata",
  ],

  jago: [
    "jago",
    "bank jago",
  ],
};

export function findWallet(
  text: string,
  context: ParserContext
) {
  const input = text.toLowerCase();

  const matches: WalletMatch[] = [];

  for (const wallet of context.wallets) {
    const walletName =
      wallet.name.toLowerCase();

    const walletBank =
      wallet.bank?.toLowerCase() ?? "";

    const walletTerms =
      `${walletName} ${walletBank}`;

    let score = 0;

    if (input.includes(walletName)) {
      score += 100;
    }

    for (const aliases of Object.values(ALIASES)) {
      for (const alias of aliases) {
        if (
          walletTerms.includes(alias) &&
          input.includes(alias)
        ) {
          score += 50;
        }
      }
    }

    if (
      walletName.includes("credit") ||
      walletName.includes("cc")
    ) {
      if (
        input.includes("cc") ||
        input.includes("credit") ||
        input.includes("visa") ||
        input.includes("master")
      ) {
        score += 50;
      }
    }

    if (score > 0) {
      matches.push({
        id: wallet.id,
        name: wallet.name,
        score,
      });
    }
  }

  matches.sort(
    (a, b) => b.score - a.score
  );

  return matches[0];
}
