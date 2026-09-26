// V21 provider-neutral registry. No live financial or courier operation is enabled by this file.
export const paymentProviders = Object.freeze([
 {id:'payfast',name:'Payfast',mode:'not_connected',methods:['card','instant_eft']},
 {id:'paystack',name:'Paystack',mode:'not_connected',methods:['card','bank','mobile_money']},
 {id:'peach',name:'Peach Payments',mode:'not_connected',methods:['card','eft','wallet']}
]);
export const deliveryProviders = Object.freeze([
 {id:'bobgo',name:'Bob Go',mode:'not_connected'},
 {id:'courier_guy',name:'The Courier Guy',mode:'not_connected'},
 {id:'pargo',name:'Pargo',mode:'not_connected'}
]);
export const paymentSecurity = Object.freeze({
 rawCardStorageAllowed:false,cvvStorageAllowed:false,providerTokenizationRequired:true,
 signedWebhooksRequired:true,verifiedSettlementRequiredBeforePayout:true,
 automaticSellerPayoutsEnabled:false
});
export function integrationStatus(){return {currency:'ZAR',livePaymentsEnabled:false,liveCourierBookingsEnabled:false,automaticSellerPayoutsEnabled:false,paymentSecurity,paymentProviders,deliveryProviders};}
