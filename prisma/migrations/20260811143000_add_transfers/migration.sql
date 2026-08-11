-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferDate" DATETIME NOT NULL,
    "fromWalletId" TEXT NOT NULL,
    "toWalletId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "feeAmount" DECIMAL NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "feeTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transfer_fromWalletId_fkey" FOREIGN KEY ("fromWalletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_toWalletId_fkey" FOREIGN KEY ("toWalletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_feeTransactionId_fkey" FOREIGN KEY ("feeTransactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "CreditCardStatementPayment" ADD COLUMN "transferId" TEXT REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_feeTransactionId_key" ON "Transfer"("feeTransactionId");
CREATE UNIQUE INDEX "CreditCardStatementPayment_transferId_key" ON "CreditCardStatementPayment"("transferId");
CREATE INDEX "Transfer_transferDate_idx" ON "Transfer"("transferDate");
CREATE INDEX "Transfer_fromWalletId_transferDate_idx" ON "Transfer"("fromWalletId", "transferDate");
CREATE INDEX "Transfer_toWalletId_transferDate_idx" ON "Transfer"("toWalletId", "transferDate");
CREATE INDEX "Transfer_origin_transferDate_idx" ON "Transfer"("origin", "transferDate");
