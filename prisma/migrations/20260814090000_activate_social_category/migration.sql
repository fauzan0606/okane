-- Ensure the canonical Social expense category and its subcategories are active.
-- Idempotent and safe for existing data.

UPDATE "Category"
SET
  "isActive" = 1,
  "isSystem" = 1,
  "icon" = '🤝',
  "color" = '#F43F5E'
WHERE "name" = 'Social'
  AND "type" = 'EXPENSE';

UPDATE "Subcategory"
SET "isActive" = 1, "isSystem" = 1
WHERE "categoryId" = (
  SELECT "id"
  FROM "Category"
  WHERE "name" = 'Social'
    AND "type" = 'EXPENSE'
  LIMIT 1
)
AND "name" IN ('Tips & Tipping', 'Social Activities', 'Gifts & Celebrations');
