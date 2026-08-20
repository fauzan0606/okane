# Investment lot ledger

Investment v2 tracks each BUY as a lot using metadata on the existing InvestmentTransaction model. SELL transactions store lot allocations in metadata. This allows split sales, FIFO allocation, Excel import, minimum sell price, and realized/unrealized analysis without a schema migration in this phase.
