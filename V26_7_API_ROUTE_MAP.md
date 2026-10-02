# V26-7 API Route → Edge Function map
Frontend path | Supabase Edge Function
/api/commerce/cancellations → cancellations
/api/marketplace/listing-reports → listing-reports
/api/payments/disputes → disputes
/api/support/change-requests → change-requests
/api/support/dispute-evidence → dispute-evidence
/api/support/feedback → feedback

Deployment must configure the application API adapter/gateway to invoke the corresponding Edge Function with the authenticated user's JWT. Do not expose service-role keys to the browser.
