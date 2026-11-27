/* Fix 199H-A: safe return to the selected customer task after authentication. */
(function(){
'use strict';
const rules=Object.freeze({
 'sell-item.html':{},
 'account.html':{},
 'checkout.html':{},
 'order.html':{'id':'ref'},
 'product-orders-194f.html':{'role':'role'},
 'tracking.html':{'order':'ref','orderRef':'ref','ref':'ref'},
 'receipts.html':{},
 'payout-statement.html':{},
 'service-checkout-193e.html':{'booking_id':'uuid'},
 'dispatch-checkout-192de.html':{'booking_id':'uuid'},
 'service-completion-status-193g.html':{'booking_type':'type','booking_id':'uuid'},
 'service-location-193f.html':{'booking_id':'uuid','role':'role'},
 'service-bag-193c.html':{},
 'dispatch-bag-192dc.html':{},
 'proof-of-delivery.html':{order:'ref',shipment:'ref'},
 'cancellations.html':{kind:'token',reference:'ref'},
 'report-listing.html':{kind:'token',reference:'ref'},
 'service-appointments-193d.html':{role:'role',booking_id:'uuid',from_notification:'flag'},
 'dispatch-appointments-192dd.html':{role:'role',booking_id:'uuid',item:'uuid',from_notification:'flag'},
 'customer-dispute-evidence-199gb.html':{dispute_id:'uuid',booking_type:'type',booking_id:'uuid',role:'role'}
});
const valid={uuid:v=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v),ref:v=>/^[A-Za-z0-9_-]{1,120}$/.test(v),token:v=>/^[a-z_]{1,32}$/.test(v),role:v=>['customer','provider','buyer','seller'].includes(v),type:v=>['service','dispatch'].includes(v),flag:v=>v==='1'};
function safe(raw){
 if(typeof raw!=='string'||raw.length>900)return null;
 const match=/^(?:\.\/)?([a-z0-9-]+\.html)(?:\?([^#]*))?$/.exec(raw);
 if(!match||!Object.hasOwn(rules,match[1]))return null;
 const out=new URLSearchParams(),input=new URLSearchParams(match[2]||'');
 for(const [key,type] of Object.entries(rules[match[1]])){
  const values=input.getAll(key);if(values.length===1&&valid[type](values[0]))out.set(key,values[0]);
 }
 return './'+match[1]+(out.size?'?'+out.toString():'');
}
const page=location.pathname.split('/').pop();
function requested(){return safe(new URLSearchParams(location.search).get('next'));}
function current(){return safe(page+location.search);}
function authLink(target){
 if(target!=='sign-in.html'&&target!=='register.html')return null;
 const next=(page==='sign-in.html'||page==='register.html')?requested():current();
 return './'+target+(next?'?next='+encodeURIComponent(next.slice(2)):'');
}
function rewrite(a){
 if(!a)return;const value=a.getAttribute('href')||'';
 const match=/^(?:\.\/)?(sign-in|register)\.html$/.exec(value);
 if(match){const next=authLink(match[1]+'.html');if(next)a.setAttribute('href',next);}
}
window.ShopDropReturn199h=Object.freeze({safe,requested,authLink});
for(const a of document.querySelectorAll('a[href]'))rewrite(a);
// Dynamic sign-in links are also handled on the normal click/keyboard activation path.
document.addEventListener('click',event=>{const a=event.target?.closest?.('a[href]');rewrite(a);},true);
})();
