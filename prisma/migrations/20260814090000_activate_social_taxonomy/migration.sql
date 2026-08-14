-- Ensure the canonical Social expense category and its standard subcategories are active.
-- Safe for existing databases: reuses an existing Social category when present.

UPDATE "Category"
SET
  "isActive" = 1,
  "isSystem" = 1,
  "icon" = '🤝',
  "color" = '#F43F5E'
WHERE "name" = 'Social'
  AND "type" = 'EXPENSE';

INSERT INTO "Category" (
  "id", "name", "type", "icon", "color", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01',
  'Social',
  'EXPENSE',
  '🤝',
  '#F43F5E',
  1,
  9,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE'
);

INSERT INTO "Subcategory" (
  "id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  '3a9c2f81-7d4e-4e34-9c2b-6a1f5d8b2e03',
  c."id",
  'Tips & Tipping',
  1,
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."name" = 'Social'
  AND c."type" = 'EXPENSE'
  AND NOT EXISTS (
    SELECT 1 FROM "Subcategory" s
    WHERE s."categoryId" = c."id"
      AND s."name" = 'Tips & Tipping'
  );

INSERT INTO "Subcategory" (
  "id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  '7dcf7a2e-1d7a-4b2b-8d84-09ce2bb7d5c1',
  c."id",
  'Social Activities',
  1,
  1,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."name" = 'Social'
  AND c."type" = 'EXPENSE'
  AND NOT EXISTS (
    SELECT 1 FROM "Subcategory" s
    WHERE s."categoryId" = c."id"
      AND s."name" = 'Social Activities'
  );

INSERT INTO "Subcategory" (
  "id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  '2b6f3e91-9af7-41cb-8b21-1f23e4728d0a',
  c."id",
  'Gifts & Celebrations',
  1,
  2,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category" c
WHERE c."name" = 'Social'
  AND c."type" = 'EXPENSE'
  AND NOT EXISTS (
    SELECT 1 FROM "Subcategory" s
    WHERE s."categoryId" = c."id"
      AND s."name" = 'Gifts & Celebrations'
  );

UPDATE "Subcategory"
SET "isActive" = 1, "isSystem" = 1
WHERE "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE' LIMIT 1)
  AND "name" IN ('Tips & Tipping', 'Social Activities', 'Gifts & Celebrations');
