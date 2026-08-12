-- Normalize the category taxonomy to the canonical OKANE structure.
-- Existing transactions are preserved: legacy categories are remapped where the intent is clear,
-- then legacy category/subcategory rows are marked inactive rather than deleted.

-- Ensure canonical expense categories exist.
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Food & Dining', 'EXPENSE', true, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Food & Dining' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Housing', 'EXPENSE', true, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Housing' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Transportation', 'EXPENSE', true, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Transportation' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Shopping', 'EXPENSE', true, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Shopping' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Health & Wellness', 'EXPENSE', true, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Health & Wellness' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Entertainment', 'EXPENSE', true, 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Entertainment' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Travel', 'EXPENSE', true, 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Travel' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Finance & Fees', 'EXPENSE', true, 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Finance & Fees' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Family & Education', 'EXPENSE', true, 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Family & Education' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Insurance & Protection', 'EXPENSE', true, 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Insurance & Protection' AND "type" = 'EXPENSE');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Other', 'EXPENSE', true, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Other' AND "type" = 'EXPENSE');

-- Ensure canonical income categories exist.
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Employment', 'INCOME', true, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Employment' AND "type" = 'INCOME');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Business & Side Income', 'INCOME', true, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Business & Side Income' AND "type" = 'INCOME');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Investment', 'INCOME', true, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Investment' AND "type" = 'INCOME');
INSERT INTO "Category" ("id", "name", "type", "isSystem", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), 'Other Income', 'INCOME', true, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Other Income' AND "type" = 'INCOME');

-- Remap legacy category names whose meaning is unambiguous.
UPDATE "Transaction" SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name"='Food & Dining' AND "type"='EXPENSE' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Food & Drinks' AND "type"='EXPENSE');
UPDATE "Transaction" SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name"='Transportation' AND "type"='EXPENSE' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Transport' AND "type"='EXPENSE');
UPDATE "Transaction" SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name"='Housing' AND "type"='EXPENSE' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Bills & Utilities' AND "type"='EXPENSE');
UPDATE "Transaction" SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name"='Family & Education' AND "type"='EXPENSE' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Family' AND "type"='EXPENSE');
UPDATE "Transaction" SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name"='Insurance & Protection' AND "type"='EXPENSE' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Insurance' AND "type"='EXPENSE');

-- Move legacy Insurance subcategory from Other into Insurance & Protection where applicable.
UPDATE "Transaction"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name"='Insurance & Protection' AND "type"='EXPENSE' LIMIT 1)
WHERE "subcategoryId" IN (
  SELECT s."id" FROM "Subcategory" s JOIN "Category" c ON c."id"=s."categoryId"
  WHERE s."name"='Insurance' AND c."name"='Other' AND c."type"='EXPENSE'
);

-- Rename canonical subcategories that were simplified in the final taxonomy.
UPDATE "Subcategory" SET "name"='Maintenance & Repairs'
WHERE "name"='Maintenance' AND "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Housing' AND "type"='EXPENSE');
UPDATE "Subcategory" SET "name"='Family Support'
WHERE "name"='Family' AND "categoryId" IN (SELECT "id" FROM "Category" WHERE "name"='Family & Education' AND "type"='EXPENSE');

-- Mark every non-canonical category inactive. Historical transactions remain intact.
UPDATE "Category" SET "isActive"=false
WHERE "type"='EXPENSE' AND "name" NOT IN ('Food & Dining','Housing','Transportation','Shopping','Health & Wellness','Entertainment','Travel','Finance & Fees','Family & Education','Insurance & Protection','Other');
UPDATE "Category" SET "isActive"=false
WHERE "type"='INCOME' AND "name" NOT IN ('Employment','Business & Side Income','Investment','Other Income');

-- Mark non-canonical subcategories inactive. We do not delete them because historical transactions may reference them.
UPDATE "Subcategory" SET "isActive"=false
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "type"='EXPENSE' AND "name"='Food & Dining')
  AND "name" NOT IN ('Groceries','Restaurants','Coffee & Drinks','Delivery & Takeaway','Snacks & Desserts');
UPDATE "Subcategory" SET "isActive"=false
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "type"='EXPENSE' AND "name"='Housing')
  AND "name" NOT IN ('Rent / Mortgage','Utilities','Household','Maintenance & Repairs');
UPDATE "Subcategory" SET "isActive"=false
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "type"='EXPENSE' AND "name"='Transportation')
  AND "name" NOT IN ('Fuel','Public Transportation','Taxi / Ride-hailing','Parking','Toll','Vehicle Maintenance');

-- Ensure the additional final-taxonomy subcategories exist via the seed on fresh databases;
-- this migration only normalizes existing records and preserves their IDs/history.
