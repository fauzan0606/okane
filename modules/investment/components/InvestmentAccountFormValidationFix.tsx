"use client";

import { PropsWithChildren, useEffect } from "react";

export default function InvestmentAccountFormValidationFix({ children }: PropsWithChildren) {
  useEffect(() => {
    // The account form intentionally accepts both bare domains (e.g. indopremier.com)
    // and full URLs. Native input[type="url"] rejects bare domains in Safari, so use
    // text input here and leave URL handling to the application/backend.
    document.querySelectorAll<HTMLInputElement>('input[type="url"]').forEach((input) => {
      input.type = "text";
      input.removeAttribute("pattern");
    });

    document.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
      form.noValidate = true;
    });
  }, []);

  return <>{children}</>;
}
