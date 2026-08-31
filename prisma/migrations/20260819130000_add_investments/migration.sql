CREATE TABLE "InvestmentProvider" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "InvestmentProvider_name_countryCode_key" ON "InvestmentProvider"("name", "countryCode");

CREATE TABLE "InvestmentAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "currencyId" TEXT NOT NULL,
  "accountNumberMasked" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvestmentAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "InvestmentProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvestmentAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InvestmentAccount_providerId_isActive_idx" ON "InvestmentAccount"("providerId", "isActive");

CREATE TABLE "InvestmentCashAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "balance" DECIMAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvestmentCashAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvestmentCashAccount_accountId_key" ON "InvestmentCashAccount"("accountId");

CREATE TABLE "InvestmentAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "symbol" TEXT,
  "name" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "countryCode" TEXT,
  "currencyId" TEXT NOT NULL,
  "unitName" TEXT NOT NULL,
  "purity" DECIMAL,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvestmentAsset_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InvestmentAsset_symbol_idx" ON "InvestmentAsset"("symbol");
CREATE INDEX "InvestmentAsset_assetType_countryCode_idx" ON "InvestmentAsset"("assetType", "countryCode");

CREATE TABLE "InvestmentHolding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "quantity" DECIMAL NOT NULL DEFAULT 0,
  "costBasis" DECIMAL NOT NULL DEFAULT 0,
  "currentPrice" DECIMAL,
  "priceAsOf" DATETIME,
  CONSTRAINT "InvestmentHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvestmentHolding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InvestmentAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvestmentHolding_accountId_assetId_key" ON "InvestmentHolding"("accountId", "assetId");
CREATE INDEX "InvestmentHolding_assetId_idx" ON "InvestmentHolding"("assetId");

CREATE TABLE "InvestmentTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "holdingId" TEXT,
  "transactionType" TEXT NOT NULL,
  "transactionDate" DATETIME NOT NULL,
  "quantity" DECIMAL NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL NOT NULL DEFAULT 0,
  "feeAmount" DECIMAL NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL NOT NULL DEFAULT 0,
  "otherCharges" DECIMAL NOT NULL DEFAULT 0,
  "totalCashAmount" DECIMAL NOT NULL DEFAULT 0,
  "netCashAmount" DECIMAL NOT NULL DEFAULT 0,
  "costBasisAmount" DECIMAL NOT NULL DEFAULT 0,
  "realizedGainLoss" DECIMAL,
  "fundingCashAccountId" TEXT,
  "fundingWalletId" TEXT,
  "currencyId" TEXT NOT NULL,
  "note" TEXT,
  "feeRuleSnapshot" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTUAL',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvestmentTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InvestmentAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvestmentTransaction_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "InvestmentHolding" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InvestmentTransaction_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InvestmentTransaction_fundingWalletId_fkey" FOREIGN KEY ("fundingWalletId") REFERENCES "Wallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InvestmentTransaction_fundingCashAccountId_fkey" FOREIGN KEY ("fundingCashAccountId") REFERENCES "InvestmentCashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "InvestmentTransaction_accountId_transactionDate_idx" ON "InvestmentTransaction"("accountId", "transactionDate");
CREATE INDEX "InvestmentTransaction_assetId_transactionDate_idx" ON "InvestmentTransaction"("assetId", "transactionDate");
CREATE INDEX "InvestmentTransaction_transactionType_transactionDate_idx" ON "InvestmentTransaction"("transactionType", "transactionDate");

CREATE TABLE "InvestmentCashMovement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cashAccountId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "movementDate" DATETIME NOT NULL,
  "sourceWalletId" TEXT,
  "investmentTransactionId" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestmentCashMovement_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "InvestmentCashAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvestmentCashMovement_sourceWalletId_fkey" FOREIGN KEY ("sourceWalletId") REFERENCES "Wallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InvestmentCashMovement_investmentTransactionId_fkey" FOREIGN KEY ("investmentTransactionId") REFERENCES "InvestmentTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "InvestmentCashMovement_cashAccountId_movementDate_idx" ON "InvestmentCashMovement"("cashAccountId", "movementDate");

CREATE TABLE "InvestmentFeeRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL,
  "feeRate" DECIMAL NOT NULL DEFAULT 0,
  "taxRate" DECIMAL NOT NULL DEFAULT 0,
  "fixedFee" DECIMAL NOT NULL DEFAULT 0,
  "effectiveFrom" DATETIME NOT NULL,
  "effectiveTo" DATETIME,
  "sourceUrl" TEXT,
  "sourceLabel" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InvestmentFeeRule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "InvestmentProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InvestmentFeeRule_providerId_assetType_transactionType_effectiveFrom_idx" ON "InvestmentFeeRule"("providerId", "assetType", "transactionType", "effectiveFrom");
