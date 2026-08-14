-- Hidden wallet used only as a temporary destination for imported transactions
-- whose source METHOD/wallet could not be mapped yet. It is inactive and must
-- never contribute to wallet balances.
INSERT INTO "Wallet" (
  "id", "name", "walletType", "currencyId", "currentBalance", "bank", "color", "icon", "note", "sortOrder", "isActive", "createdAt", "updatedAt", "balanceAsOf"
)
SELECT
  'f58e8f7e-1e6c-4f87-9b6e-8d3ce9b1a4f2',
  'Unassigned (Review)',
  'CASH',
  c."id",
  0,
  NULL,
  '#64748B',
  '⚠️',
  'SYSTEM_IMPORT_REVIEW_WALLET',
  9999,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM "Currency" c
WHERE c."code" = 'IDR'
  AND NOT EXISTS (
    SELECT 1 FROM "Wallet" WHERE "note" = 'SYSTEM_IMPORT_REVIEW_WALLET'
  );
