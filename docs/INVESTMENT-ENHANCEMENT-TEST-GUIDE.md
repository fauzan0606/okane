# Investment enhancement test guide

Test on `feat/investment-enhancements-local`:

1. SELL a held stock at price 0 and confirm the holding closes without a positive cash settlement.
2. Record a dividend for a held asset and confirm the RDN balance increases and profit reporting includes dividend income.
3. Open Transactions > Asset Summary and switch between Cards and Table. Refreshing the page should preserve the selected view.
4. Confirm assets are alphabetically ordered by ticker/name.
5. Confirm the existing Realized P/L, Refresh Prices, and Sell All features remain available.
