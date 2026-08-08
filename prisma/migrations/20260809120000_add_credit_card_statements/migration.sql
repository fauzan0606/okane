-- CreateTable
CREATE TABLE "CreditCardStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditCardId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "statementDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "calculatedAmount" DECIMAL NOT NULL DEFAULT 0,
    "actualAmount" DECIMAL,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "paymentTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCardStatement_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCardProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardStatement_creditCardId_periodStart_periodEnd_key" ON "CreditCardStatement"("creditCardId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CreditCardStatement_creditCardId_dueDate_idx" ON "CreditCardStatement"("creditCardId", "dueDate");
