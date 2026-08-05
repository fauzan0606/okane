-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "walletType" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "currentBalance" DECIMAL NOT NULL DEFAULT 0,
    "bank" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditCardProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "creditLimit" DECIMAL NOT NULL DEFAULT 0,
    "billingDate" INTEGER NOT NULL,
    "dueDate" INTEGER NOT NULL,
    "rewardProgram" TEXT,
    "rewardPoint" DECIMAL NOT NULL DEFAULT 0,
    "annualFee" DECIMAL,
    "annualFeeDate" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditCardProfile_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Wallet_currencyId_idx" ON "Wallet"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardProfile_walletId_key" ON "CreditCardProfile"("walletId");
