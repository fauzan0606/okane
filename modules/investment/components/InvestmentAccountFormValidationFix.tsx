"use client";

import { PropsWithChildren, useEffect } from "react";

export default function InvestmentAccountFormValidationFix({ children }: PropsWithChildren) {
  useEffect(() => {
    const providerInput = document.querySelector<HTMLInputElement>('input[placeholder="Provider e.g. IndoPremier"]');
    const form = providerInput?.closest("form");
    if (form) form.noValidate = true;
  }, []);

  return <>{children}</>;
}
