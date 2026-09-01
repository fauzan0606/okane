## Rollout

Pull `feat/investment-enhancements-local`, then run:

```bash
node scripts/apply-investment-enhancements.mjs
./node_modules/.bin/tsc --noEmit
```

Restart the local Next.js server and verify:

- SELL at unit price 0 closes a worthless/bankrupt position.
- Dividend can be recorded to the selected RDN.
- Dividend income and total profit appear in the overview data.
- Asset Summary switches between Cards and Table and remembers the choice.
- Asset Summary is alphabetically ordered.
- Existing Realized P/L and Refresh Prices remain intact.
