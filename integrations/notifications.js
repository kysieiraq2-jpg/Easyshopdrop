// Event-driven notification boundary. Financial truth comes from verified provider/system events, not AI judgment.
export const notificationAdapter={
 channels:['in_app','email','whatsapp','sms'],
 live:false,
 async send({userId,channel,templateKey,payload}){
  return {status:channel==='in_app'?'queued':'not_available',userId,channel,templateKey,payload,providerMessageRef:null};
 }
};
