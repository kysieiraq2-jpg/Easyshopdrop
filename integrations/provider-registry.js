// V25 provider-neutral registry. Provider limits/fees are configuration, not hard-coded business assumptions.
export const paymentProviders = Object.freeze([
 {id:'stitch',name:'Stitch',mode:'not_connected',capabilities:['collections','marketplace_payouts','webhooks']},
 {id:'payfast',name:'Payfast',mode:'not_connected',capabilities:['checkout','split_payment_single_secondary','webhooks']},
 {id:'fnb_ecommerce',name:'FNB eCommerce',mode:'research_required',capabilities:['merchant_checkout','reconciliation']},
 {id:'paypal',name:'PayPal',mode:'optional_not_connected',capabilities:['international_checkout']}
]);
export const deliveryProviders = Object.freeze([
 {id:'bobgo',name:'Bob Go',mode:'not_connected'},
 {id:'courier_guy',name:'The Courier Guy',mode:'not_connected'},
 {id:'pargo',name:'Pargo',mode:'not_connected'},
 {id:'seller_arranged',name:'Seller-arranged courier',mode:'fallback'}
]);
export const notificationProviders = Object.freeze([
 {id:'in_app',name:'Shop&Drop notifications',mode:'built_in'},
 {id:'email',name:'Email provider',mode:'not_connected'},
 {id:'whatsapp',name:'WhatsApp Business Platform',mode:'not_connected'},
 {id:'sms',name:'SMS provider',mode:'not_connected'}
]);
export const paymentSecurity = Object.freeze({rawCardStorageAllowed:false,cvvStorageAllowed:false,providerTokenizationRequired:true,signedWebhooksRequired:true,verifiedSettlementRequiredBeforePayout:true,automaticSellerPayoutsEnabled:false});
export function integrationStatus(){return {currency:'ZAR',livePaymentsEnabled:false,liveCourierBookingsEnabled:false,automaticSellerPayoutsEnabled:false,paymentSecurity,paymentProviders,deliveryProviders,notificationProviders};}
