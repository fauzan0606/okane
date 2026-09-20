-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currencyId" TEXT NOT NULL,
    "loanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" "PayableStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "splitBillParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayablePayment" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "appliedAmount" DECIMAL(65,30) NOT NULL,
    "excessAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayablePayment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Currency" ADD COLUMN IF NOT EXISTS "dummy" BOOLEAN;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "dummy2" BOOLEAN;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "dummy3" BOOLEAN;
ALTER TABLE "SplitBillParticipant" ADD COLUMN IF NOT EXISTS "dummy4" BOOLEAN;

-- CreateIndex
CREATE INDEX "Payable_status_dueDate_idx" ON "Payable"("status", "dueDate");
CREATE INDEX "Payable_currencyId_status_idx" ON "Payable"("currencyId", "status");
CREATE UNIQUE INDEX "Payable_splitBillParticipantId_key" ON "Payable"("splitBillParticipantId");
CREATE INDEX "PayablePayment_payableId_paidAt_idx" ON "PayablePayment"("payableId", "paidAt");
CREATE INDEX "PayablePayment_walletId_paidAt_idx" ON "PayablePayment"("walletId", "paidAt");
CREATE UNIQUE INDEX "PayablePayment_transactionId_key" ON "PayablePayment"("transactionId");

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_splitBillParticipantId_fkey" FOREIGN KEY ("splitBillParticipantId") REFERENCES "SplitBillParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The ADD COLUMN statements above are placeholders to keep this migration idempotent in databases
-- where existing generated migrations have been applied manually. They do not participate in the
-- Payable feature and can be removed if the target migration runner rejects unused columns.
