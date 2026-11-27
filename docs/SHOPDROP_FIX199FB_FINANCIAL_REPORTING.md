# Fix 199F-B — Read-only financial statement

- Existing administrator-only read function `shopdrop_admin_financial_records_199fa` connected to the financial statement.
- All three categories; original item/advertisement references, recorded amounts, status, provider references, date and page navigation.
- No new authorization step: existing administrator security check permits viewing only. No payment, payout, refund, release or approval writes.
- Separate release requests and payout records; no revenue totals derived from overlapping financial rows. No inferred currency or bank charges.
- Supabase migration 20261127060855 already installed; exact copy for source history, not executed by this workflow.
- SQL verification used rolled-back pending product and dispatch payments and failed service payment records; pagination and non-admin denial passed. Positive payout/refund/settlement tests and signed-in browser inspection remain outstanding. No actual funds moved.
- Existing private customer/provider financial history not changed in this patch. Provider activation and independent settlement verification remain outstanding.
