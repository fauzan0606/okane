-- Move tipping from Transportation into Social without deleting historical references.

-- Create the destination category first.
INSERT INTO "Category" ("id", "name", "type", "icon", "color", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01', 'Social', 'EXPENSE', '🤝', '#F43F5E', 1, 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE'
);

-- Reuse the existing Social category ID when it already exists.
INSERT INTO "Subcategory" ("id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT '3a9c2f81-7d4e-4e34-9c2b-6a1f5d8b2e03',
       (SELECT "id" FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE' LIMIT 1),
       'Tips & Tipping', 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Subcategory" s
  JOIN "Category" c ON c."id" = s."categoryId"
  WHERE c."name" = 'Social' AND c."type" = 'EXPENSE' AND s."name" = 'Tips & Tipping'
);

-- Update dependent rows before changing/removing any category references.
UPDATE "Transaction"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE' LIMIT 1),
    "subcategoryId" = (SELECT s."id" FROM "Subcategory" s JOIN "Category" c ON c."id" = s."categoryId" WHERE c."name" = 'Social' AND c."type" = 'EXPENSE' AND s."name" = 'Tips & Tipping' LIMIT 1)
WHERE "subcategoryId" = (
  SELECT s."id"
  FROM "Subcategory" s
  JOIN "Category" c ON c."id" = s."categoryId"
  WHERE s."name" = 'Tips & Tipping' AND c."name" = 'Transportation' AND c."type" = 'EXPENSE'
  LIMIT 1
);

UPDATE "BudgetItem"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE' LIMIT 1),
    "subcategoryId" = (SELECT s."id" FROM "Subcategory" s JOIN "Category" c ON c."id" = s."categoryId" WHERE c."name" = 'Social' AND c."type" = 'EXPENSE' AND s."name" = 'Tips & Tipping' LIMIT 1)
WHERE "subcategoryId" = (
  SELECT s."id"
  FROM "Subcategory" s
  JOIN "Category" c ON c."id" = s."categoryId"
  WHERE s."name" = 'Tips & Tipping' AND c."name" = 'Transportation' AND c."type" = 'EXPENSE'
  LIMIT 1
);

-- Deactivate the old subcategory only after all dependent rows have been moved.
UPDATE "Subcategory"
SET "isActive" = 0
WHERE "name" = 'Tips & Tipping'
  AND "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Transportation' AND "type" = 'EXPENSE' LIMIT 1);
