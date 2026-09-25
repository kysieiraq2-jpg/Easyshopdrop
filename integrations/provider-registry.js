// Provider-neutral integration registry. All live operations remain disabled.
export const paymentProviders = Object.freeze([
 {id:'payfast',name:'Payfast',mode:'not_connected'},
 {id:'paystack',name:'Paystack',mode:'not_connected'},
 {id:'peach',name:'Peach Payments',mode:'not_connected'}
]);
export const deliveryProviders = Object.freeze([
 {id:'bobgo',name:'Bob Go',mode:'not_connected'},
 {id:'courier_guy',name:'The Courier Guy',mode:'not_connected'},
 {id:'pargo',name:'Pargo',mode:'not_connected'}
]);
export function integrationStatus(){return {currency:'ZAR',livePaymentsEnabled:false,liveCourierBookingsEnabled:false,automaticSellerPayoutsEnabled:false,paymentProviders,deliveryProviders};}
