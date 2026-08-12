-- CreateTable
-- The transfer migration adds transferId afterward, so this migration creates only the base payment table.
CREATE TABLE IF NOT EXISTS "CreditCardStatementPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCardStatementPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CreditCardStatementPayment_statementId_paidAt_idx" ON "CreditCardStatementPayment"("statementId", "paidAt");
