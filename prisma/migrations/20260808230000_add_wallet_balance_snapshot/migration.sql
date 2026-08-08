-- Add a snapshot timestamp for the manually confirmed wallet balance.
ALTER TABLE "Wallet" ADD COLUMN "balanceAsOf" DATETIME;

-- Existing balances are treated as the known current balance at migration time.
UPDATE "Wallet"
SET "balanceAsOf" = CURRENT_TIMESTAMP
WHERE "balanceAsOf" IS NULL;
