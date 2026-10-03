const SHOPDROP_SUPABASE_URL = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
const SHOPDROP_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vHQcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
window.ShopDrop={
 isStatic: location.hostname.endsWith('github.io'), apiBase:'',
 async api(path,options={}){
  if(this.isStatic) throw new Error('Preview mode: live account, order, payment and database features require the Shop&Drop backend.');
  const r=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const type=r.headers.get('content-type')||'';
  if(!type.includes('application/json')) throw new Error('Shop&Drop service is temporarily unavailable. Please try again later.');
  const d=await r.json(); if(!r.ok) throw new Error(d.error||'Request failed'); return d;
 },
 money(c,cur='ZAR'){return (Number(c||0)/100).toLocaleString(undefined,{style:'currency',currency:cur||'ZAR'})},
 esc(x){return String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;')},
 msg(el,text,kind='info'){el.textContent=text;el.className='message '+kind;el.hidden=false}
};

// V26_PRODUCTION_NESTED_CATEGORY_MENU
// Production repair from V26 newest-complete requirements.
// Existing V25.24 category/taxonomy data remains authoritative.
window.ShopDropV26 = window.ShopDropV26 || {};
window.ShopDropV26.renderProductionNestedCategories = async function(target) {
  if (!target) return;
  target.setAttribute("aria-busy","true");
  try {
    let categories = [];
    // Live backend is preferred, but GitHub Pages/static preview must use the
    // packaged authoritative taxonomy instead of collapsing to a single link.
    try {
      const data = await ShopDrop.api('/api/categories');
      categories = Array.isArray(data?.categories) ? data.categories : [];
    } catch (_) {}
    if (!categories.length) {
      try {
        const r = await fetch('./taxonomy.json', {cache:'force-cache'});
        const t = await r.json();
        categories = (Array.isArray(t?.departments) ? t.departments : []).map(d => ({
          name: d.name,
          slug: d.slug || d.name,
          subcategories: (d.subcategories || []).map(sub =>
            typeof sub === 'string' ? {name: sub, slug: sub} : sub
          )
        }));
      } catch (_) {}
    }
    target.replaceChildren();

    if (!categories.length) {
      const fallback = document.createElement("a");
      fallback.href = "categories.html";
      fallback.textContent = "View All Categories";
      target.appendChild(fallback);
      return;
    }

    for (const category of categories) {
      const details = document.createElement("details");
      details.className = "v26-menu-category";

      const summary = document.createElement("summary");
      summary.textContent = category.name || "Category";
      details.appendChild(summary);

      const subWrap = document.createElement("div");
      subWrap.className = "v26-menu-subcategories";

      const browseAll = document.createElement("a");
      browseAll.textContent = `Browse All ${category.name || ""}`.trim();
      browseAll.href = `categories.html?category=${encodeURIComponent(category.slug || category.id || category.name || "")}`;
      subWrap.appendChild(browseAll);

      for (const sub of (category.subcategories || [])) {
        const link = document.createElement("a");
        link.textContent = sub.name || "Subcategory";
        link.href =
          `categories.html?category=${encodeURIComponent(category.slug || category.id || category.name || "")}` +
          `&subcategory=${encodeURIComponent(sub.slug || sub.id || sub.name || "")}`;
        subWrap.appendChild(link);
      }

      details.appendChild(subWrap);
      target.appendChild(details);
    }
  } catch (error) {
    console.error("Shop&Drop category menu failed", error);
    target.replaceChildren();
    const fallback = document.createElement("a");
    fallback.href = "categories.html";
    fallback.textContent = "View All Categories";
    target.appendChild(fallback);
  } finally {
    target.removeAttribute("aria-busy");
  }
};

window.ShopDropV26.mountProductionCategoryMenus = function() {
  document.querySelectorAll("[data-v26-category-menu]").forEach(el => {
    window.ShopDropV26.renderProductionNestedCategories(el);
  });
};
document.addEventListener("DOMContentLoaded", window.ShopDropV26.mountProductionCategoryMenus);

// V26_LIVE_DRAFT_CONTINUE
window.ShopDropDrafts={
  key(scope,id="new"){return `shopdrop:draft:${scope}:${id}`;},
  save(scope,data,id="new"){
    localStorage.setItem(this.key(scope,id),JSON.stringify({data,saved_at:new Date().toISOString()}));
    return true;
  },
  load(scope,id="new"){
    try{return JSON.parse(localStorage.getItem(this.key(scope,id))||"null");}catch{return null;}
  },
  clear(scope,id="new"){localStorage.removeItem(this.key(scope,id));}
};

// V26_2_MARKETPLACE_CONTROLS
window.ShopDropV262 = Object.freeze({
  inventoryReservationStates:["reserved","payment_pending","committed","expired","released"],
  paymentDisputeStates:["opened","evidence_required","under_review","accepted","contested","won","lost","closed"],
  payoutStates:["pending","eligible","held_dispute","processing","paid","adjusted_refunded"],
  fulfilmentExceptionStates:["on_time","due_soon","overdue","no_show","admin_exception"]
});
window.shopdropReservationCountdown=function(expiresAt,target){
  if(!target||!expiresAt)return;
  const render=()=>{
    const ms=new Date(expiresAt).getTime()-Date.now();
    if(ms<=0){target.textContent="Reservation expired";return;}
    const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000);
    target.textContent=`Reserved for ${m}:${String(s).padStart(2,"0")}`;
    setTimeout(render,1000);
  };render();
};

