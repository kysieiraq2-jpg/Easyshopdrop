# V26-2 Backend Requirements
These controls extend Shop&Drop operations without replacing V25.24 commission logic.

## Financial reconciliation
Persist immutable ledger lines for customer payment, item/service amount, progressive Shop&Drop service fee from existing authoritative commission engine, courier fee, processing fee, refunds/adjustments, seller/provider proceeds, payout and FNB/provider settlement.

## Chargebacks
Payment-provider webhook opens dispute; atomically hold affected payout; evidence deadline/status; accept/contest; signed provider decision; ledger adjustment; release/adjust/refund.

## Inventory reservation
Atomic reserve against available stock; unique reservation/order-line linkage; expires_at; verified payment commits stock; expiry/cancel releases stock. Scheduled cleanup and checkout revalidation required.

## Fulfilment deadlines
Configurable milestones per Products/Services/Dispatch; overdue/no-show events create Admin exception and notifications.

## Evidence
Private protected Storage bucket; metadata links evidence to listing/order-line/dispute/return; timestamps/uploader/audit; signed access only.

## Payout statement
Read-only seller/provider statement derived from ledger/allocation/payout records. Never accept authoritative amounts from browser.
