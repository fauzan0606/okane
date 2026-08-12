-- CreateTable
-- This table is referenced by the transfer migration. IF NOT EXISTS keeps this migration safe for databases where the table was already created outside the migration chain.
CREATE TABLE IF NOT EXISTS "CreditCardStatementPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paidAt" DATETIME NOT NULL,
    "note" TEXT,
    "transferId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCardStatementPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CreditCardStatementPayment_transferId_key" ON "CreditCardStatementPayment"("transferId");
CREATE INDEX IF NOT EXISTS "CreditCardStatementPayment_statementId_paidAt_idx" ON "CreditCardStatementPayment"("statementId", "paidAt");
