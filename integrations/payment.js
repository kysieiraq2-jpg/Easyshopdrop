// Provider-neutral V21 payment boundary. Shop&Drop must never receive/store raw PAN or CVV here.
export const paymentAdapter={
 provider:'unconfigured',live:false,
 async createPayment({orderId,method='provider_checkout'}){
  return {provider:'unconfigured',status:'not_available',orderId,method,checkoutUrl:null,
   message:'No certified payment provider connected; no money collected and no card data accepted.'};
 },
 async refund(){throw Error('Refund integration not configured')},
 async settlementStatus(){return {verified:false,status:'not_available'}}
};
