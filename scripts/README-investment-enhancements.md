Investment enhancement rollout checklist

1. Pull branch `feat/investment-enhancements-local`.
2. Run `node scripts/apply-investment-enhancements.mjs`.
3. Run `./node_modules/.bin/tsc --noEmit`.
4. Restart local Next.js server.
5. Test SELL at 0, Dividend, Asset Summary Cards/Table, and alphabetical ordering.
6. Do not run Prisma migrations; the existing schema already contains `DIVIDEND`.
7. Keep the generated `.backup-before-investment-enhancements` files until the UI is verified.
