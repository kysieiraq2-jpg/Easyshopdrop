// Shop&Drop V26 production bridge.
// V25.24 commission/fee engine remains authoritative and untouched.
window.ShopDropV26 = Object.freeze({
  version:"V26",
  pageSize:24,
  photos:{min:1,max:6,mainMaxPx:1200,thumbnailMaxPx:400,automaticConversion:true},
  references:{listing:"SD-LST",service:"SD-SVC",dispatch:"SD-DSP",order:"SD-ORD",payment:"SD-PAY",shipment:"SD-SHP",feedback:"SD-FBK",payout:"SD-POT"},
  international:{country:"ISO-3166-1",currency:"ISO-4217",phone:"E.164",timestamps:"UTC"},
  fulfilment:{
    product:"verified delivery + inspection window clear of qualifying material dispute",
    service:"objectively verified provider arrival",
    dispatch:"objectively verified destination arrival"
  },
  directBuyerSellerMessaging:false
});
window.shopdropV26Status=function(message,kind="info"){
  let n=document.getElementById("shopdropV26Status");
  if(!n){n=document.createElement("div");n.id="shopdropV26Status";n.setAttribute("role","status");n.setAttribute("aria-live","polite");document.body.appendChild(n);}
  n.dataset.kind=kind;n.textContent=message||"";
};
window.shopdropV26SafeAction=async function(button,action){
  if(!button||button.dataset.busy==="true")return;
  button.dataset.busy="true";button.disabled=true;
  try{return await action();}finally{button.dataset.busy="false";button.disabled=false;}
};
