# OKANE Phase 2 — Investments

## Safety baseline

- Base branch: `feat/phase-1-transfer-v2`
- Phase 1 backup branch: `backup/phase-1-uat-complete-20260819`
- Feature branch: `feat/phase-2-investments`
- Phase 1 transfer, credit-card payment, split-bill and receivable logic is not modified by the Investment domain.

## Investment model

`InvestmentProvider` → optional `InvestmentCashAccount` → `InvestmentAccount` / portfolio → `InvestmentAsset` / holding.

Cash held by a provider (for example an IndoPremier RDN) is intentionally not created as a normal Wallet. A deposit from a normal Wallet into provider cash is recorded as an Investment Cash Movement and updates both balances atomically.

A provider can have:
- CASH account: RDN/provider cash
- PORTFOLIO account: securities holdings
- COMBINED account: providers where cash and holdings are managed together

## Supported asset types

- Stock
- Mutual fund
- ETF
- Bond
- Gold
- Other

Gold supports a unit such as `gram`, allowing physical and digital gold to share the same asset model while provider/account metadata identifies where it is held.

## Investment transactions

- BUY
- SELL
- DIVIDEND
- INTEREST
- COUPON
- Manual valuation update

Buy transactions include acquisition cost = gross + fee + tax + other charges. Sell transactions calculate net proceeds and realized P/L against proportional cost basis.

## Fee/tax rules

Rules are stored with effective dates and a source snapshot. The current official refresh implementation supports IndoPremier:
- broker stock buy fee parsed from the official manual
- broker stock sell fee parsed from the official manual
- Indonesian listed-stock sale PPh final 0.1% parsed from the official DJP source

If the official pages cannot be reached or safely parsed, the refresh operation fails without changing existing rules.

Historical transactions store their fee/tax snapshot, so later broker rule changes do not rewrite historical cost basis.

## Break-even definition

OKANE uses the stronger definition agreed for the product:

> Break-even selling price is the minimum sell price that produces Net Realized P/L = 0 after acquisition cost and all configured selling fees/taxes/other selling costs.

Formula:

`quantity × sellPrice - sellFee(sellPrice) - sellTax(sellPrice) - otherSellCosts = acquisitionCost`

## Local setup

Before changing the local database, make a local copy:

```bash
cp okane.db okane.db.backup-before-investment-$(date +%Y%m%d-%H%M%S)
```

Then:

```bash
git checkout feat/phase-2-investments
git pull origin feat/phase-2-investments
npm install
npx prisma generate
npx prisma migrate dev
npm run typecheck
npm run lint
npm run build
npm run dev
```

Open:

`http://localhost:3000/investments`

## Suggested first UAT fixture

1. Create provider: `TEST IndoPremier`
2. Create `Cash / RDN` account in IDR with cash account enabled.
3. Create `Portfolio` account in IDR.
4. Create asset `BBCA`, type `STOCK`, unit `share`.
5. Deposit Rp10,000,000 from BCA Wallet into RDN.
6. Buy 1,000 BBCA at Rp9,000 using RDN cash.
7. Verify BCA -Rp10,000,000; RDN -Rp9,000,000; holding cost basis includes fee/tax entered.
8. Update market price and verify unrealized P/L.
9. Calculate break-even with the sell fee and 0.1% sell tax.
10. Sell a partial quantity and verify realized P/L and RDN credit.
11. Record a dividend and verify it credits the selected destination without creating an Expense.
12. Repeat with a USD asset/account to verify currencies remain separated.

Do not treat the first Investment UAT as a reason to edit Phase 1 code. Any issue should be fixed inside `modules/investment`, `app/investments`, or the additive Prisma investment models unless a cross-feature defect is demonstrated.
