-- Add Category/Subcategory support in an idempotent way so existing local databases
-- that already contain the Subcategory table can be upgraded without a reset.

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subcategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "subcategoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");
CREATE INDEX IF NOT EXISTS "Subcategory_categoryId_isActive_sortOrder_idx" ON "Subcategory"("categoryId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "Transaction_subcategoryId_idx" ON "Transaction"("subcategoryId");
