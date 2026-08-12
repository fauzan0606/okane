-- Consolidate the legacy "Transport" expense category into "Transportation".
-- Keep historical transactions intact while removing the duplicate category from active choices.

-- If only the legacy category exists, rename it in place.
UPDATE "Category"
SET "name" = 'Transportation',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Transport'
  AND "type" = 'EXPENSE'
  AND NOT EXISTS (
    SELECT 1
    FROM "Category"
    WHERE "name" = 'Transportation'
      AND "type" = 'EXPENSE'
  );

-- If both categories exist, move transactions to the canonical category.
UPDATE "Transaction"
SET "categoryId" = (
  SELECT "id"
  FROM "Category"
  WHERE "name" = 'Transportation'
    AND "type" = 'EXPENSE'
  LIMIT 1
)
WHERE "categoryId" = (
  SELECT "id"
  FROM "Category"
  WHERE "name" = 'Transport'
    AND "type" = 'EXPENSE'
  LIMIT 1
);

-- For subcategories with the same name under both categories, move their
-- historical transactions to the canonical subcategory first.
UPDATE "Transaction"
SET "subcategoryId" = (
  SELECT target."id"
  FROM "Subcategory" target
  JOIN "Subcategory" legacy
    ON target."name" = legacy."name"
  JOIN "Category" targetCategory
    ON targetCategory."id" = target."categoryId"
  JOIN "Category" legacyCategory
    ON legacyCategory."id" = legacy."categoryId"
  WHERE targetCategory."name" = 'Transportation'
    AND targetCategory."type" = 'EXPENSE'
    AND legacyCategory."name" = 'Transport'
    AND legacyCategory."type" = 'EXPENSE'
    AND legacy."id" = "Transaction"."subcategoryId"
  LIMIT 1
)
WHERE "subcategoryId" IN (
  SELECT legacy."id"
  FROM "Subcategory" legacy
  JOIN "Category" legacyCategory
    ON legacyCategory."id" = legacy."categoryId"
  WHERE legacyCategory."name" = 'Transport'
    AND legacyCategory."type" = 'EXPENSE'
    AND EXISTS (
      SELECT 1
      FROM "Subcategory" target
      JOIN "Category" targetCategory
        ON targetCategory."id" = target."categoryId"
      WHERE targetCategory."name" = 'Transportation'
        AND targetCategory."type" = 'EXPENSE'
        AND target."name" = legacy."name"
    )
);

-- Move non-conflicting legacy subcategories to the canonical category.
UPDATE "Subcategory"
SET "categoryId" = (
  SELECT "id"
  FROM "Category"
  WHERE "name" = 'Transportation'
    AND "type" = 'EXPENSE'
  LIMIT 1
),
"updatedAt" = CURRENT_TIMESTAMP
WHERE "categoryId" = (
  SELECT "id"
  FROM "Category"
  WHERE "name" = 'Transport'
    AND "type" = 'EXPENSE'
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM "Subcategory" target
  WHERE target."categoryId" = (
    SELECT "id"
    FROM "Category"
    WHERE "name" = 'Transportation'
      AND "type" = 'EXPENSE'
    LIMIT 1
  )
  AND target."name" = "Subcategory"."name"
);

-- Remove duplicate legacy subcategories after their transactions were remapped.
DELETE FROM "Subcategory"
WHERE "categoryId" = (
  SELECT "id"
  FROM "Category"
  WHERE "name" = 'Transport'
    AND "type" = 'EXPENSE'
  LIMIT 1
);

-- Retire the legacy category. It is intentionally not hard-deleted so that
-- any unexpected historical references remain recoverable.
UPDATE "Category"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Transport'
  AND "type" = 'EXPENSE';
