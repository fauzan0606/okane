"use client";

import { useEffect } from "react";

const DUPLICATE_TEXT = "TRANSACTIONS RDN BALANCE";

function removeDuplicateBalance() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("div, section, aside, article"));

  for (const element of elements) {
    const text = (element.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
    if (!text.includes(DUPLICATE_TEXT)) continue;

    // Find the smallest visual container that still contains the duplicate
    // label. This avoids touching the main transaction header/card.
    let candidate: HTMLElement | null = element;
    const descendants = Array.from(element.querySelectorAll<HTMLElement>("div, section, aside, article"));
    for (const child of descendants) {
      const childText = (child.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
      if (childText.includes(DUPLICATE_TEXT)) candidate = child;
    }

    let node: HTMLElement | null = candidate;
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      const nodeText = (node.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();

      if (
        nodeText.includes(DUPLICATE_TEXT) &&
        rect.width > 0 &&
        rect.width < 900 &&
        rect.height > 0 &&
        rect.height < 180
      ) {
        node.style.setProperty("display", "none", "important");
        node.setAttribute("data-okane-duplicate-rdn-balance", "removed");
        break;
      }

      node = node.parentElement;
    }
  }
}

export default function InvestmentRdnBalanceCleanup() {
  useEffect(() => {
    const run = () => window.requestAnimationFrame(removeDuplicateBalance);

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
