"use client";

import { useEffect } from "react";

const DUPLICATE_LABEL = "TRANSACTIONS RDN BALANCE";

function removeDuplicateBalance() {
  const labels = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
    (element) => element.children.length === 0 &&
      element.textContent?.trim().toUpperCase() === DUPLICATE_LABEL
  );

  labels.forEach((label) => {
    let node: HTMLElement | null = label.parentElement;

    // The duplicate is the compact balance pill/card below the transaction
    // header. Remove only a bounded rounded container, never the main header.
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      const className = typeof node.className === "string" ? node.className : "";

      if (
        rect.width > 0 &&
        rect.width < 900 &&
        rect.height > 0 &&
        rect.height < 160 &&
        /(rounded|border|bg-)/.test(className)
      ) {
        node.remove();
        return;
      }

      node = node.parentElement;
    }

    // Safe fallback: hide the immediate duplicate wrapper.
    label.parentElement?.remove();
  });
}

export default function InvestmentRdnBalanceCleanup() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(removeDuplicateBalance);
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
