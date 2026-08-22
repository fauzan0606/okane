"use client";

import { PropsWithChildren, useEffect } from "react";

function normalizeInvestmentForms() {
  document.querySelectorAll<HTMLInputElement>('input[type="url"]').forEach((input) => {
    input.type = "text";
    input.removeAttribute("pattern");
  });

  document.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
    form.noValidate = true;
  });
}

function autoResolveTypedAsset(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) return;
  if (target.getAttribute("placeholder") !== "Asset / Stock (type to search)") return;

  const query = target.value.trim().toLowerCase();
  if (!query || query.includes(" · ")) return;

  window.setTimeout(() => {
    const container = target.parentElement;
    if (!container) return;

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
    const match = buttons.find((button) => {
      const primary = button.querySelector("span span")?.textContent?.trim().toLowerCase() ?? "";
      const label = button.textContent?.trim().toLowerCase() ?? "";
      return primary === query || label === query;
    });

    if (match) match.click();
  }, 0);
}

export default function InvestmentAccountFormValidationFix({ children }: PropsWithChildren) {
  useEffect(() => {
    normalizeInvestmentForms();

    const observer = new MutationObserver(() => {
      normalizeInvestmentForms();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "url") {
        target.type = "text";
        target.removeAttribute("pattern");
      }
      if (target instanceof HTMLInputElement) {
        target.form?.setAttribute("novalidate", "");
      }
    };

    const handleInput = (event: Event) => {
      autoResolveTypedAsset(event.target);
    };

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("input", handleInput, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("input", handleInput, true);
    };
  }, []);

  return <>{children}</>;
}