// V26_3_TRACKING_RESILIENCE_ENGINE
// Source priority: carrier webhook/API -> scheduled polling -> verified manual fallback.
window.ShopDropTracking = {
  sourcePriority:["carrier_webhook","carrier_api_poll","verified_manual"],
  normalize(event={}){
    return {
      shipment_reference:event.shipment_reference||null,
      order_reference:event.order_reference||null,
      carrier:event.carrier||null,
      carrier_reference:event.carrier_reference||null,
      status:event.status||"unknown",
      occurred_at:event.occurred_at||new Date().toISOString(),
      source:event.source||"unknown",
      source_reference:event.source_reference||null,
      location:event.location||null,
      details:event.details||null
    };
  },
  isStale(lastEvent,staleMinutes=30){
    if(!lastEvent?.occurred_at)return true;
    return Date.now()-new Date(lastEvent.occurred_at).getTime()>staleMinutes*60000;
  },
  nextFallback(lastEvent){
    if(!lastEvent)return "carrier_api_poll";
    if(lastEvent.source==="carrier_webhook" && this.isStale(lastEvent))return "carrier_api_poll";
    if(lastEvent.source==="carrier_api_poll" && this.isStale(lastEvent))return "verified_manual";
    return null;
  }
};

// V26_5_PROTECTED_FORM_ADAPTER
window.ShopDropProtectedForms={
  routes:{
    "admin-change-request":"/support/change-requests",
    "cancellation-request":"/commerce/cancellations",
    "dispute-evidence":"/support/dispute-evidence",
    "feedback":"/support/feedback",
    "payment-dispute":"/payments/disputes",
    "report-listing":"/marketplace/listing-reports"
  },
  async submit(form){
    const type=form.dataset.shopdropForm;
    const route=this.routes[type];
    if(!route)throw new Error("Unknown Shop&Drop form.");
    const data=Object.fromEntries(new FormData(form).entries());
    // File inputs are sent through protected signed-upload flow during backend integration.
    const hasFiles=[...form.querySelectorAll('input[type="file"]')].some(x=>x.files?.length);
    if(hasFiles)data._files_pending_signed_upload=true;
    if(typeof api!=="function"){
      throw new Error("Shop&Drop backend connection is pending. Your request has not been submitted.");
    }
    return api("/api"+route,{method:"POST",body:JSON.stringify(data),headers:{"Content-Type":"application/json"}});
  }
};
document.addEventListener("submit",async e=>{
  const form=e.target.closest?.("form[data-shopdrop-form]");
  if(!form)return;
  e.preventDefault();
  const button=form.querySelector('button[type="submit"]');
  if(button?.dataset.busy==="true")return;
  if(button){button.dataset.busy="true";button.disabled=true;}
  try{
    const result=await window.ShopDropProtectedForms.submit(form);
    if(window.shopdropV26Status)shopdropV26Status(result?.reference?`Submitted. Reference: ${result.reference}`:"Submitted successfully.","success");
  }catch(err){
    if(window.shopdropV26Status)shopdropV26Status(err?.message||"Could not submit. Please try again.","error");
    else alert(err?.message||"Could not submit.");
  }finally{
    if(button){button.dataset.busy="false";button.disabled=false;}
  }
});

// V26_5_DYNAMIC_IMAGE_POLICY
window.ShopDropImagePerformance={
  apply(root=document){
    root.querySelectorAll?.("img:not([loading])").forEach((img,index)=>{
      if(img.dataset.eager==="true"||index===0)return;
      img.loading="lazy"; img.decoding="async";
      if(!img.width && img.dataset.width)img.width=Number(img.dataset.width);
      if(!img.height && img.dataset.height)img.height=Number(img.dataset.height);
    });
  }
};
document.addEventListener("DOMContentLoaded",()=>ShopDropImagePerformance.apply());
new MutationObserver(records=>{
  for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)ShopDropImagePerformance.apply(n);
}).observe(document.documentElement,{childList:true,subtree:true});
