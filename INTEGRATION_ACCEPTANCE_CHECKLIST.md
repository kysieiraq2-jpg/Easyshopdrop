# Integration acceptance checklist

1. Confirm merchant and marketplace eligibility and written settlement model with the selected payment provider.
2. Obtain sandbox credentials directly from the provider and store in server-side secrets.
3. Create a server-side payment session with an immutable order amount in ZAR.
4. Verify webhook authenticity according to the provider's current specification, verify order ID, amount, currency and transaction status independently, and handle duplicate/reordered events.
5. Keep refunds, chargebacks, commission calculations and seller balances in an auditable ledger; never pay sellers on an unverified browser return.
6. Confirm courier coverage, package weight/dimensions, pickup/drop-off responsibilities, insurance and returns.
7. Obtain a real delivery quote before showing a final payable total or taking payment.
8. Test failed payments, stock release, delivery failure, partial refunds, multi-seller orders, payout holds and reconciliation.
9. Complete security, POPIA, consumer-law, tax and operational review before public launch.
