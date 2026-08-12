-- Merge the legacy "Food & Drinks" category into the canonical "Food & Dining" category.
-- The legacy category may exist in older databases, but is not created by the current seed.
-- Keep the legacy row inactive so existing foreign keys and historical data remain safe.

UPDATE "Transaction"
SET "categoryId" = (
  SELECT target."id"
  FROM "Category" AS target
  WHERE target."name" = 'Food & Dining'
    AND target."type" = 'EXPENSE'
  LIMIT 1
)
WHERE "categoryId" = (
  SELECT legacy."id"
  FROM "Category" AS legacy
  WHERE legacy."name" = 'Food & Drinks'
    AND legacy."type" = 'EXPENSE'
  LIMIT 1
)
AND EXISTS (
  SELECT 1
  FROM "Category" AS target
  WHERE target."name" = 'Food & Dining'
    AND target."type" = 'EXPENSE'
);

UPDATE "Category"
SET "isActive" = false,
    "isSystem" = true
WHERE "name" = 'Food & Drinks'
  AND "type" = 'EXPENSE';
