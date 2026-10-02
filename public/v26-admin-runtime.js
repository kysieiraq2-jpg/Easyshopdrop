/* V26-10 admin-only runtime */
const SHOPDROP_AUDITED_ADMIN_ACTIONS=Object.freeze([
  "refund","payout_hold","payout_release","listing_suspend","listing_restore",
  "complaint_decision","banking_configuration","payment_configuration",
  "website_change","role_change","manual_transaction_adjustment"
]);

const SHOPDROP_EXCEPTION_TYPES=Object.freeze({
  PAYMENT_MISMATCH:"payment_mismatch",COURIER_BOOKING_FAILED:"courier_booking_failed",
  DUPLICATE_WEBHOOK:"duplicate_webhook",PROVIDER_NO_SHOW:"provider_no_show",
  RETURN_PROBLEM:"return_problem",PAYOUT_PROBLEM:"payout_problem",
  REFERENCE_CONFLICT:"reference_conflict"
});

const SHOPDROP_HEALTH_COMPONENTS=Object.freeze(["database","authentication","storage","payment","fnb","email","whatsapp","couriers","notifications"]);

const SHOPDROP_INTEGRATION_STATUS = {
  supabase_auth: {required:true,status:"pending_connection"},
  supabase_database: {required:true,status:"pending_connection"},
  supabase_storage: {required:true,status:"pending_connection"},
  supabase_realtime: {required:true,status:"pending_connection"},
  protected_reference_functions: {required:true,status:"pending_connection"},
  payment_provider: {required:true,status:"pending_provider_selection_connection"},
  fnb_settlement_reconciliation: {required:true,status:"pending_merchant_configuration"},
  payout_rail: {required:true,status:"pending_provider_connection"},
  courier_api: {required:true,status:"pending_provider_connection"},
  email_delivery: {required:true,status:"pending_provider_connection"},
  whatsapp_business: {required:true,status:"pending_business_configuration"},
  notifications_backend: {required:true,status:"pending_connection"}
};

const SHOPDROP_EVENT_DESTINATIONS=Object.freeze({
  payment_confirmed:["buyer","relevant_seller_or_provider","admin"],
  courier_booked:["buyer","relevant_seller","admin"],
  dispatch_booking_confirmed:["customer","dispatch_provider","admin"],
  service_arrival_verified:["customer","service_provider","admin"],
  product_delivered:["buyer","seller","admin"],
  product_dispute_opened:["buyer","seller","admin"],
  payout_eligible:["relevant_payee","admin"],
  refund_processed:["buyer","seller_or_provider_if_relevant","admin"]
});

const SHOPDROP_PRE_SUPABASE_CHECKS=Object.freeze([
  "admin_authorization","company_banking_fnb","global_whatsapp","global_email",
  "complaints_suggestions","website_change_requests","social_marketing_route",
  "taxonomy_single_source","nested_mobile_categories","homepage_categories",
  "product_browse_24_per_page","product_detail","seller_listing","image_processing_1_to_6",
  "unique_references","multi_seller_bag","checkout_review","payment_methods",
  "global_payment_rails","courier_quotes_booking_tracking","sale_in_progress",
  "product_delivery_inspection_returns","dispatch_browse_listing_tracking",
  "services_browse_listing_verified_arrival","buyer_dashboard","seller_dashboard",
  "provider_dashboard","notifications","receipts","transaction_feedback",
  "drafts","duplicate_submit_protection","cancellations","admin_exception_queue"
]);