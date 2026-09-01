# Investment enhancements rollout

Pull branch `feat/investment-enhancements-local`.

Run:

```bash
node scripts/apply-investment-enhancements.mjs
./node_modules/.bin/tsc --noEmit
```

Then restart Next.js and test the investment page. The script makes backups before edits and does not touch the database file.