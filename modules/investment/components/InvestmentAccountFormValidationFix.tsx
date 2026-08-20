"use client";

import { PropsWithChildren, useEffect } from "react";

export default function InvestmentAccountFormValidationFix({ children }: PropsWithChildren) {
  useEffect(() => {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form"));
    forms.forEach(form => {
      form.noValidate = true;
    });
  }, []);

  return <>{children}</>;
}
