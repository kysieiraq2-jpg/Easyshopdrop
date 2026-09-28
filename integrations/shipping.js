// Shop&Drop V25 courier boundary. Seller packs/dispatches; buyer normally pays disclosed delivery.
export const shippingAdapter={
 provider:'unconfigured',live:false,
 async getRates({stRef,origin,destination,parcel}){
  return {status:'not_available',stRef,rates:[],message:'No integrated courier rates available. Seller-arranged courier remains the fallback.'};
 },
 async createShipment({stRef,serviceCode,destination}){
  return {status:'not_available',stRef,serviceCode,trackingNumber:null,waybillUrl:null,message:'Courier booking integration not configured.'};
 },
 async trackingStatus(){return {status:'not_available',events:[]}}
};
