PRAGMA foreign_keys=OFF;

ALTER TABLE "Budget" ADD COLUMN "totalAmount" DECIMAL;

CREATE TABLE "new_BudgetItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "budgetId" TEXT NOT NULL,
  "categoryId" TEXT,
  "subcategoryId" TEXT,
  "amount" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BudgetItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BudgetItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_BudgetItem" ("id", "budgetId", "categoryId", "subcategoryId", "amount", "createdAt", "updatedAt")
SELECT "id", "budgetId", "categoryId", "subcategoryId", "amount", "createdAt", "updatedAt" FROM "BudgetItem";

DROP TABLE "BudgetItem";
ALTER TABLE "new_BudgetItem" RENAME TO "BudgetItem";

CREATE INDEX "BudgetItem_budgetId_categoryId_idx" ON "BudgetItem"("budgetId", "categoryId");
CREATE INDEX "BudgetItem_budgetId_subcategoryId_idx" ON "BudgetItem"("budgetId", "subcategoryId");

PRAGMA foreign_keys=ON;
