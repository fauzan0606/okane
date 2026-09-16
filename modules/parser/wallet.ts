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
  if (!normalizedPhrase) return false;
  return ` ${input} `.includes(` ${normalizedPhrase} `);
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function similarityScore(input: string, candidate: string): number {
  const inputTokens = tokenSet(input);
  const candidateTokens = tokenSet(candidate);
  if (!inputTokens.size || !candidateTokens.size) return 0;

  let shared = 0;
  for (const token of candidateTokens) {
    if (inputTokens.has(token)) shared += 1;
  }

  return Math.round((shared / candidateTokens.size) * 40);
}

export function findWallet(text: string, context: ParserContext) {
  const input = normalize(text);
  const matches: WalletMatch[] = [];

  const explicitCreditCard =
    containsPhrase(input, "cc") ||
    containsPhrase(input, "credit") ||
    containsPhrase(input, "credit card") ||
    containsPhrase(input, "visa") ||
    containsPhrase(input, "mastercard") ||
    containsPhrase(input, "master");

  for (const wallet of context.wallets) {
    const walletName = normalize(wallet.name);
    const walletBank = normalize(wallet.bank ?? "");
    const walletTerms = `${walletName} ${walletBank}`.trim();

    let score = 0;
    let matchedAlias = false;

    // Exact wallet-name match is the strongest signal.
    if (containsPhrase(input, walletName)) {
      score += 1000 + walletName.split(" ").length * 25;
    }

    // Bank/brand aliases support shorthand such as "bca" or "gopay" and
    // are case-insensitive because all matching uses normalized text.
    for (const aliases of Object.values(ALIASES)) {
      for (const alias of aliases) {
        if (containsPhrase(input, alias) && containsPhrase(walletTerms, alias)) {
          score += 120;
          matchedAlias = true;
        }
      }
    }

    // When there is no exact alias match, use token similarity so that small
    // naming differences still produce a candidate instead of no wallet.
    if (!score) {
      score += similarityScore(input, walletName);
      if (walletBank) {
        score += Math.round(similarityScore(input, walletBank) * 0.75);
      }
    }

    const isCreditWallet =
      walletName.includes("credit") ||
      walletName.includes("cc") ||
      walletName.includes("visa") ||
      walletName.includes("master") ||
      walletName.includes("mastercard");

    // Explicit credit-card wording should favor the matching CC wallet.
    if (isCreditWallet && explicitCreditCard) {
      score += 300;
    }

    // If the user only says "bca", prefer a simple BCA wallet over a sibling
    // such as "CC BCA". When the user writes "cc bca", the CC wallet gets the
    // explicit-credit bonus and wins instead.
    if (matchedAlias && !explicitCreditCard && isCreditWallet) {
      score -= 80;
    }

    if (score > 0) {
      matches.push({ id: wallet.id, name: wallet.name, score });
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.length - b.name.length;
  });

  return matches[0];
}
