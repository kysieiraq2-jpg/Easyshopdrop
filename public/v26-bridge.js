
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

 /*
  SHOPDROP_DESPATCH_DISPLAY_ONLY_V1

  Customer-facing spelling only.
  Technical dispatch identifiers remain unchanged.
  No changes to links, attributes, forms, API calls,
  Supabase, payment or courier functionality.
 */
 (function(){
   "use strict";

   const preferred =
     "Despatching / Dispatching & Transport";

   const blocked = new Set([
     "SCRIPT","STYLE","NOSCRIPT",
     "TEXTAREA","OPTION","CODE","PRE"
   ]);

   function updateText(node){
     if(node.nodeType!==Node.TEXT_NODE)return;

     const parent=node.parentElement;
     if(!parent || blocked.has(parent.tagName))return;
     if(parent.closest("[contenteditable]"))return;

     const before=node.nodeValue;
     if(!before)return;

     const after=before
       .replace(
         /Dispatching\s*&\s*Transport/g,
         preferred
       )
       .replace(
         /Dispatch\s*&\s*Transport/g,
         preferred
       );

     if(after!==before){
       node.nodeValue=after;
     }
   }

   function scan(root){
     if(!root)return;

     if(root.nodeType===Node.TEXT_NODE){
       updateText(root);
       return;
     }

     if(root.nodeType!==Node.ELEMENT_NODE &&
        root.nodeType!==Node.DOCUMENT_NODE &&
        root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE){
       return;
     }

     if(root.nodeType===Node.ELEMENT_NODE &&
        blocked.has(root.tagName)){
       return;
     }

     const walker=document.createTreeWalker(
       root,
       NodeFilter.SHOW_TEXT,
       {
         acceptNode(node){
           const p=node.parentElement;
           if(!p || blocked.has(p.tagName) ||
              p.closest("[contenteditable]")){
             return NodeFilter.FILTER_REJECT;
           }
           return NodeFilter.FILTER_ACCEPT;
         }
       }
     );

     while(walker.nextNode()){
       updateText(walker.currentNode);
     }
   }

   function start(){
     scan(document.body);

     const observer=new MutationObserver(records=>{
       for(const record of records){
         if(record.type==="characterData"){
           updateText(record.target);
         }else{
           for(const node of record.addedNodes){
             scan(node);
           }
         }
       }
     });

     observer.observe(document.body,{
       childList:true,
       characterData:true,
       subtree:true
     });
   }

   if(document.readyState==="loading"){
     document.addEventListener(
       "DOMContentLoaded",start,{once:true}
     );
   }else{
     start();
   }
 })();
