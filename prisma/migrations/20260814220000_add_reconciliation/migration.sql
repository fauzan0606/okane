CREATE TABLE "ReconciliationSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVIEWING',
  "fileName" TEXT NOT NULL,
  "periodStart" DATETIME,
  "periodEnd" DATETIME,
  "extractedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationSession_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ReconciliationRow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "sourceSide" TEXT NOT NULL,
  "sourceRowNumber" INTEGER,
  "pageNumber" INTEGER,
  "transactionDate" DATETIME NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "direction" TEXT NOT NULL,
  "entryType" TEXT,
  "matchStatus" TEXT NOT NULL,
  "matchConfidence" INTEGER NOT NULL DEFAULT 0,
  "matchReason" TEXT,
  "matchedTransactionId" TEXT,
  "matchedTransferId" TEXT,
  "resolution" TEXT NOT NULL DEFAULT 'PENDING',
  "createdTransactionId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReconciliationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReconciliationSession_walletId_createdAt_idx" ON "ReconciliationSession"("walletId", "createdAt");
CREATE INDEX "ReconciliationRow_sessionId_matchStatus_idx" ON "ReconciliationRow"("sessionId", "matchStatus");
CREATE INDEX "ReconciliationRow_matchedTransactionId_idx" ON "ReconciliationRow"("matchedTransactionId");
CREATE INDEX "ReconciliationRow_matchedTransferId_idx" ON "ReconciliationRow"("matchedTransferId");
CREATE INDEX "ReconciliationRow_transactionDate_amount_idx" ON "ReconciliationRow"("transactionDate", "amount");
