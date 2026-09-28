// Shop&Drop V25 provider-neutral marketplace payment boundary.
// Never accept/store raw PAN/CVV. Provider credentials live in backend secrets only.
export const paymentAdapter={
 provider:'unconfigured',live:false,marketplaceMode:true,
 capabilities:{oneBuyerCheckout:true,splitSettlement:false,automatedPayouts:true,refunds:true,webhooks:true},
 async createPayment({orderId,sdOrderRef,amountCents,currency='ZAR'}){
  return {provider:'unconfigured',status:'not_available',orderId,sdOrderRef,amountCents,currency,checkoutUrl:null,
   message:'Marketplace payment provider not connected. No money collected and no card/bank credentials accepted by Shop&Drop.'};
 },
 async createSellerPayout({stRef,sellerId,amountCents}){
  return {provider:'unconfigured',status:'not_available',stRef,sellerId,amountCents,message:'Automated seller payout provider not connected.'};
 },
 async refund(){throw Error('Refund integration not configured')},
 async settlementStatus(){return {verified:false,status:'not_available'}}
};
