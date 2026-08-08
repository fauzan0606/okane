import type { Token } from "./types";

export function tokenize(
  input: string
): Token[] {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({
      raw: token,
      normalized: token,
    }));
}