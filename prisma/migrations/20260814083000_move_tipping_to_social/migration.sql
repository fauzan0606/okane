-- Move tipping from Transportation into Social without deleting historical references.

INSERT INTO "Category" ("id", "name", "type", "icon", "color", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01', 'Social', 'EXPENSE', '🤝', '#F43F5E', 1, 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" WHERE "name" = 'Social' AND "type" = 'EXPENSE'
);

INSERT INTO "Subcategory" ("id", "categoryId", "name", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT '3a9c2f81-7d4e-4e34-9c2b-6a1f5d8b2e03',
       '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01',
       'Tips & Tipping', 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Subcategory" WHERE "categoryId" = '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01' AND "name" = 'Tips & Tipping'
);

UPDATE "Transaction"
SET "categoryId" = '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01',
    "subcategoryId" = '3a9c2f81-7d4e-4e34-9c2b-6a1f5d8b2e03'
WHERE "subcategoryId" = (
  SELECT "id" FROM "Subcategory" WHERE "name" = 'Tips & Tipping' AND "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Transportation' AND "type" = 'EXPENSE')
);

UPDATE "BudgetItem"
SET "categoryId" = '9f0b5f24-4f1a-4b5a-9e4e-2f9d1e8c7a01',
    "subcategoryId" = '3a9c2f81-7d4e-4e34-9c2b-6a1f5d8b2e03'
WHERE "subcategoryId" = (
  SELECT "id" FROM "Subcategory" WHERE "name" = 'Tips & Tipping' AND "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Transportation' AND "type" = 'EXPENSE')
);

UPDATE "Subcategory"
SET "isActive" = 0
WHERE "name" = 'Tips & Tipping'
  AND "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Transportation' AND "type" = 'EXPENSE');
