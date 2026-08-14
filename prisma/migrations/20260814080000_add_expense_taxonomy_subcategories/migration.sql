-- Extend the canonical expense taxonomy for common real-world transactions.
-- Safe for existing databases: only inserts missing system subcategories.

INSERT INTO "Subcategory" (
  "id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))),
  c."id",
  'Tips & Tipping',
  1,
  7,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."name" = 'Transportation'
  AND c."type" = 'EXPENSE'
  AND NOT EXISTS (
    SELECT 1
    FROM "Subcategory" s
    WHERE s."categoryId" = c."id"
      AND s."name" = 'Tips & Tipping'
  );

INSERT INTO "Subcategory" (
  "id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))),
  c."id",
  'Digital Services & Subscriptions',
  1,
  2,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."name" = 'Other'
  AND c."type" = 'EXPENSE'
  AND NOT EXISTS (
    SELECT 1
    FROM "Subcategory" s
    WHERE s."categoryId" = c."id"
      AND s."name" = 'Digital Services & Subscriptions'
  );
