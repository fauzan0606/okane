-- Set consistent icon/color defaults for the canonical category taxonomy.
UPDATE "Category" SET "color" = '#22C55E', "icon" = '🍽️' WHERE "name" = 'Food & Dining' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#8B5CF6', "icon" = '🛍️' WHERE "name" = 'Shopping' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#3B82F6', "icon" = '🚗' WHERE "name" = 'Transportation' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#F59E0B', "icon" = '🏠' WHERE "name" = 'Housing' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#EF4444', "icon" = '❤️' WHERE "name" = 'Health & Wellness' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#EC4899', "icon" = '🎬' WHERE "name" = 'Entertainment' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#06B6D4', "icon" = '✈️' WHERE "name" = 'Travel' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#F97316', "icon" = '💳' WHERE "name" = 'Finance & Fees' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#14B8A6', "icon" = '👨‍👩‍👧‍👦' WHERE "name" = 'Family & Education' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#64748B', "icon" = '🛡️' WHERE "name" = 'Insurance & Protection' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#94A3B8', "icon" = '📦' WHERE "name" = 'Other' AND "type" = 'EXPENSE';
UPDATE "Category" SET "color" = '#10B981', "icon" = '💼' WHERE "name" = 'Employment' AND "type" = 'INCOME';
UPDATE "Category" SET "color" = '#06B6D4', "icon" = '🚀' WHERE "name" = 'Business & Side Income' AND "type" = 'INCOME';
UPDATE "Category" SET "color" = '#A855F7', "icon" = '📈' WHERE "name" = 'Investment' AND "type" = 'INCOME';
UPDATE "Category" SET "color" = '#14B8A6', "icon" = '✨' WHERE "name" = 'Other Income' AND "type" = 'INCOME';
