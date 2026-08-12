-- Reconcile feature tables that already exist in older OKANE databases
-- but were missing from the committed Prisma migration history.
-- IF NOT EXISTS keeps this safe for existing local databases while allowing
-- a fresh database to be built from the migration chain.

CREATE TABLE IF NOT EXISTS "InstallmentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "feeAmount" DECIMAL NOT NULL DEFAULT 0,
    "installmentAmount" DECIMAL NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SplitBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantName" TEXT NOT NULL,
    "transactionId" TEXT,
    "totalAmount" DECIMAL NOT NULL,
    "personalAmount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SplitBillParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "splitBillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isMe" BOOLEAN NOT NULL DEFAULT false,
    "shareAmount" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("splitBillId") REFERENCES "SplitBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SplitBillItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "splitBillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL,
    "splitMethod" TEXT NOT NULL DEFAULT 'EQUAL',
    FOREIGN KEY ("splitBillId") REFERENCES "SplitBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SplitBillItemAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "units" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    FOREIGN KEY ("participantId") REFERENCES "SplitBillParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("itemId") REFERENCES "SplitBillItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Receivable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "receivedAmount" DECIMAL NOT NULL DEFAULT 0,
    "currencyId" TEXT NOT NULL,
    "sourceWalletId" TEXT,
    "loanDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
    "sourceTransactionId" TEXT,
    "splitBillParticipantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("splitBillParticipantId") REFERENCES "SplitBillParticipant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("sourceWalletId") REFERENCES "Wallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ReceivablePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "note" TEXT,
    FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("receivableId") REFERENCES "Receivable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "InstallmentPlan_startDate_status_idx" ON "InstallmentPlan"("startDate", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "InstallmentPlan_transactionId_key" ON "InstallmentPlan"("transactionId");

CREATE INDEX IF NOT EXISTS "Receivable_sourceWalletId_status_idx" ON "Receivable"("sourceWalletId", "status");
CREATE INDEX IF NOT EXISTS "Receivable_currencyId_status_idx" ON "Receivable"("currencyId", "status");
CREATE INDEX IF NOT EXISTS "Receivable_status_dueDate_idx" ON "Receivable"("status", "dueDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Receivable_splitBillParticipantId_key" ON "Receivable"("splitBillParticipantId");

CREATE INDEX IF NOT EXISTS "ReceivablePayment_receivableId_receivedAt_idx" ON "ReceivablePayment"("receivableId", "receivedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReceivablePayment_transactionId_key" ON "ReceivablePayment"("transactionId");

CREATE INDEX IF NOT EXISTS "SplitBill_status_createdAt_idx" ON "SplitBill"("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SplitBill_transactionId_key" ON "SplitBill"("transactionId");
CREATE INDEX IF NOT EXISTS "SplitBillItem_splitBillId_idx" ON "SplitBillItem"("splitBillId");
CREATE UNIQUE INDEX IF NOT EXISTS "SplitBillItemAllocation_itemId_participantId_key" ON "SplitBillItemAllocation"("itemId", "participantId");
CREATE INDEX IF NOT EXISTS "SplitBillItemAllocation_participantId_idx" ON "SplitBillItemAllocation"("participantId");
CREATE INDEX IF NOT EXISTS "SplitBillParticipant_splitBillId_isMe_idx" ON "SplitBillParticipant"("splitBillId", "isMe");
