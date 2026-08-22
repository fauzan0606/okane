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

export default function InvestmentAccountFormValidationFix({ children }: PropsWithChildren) {
  useEffect(() => {
    // Investment account website accepts bare domains such as indopremier.com.
    // Safari's native URL constraint validation rejects those values. The account
    // form can also be mounted after the first render, so a one-time query is not
    // sufficient; normalize newly inserted forms/inputs as well.
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

    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, []);

  return <>{children}</>;
}
