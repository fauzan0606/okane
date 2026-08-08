import type { ParserContext } from "./types";

type WalletMatch = {
  id: string;
  name: string;
  score: number;
};

const ALIASES: Record<string, string[]> = {
  cash: ["cash", "tunai", "uang", "kontan"],
  gopay: ["gopay", "go-pay", "go pay"],
  ovo: ["ovo"],
  dana: ["dana"],
  seabank: ["seabank", "sea"],
  bca: ["bca"],
  mandiri: ["mandiri"],
  bri: ["bri"],
  bni: ["bni"],
  cimb: ["cimb", "octo"],
  permata: ["permata"],
  jago: ["jago", "bank jago"],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsPhrase(input: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);

  if (!normalizedPhrase) {
    return false;
  }

  return ` ${input} `.includes(` ${normalizedPhrase} `);
}

export function findWallet(text: string, context: ParserContext) {
  const input = normalize(text);
  const matches: WalletMatch[] = [];

  for (const wallet of context.wallets) {
    const walletName = normalize(wallet.name);
    const walletBank = normalize(wallet.bank ?? "");
    const walletTerms = `${walletName} ${walletBank}`.trim();

    let score = 0;

    // An exact wallet name is the strongest signal. This prevents a wallet
    // named "BCA" from winning merely because "bca" appears inside
    // "CC BCA Krisflyer".
    if (containsPhrase(input, walletName)) {
      score += 1000 + walletName.split(" ").length * 25;
    }

    // Bank names / aliases are useful, but deliberately weaker than an
    // explicit wallet-name phrase.
    for (const aliases of Object.values(ALIASES)) {
      for (const alias of aliases) {
        if (containsPhrase(walletTerms, alias) && containsPhrase(input, alias)) {
          score += 50;
        }
      }
    }

    // Explicit credit-card wording should strongly favor credit-card wallets
    // when the user actually says "cc", "credit", "visa", or "master".
    const isCreditWallet =
      walletName.includes("credit") ||
      walletName.includes("cc") ||
      walletName.includes("visa") ||
      walletName.includes("master");

    if (isCreditWallet) {
      if (containsPhrase(input, "cc")) score += 200;
      if (containsPhrase(input, "credit")) score += 200;
      if (containsPhrase(input, "visa")) score += 200;
      if (containsPhrase(input, "master")) score += 200;
    }

    if (score > 0) {
      matches.push({
        id: wallet.id,
        name: wallet.name,
        score,
      });
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // Prefer the more specific wallet name when scores tie.
    return b.name.length - a.name.length;
  });

  return matches[0];
}
