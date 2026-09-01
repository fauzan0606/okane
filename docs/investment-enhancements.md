# Investment enhancements

This branch is based on the verified local investment baseline `4a4331c`.

Run after pulling:

```bash
node scripts/apply-investment-enhancements.mjs
./node_modules/.bin/tsc --noEmit
```

The script creates `.backup-before-investment-enhancements` copies before modifying files.

Implemented by the patch:

- SELL unit price may be `0` (BUY still requires a positive price).
- Sell All also accepts zero price, allowing worthless/bankrupt positions to be closed cleanly.
- Dividend recording uses the existing `DIVIDEND` investment transaction type and credits the selected RDN/wallet.
- Overview API exposes dividend income and total profit fields.
- Asset Summary defaults to Cards, with a persistent Cards/Table selector.
- Asset Summary is sorted alphabetically by symbol/name.

Total Profit is defined as unrealized P/L + realized P/L + dividend income. Existing realized P/L and market-price refresh behavior are preserved by starting from the verified local baseline.
