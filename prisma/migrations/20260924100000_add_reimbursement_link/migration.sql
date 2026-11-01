-- Link reimbursement receipts to the original reimbursement expense.
ALTER TABLE "Transaction" ADD COLUMN "reimbursementSourceId" TEXT;
CREATE UNIQUE INDEX "Transaction_reimbursementSourceId_key" ON "Transaction"("reimbursementSourceId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reimbursementSourceId_fkey" FOREIGN KEY ("reimbursementSourceId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
