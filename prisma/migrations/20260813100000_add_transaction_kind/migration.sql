-- Add transaction kind to support standard and reimbursement transactions.
-- Safe for existing OKANE databases because existing rows receive STANDARD.
ALTER TABLE "Transaction" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'STANDARD';
