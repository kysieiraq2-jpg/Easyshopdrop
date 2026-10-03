/* Shop&Drop V26-10 controlled public consolidation. */
const SHOPDROP_BROWSE_PAGE_SIZE = 24;

const SHOPDROP_DISPATCH_PAGE_SIZE = 24;

const SHOPDROP_SERVICES_PAGE_SIZE = 24;

const SHOPDROP_REFERENCE_PREFIXES = Object.freeze({
  listing: "SD-LST",
  order: "SD-ORD",
  payment: "SD-PAY",
  shipment: "SD-SHP",
  feedback: "SD-FBK",
  payout: "SD-POT"
});

const SHOPDROP_IMAGE_RULES = Object.freeze({
  minPhotos: 1,
  maxPhotos: 6,
  maxOriginalBytes: 15 * 1024 * 1024, // ~15 MB
  mainMaxWidth: 1200,
  mainMaxHeight: 1200,
  thumbMaxWidth: 400,
  thumbMaxHeight: 400,
  outputMimeType: "image/webp",
  mainQuality: 0.82,
  thumbQuality: 0.78
});

const SHOPDROP_VISUAL_LISTING_RULES=Object.freeze({
  min_photos:1,max_photos:6,
  main_max_px:1200,thumbnail_max_px:400,
  stored_display_format:"webp",
  seller_conversion_required:false,
  first_photo_is_main:true
});

const SHOPDROP_ACCOUNT_ROLES=Object.freeze(["buyer","seller","service_provider","dispatch_provider","admin"]);

const SHOPDROP_MARKETPLACE_DIVISIONS = Object.freeze({
  products: {
    key: "products",
    label: "Products",
    landingRoute: "/marketplace/products.html",
    createRoute: "/seller/add-product.html",
    browseRoute: "/browse.html",
    detailRoute: "/product.html",
    actionLabel: "Add to Bag",
    fulfilmentType: "delivery",
    referencePrefix: "SD-LST"
  },

  services: {
    key: "services",
    label: "Other Services",
    landingRoute: "/marketplace/services.html",
    createRoute: "/provider/add-service.html",
    browseRoute: "/services/browse.html",
    detailRoute: "/service.html",
    actionLabel: "Book / Request Service",
    fulfilmentType: "service_completion",
    referencePrefix: "SD-SVC"
  },

  dispatch: {
    key: "dispatch",
    label: "Dispatching & Transport",
    landingRoute: "/marketplace/dispatch.html",
    createRoute: "/dispatch/list-service.html",
    browseRoute: "/dispatch/browse.html",
    detailRoute: "/dispatch/detail.html",
    actionLabel: "Book / Request Quote",
    fulfilmentType: "dispatch_completion",
    referencePrefix: "SD-DSP"
  }
});

const SHOPDROP_LISTING_STATES = Object.freeze({
  ACTIVE: "active",
  RESERVED: "reserved",
  SALE_IN_PROGRESS: "sale_in_progress",
  SOLD: "sold",
  COMPLETED: "completed",
  ARCHIVED: "archived",
  UNAVAILABLE: "unavailable",
  SUSPENDED: "suspended"
});

const SHOPDROP_STOCK_ACTIONS=Object.freeze(["increase","decrease","pause","relist","withdraw"]);

const SHOPDROP_CANCELLATION_STATES=Object.freeze({
  BUYER_CANCELLED_BEFORE_PAYMENT:"buyer_cancelled_before_payment",
  SELLER_WITHDREW_BEFORE_SALE:"seller_withdrew_before_sale",
  SERVICE_CANCELLED_BEFORE_ATTENDANCE:"service_cancelled_before_attendance",
  DISPATCH_CANCELLED_BEFORE_DEPARTURE:"dispatch_cancelled_before_departure"
});

const SHOPDROP_NOTIFICATION_TYPES=Object.freeze({
  PAYMENT_CONFIRMED:"payment_confirmed",NEW_ORDER:"new_order",
  COURIER_BOOKED:"courier_booked",TRACKING_UPDATED:"tracking_updated",
  PROVIDER_EN_ROUTE:"provider_en_route",ARRIVAL_CONFIRMATION_REQUIRED:"arrival_confirmation_required",
  DISPATCH_ARRIVED:"dispatch_arrived",PAYOUT_ELIGIBLE:"payout_eligible",
  COMPLAINT_RESPONSE:"complaint_response",RETURN_UPDATE:"return_update",
  REFUND_PROCESSED:"refund_processed"
});

const SHOPDROP_PRODUCT_DISPUTE_REASONS = Object.freeze({
  MATERIALLY_DIFFERENT: "materially_different",
  UNDISCLOSED_DAMAGE: "undisclosed_damage",
  WRONG_ITEM: "wrong_item",
  COUNTERFEIT_MISREPRESENTED: "counterfeit_misrepresented",
  WRONG_QUANTITY: "wrong_quantity",
  NOT_WORKING_AS_ADVERTISED: "not_working_as_advertised"
});

const SHOPDROP_PRODUCT_POST_DELIVERY_STATES = Object.freeze({
  IN_TRANSIT: "in_transit",
  DELIVERED_INSPECTION: "delivered_inspection",
  DISPUTE_OPEN: "dispute_open",
  RETURN_AUTHORIZED: "return_authorized",
  RETURN_IN_TRANSIT: "return_in_transit",
  RETURN_CONFIRMED: "return_confirmed",
  REFUND_ELIGIBLE: "refund_eligible",
  PAYOUT_ELIGIBLE: "payout_eligible",
  CLOSED: "closed"
});

const SHOPDROP_SERVICE_ATTENDANCE_STATES = Object.freeze({
  BOOKING_CONFIRMED: "booking_confirmed",
  PROVIDER_EN_ROUTE: "provider_en_route",
  ARRIVAL_PENDING_VERIFICATION: "arrival_pending_verification",
  ARRIVAL_VERIFIED: "arrival_verified",
  NO_SHOW_REPORTED: "no_show_reported",
  CANCELLED: "cancelled",
  EXCEPTION_REVIEW: "exception_review"
});

const SHOPDROP_DISPATCH_JOB_STATES = Object.freeze({
  BOOKING_CONFIRMED: "booking_confirmed",
  DEPARTED_PROVIDER: "departed_provider",
  IN_PROGRESS: "in_progress",
  ARRIVED_DESTINATION: "arrived_destination",
  COMPLETED: "completed",
  EXCEPTION: "exception",
  CANCELLED: "cancelled"
});

const SHOPDROP_TERMS_CONTEXTS=Object.freeze(["listing_publish","product_checkout","service_booking","dispatch_booking"]);

const SHOPDROP_INTERNATIONAL_MODEL = Object.freeze({
  countryCodeStandard:"ISO-3166-1-alpha-2",
  currencyCodeStandard:"ISO-4217",
  phoneStorage:"E.164",
  timestampStorage:"UTC_ISO_8601",
  addressFields:["country_code","region","city","address_line_1","address_line_2","postal_code"],
  locationPrivacy:"public listings show appropriate city/region/service area; exact private addresses protected",
  paymentRouting:"buyer bank/card/wallet -> approved provider rail -> SD-PAY/ledger -> merchant settlement/reconciliation -> FNB",
  payoutRouting:"SD-POT -> approved payout rail -> verified beneficiary profile -> seller/provider bank"
});

let SHOPDROP_COUNTRIES = [];

const SHOPDROP_PAYMENT_METHODS = Object.freeze({
  card: {
    label: "Credit / Debit Card",
    providerCapability: "card"
  },
  instant_eft: {
    label: "Instant EFT / Bank Payment",
    providerCapability: "instant_eft"
  },
  digital_wallet: {
    label: "Digital Wallet",
    providerCapability: "digital_wallet"
  },
  paypal: {
    label: "PayPal",
    providerCapability: "paypal"
  }
});

const SHOPDROP_COURIERS = [
  {
    id: "the-courier-guy",
    name: "The Courier Guy",
    regions: ["ZA"],
    domestic: true,
    international: false,
    bookingUrl: "https://thecourierguy.co.za/",
    trackingUrl: "https://thecourierguy.co.za/tracking/",
    active: true
  },
  {
    id: "postnet",
    name: "PostNet",
    regions: ["ZA"],
    domestic: true,
    international: true,
    bookingUrl: "https://www.postnet.co.za/services",
    trackingUrl: "https://www.postnet.co.za/tracker",
    active: true
  },
  {
    id: "aramex-za",
    name: "Aramex South Africa",
    regions: ["ZA"],
    domestic: true,
    international: true,
    bookingUrl: "https://storetodoor.aramex.co.za/",
    trackingUrl: "https://aramex.co.za/tracking/TrackShipment.php",
    active: true
  },
  {
    id: "dsv",
    name: "DSV",
    regions: ["ZA", "GLOBAL"],
    domestic: true,
    international: true,
    bookingUrl: "https://www.dsv.com/en-za/",
    trackingUrl: "https://www.dsv.com/en-za/support",
    active: true
  },
  {
    id: "dhl",
    name: "DHL",
    preferredGlobal: true,
    regions: ["ZA", "GLOBAL"],
    domestic: false,
    international: true,
    bookingUrl: "https://www.dhl.com/za-en/home.html",
    trackingUrl: "https://www.dhl.com/za-en/home.html",
    active: true
  },
  {
    id: "fedex",
    name: "FedEx",
    preferredGlobal: true,
    regions: ["ZA", "GLOBAL"],
    domestic: false,
    international: true,
    bookingUrl: "https://www.fedex.com/en-za/home.html",
    trackingUrl: "https://www.fedex.com/en-za/new-customer/how-to-track.html",
    active: true
  },
  {
    id: "ups",
    name: "UPS",
    preferredGlobal: true,
    regions: ["ZA", "GLOBAL"],
    domestic: false,
    international: true,
    bookingUrl: "https://www.ups.com/za/en/home",
    trackingUrl: "https://www.ups.com/track",
    active: true
  }
];

const SHOPDROP_SHIPPING_AGGREGATOR_CANDIDATES = [
  {
    id: "bob-go",
    name: "Bob Go",
    region: "ZA",
    website: "https://www.bobgo.co.za/",
    integrationInfo: "https://www.bobgo.co.za/apps-integrations",
    capabilities: ["multi_courier_rates", "checkout_rates", "shipment_creation", "tracking", "sandbox"],
    status: "candidate_not_connected"
  }
];

const SHOPDROP_PUBLIC_CONTACT = Object.freeze({
  whatsappBusinessNumber: SHOPDROP_WHATSAPP_NUMBER,
  supportEmail: "" // official Shop&Drop support email to be configured, never invented
});

const SHOPDROP_WHATSAPP_NUMBER = "";

const SHOPDROP_WHATSAPP_DEFAULT_MESSAGE =
  "Hello Shop&Drop. I have a question about the website.";

const SHOPDROP_CATEGORY_ROUTES = {
  categoriesIndex: "/categories.html",
  categoryPage: "/category.html",
  browsePage: "/browse.html"
};

const SHOPDROP_COMMERCE_ROUTES = Object.freeze({
  bag: "/bag.html",
  checkout: "/checkout/",
  delivery: "/checkout/delivery.html",
  payment: "/checkout/payment.html",
  orders: "/account/orders.html",
  tracking: "/tracking.html"
});

const SHOPDROP_FLOW_MAP=Object.freeze({
  products:["home/menu","category","subcategory","browse","product-detail","bag","delivery-courier","checkout-review","payment","tracking","delivery","inspection","payout-or-return","history-feedback"],
  services:["home/menu","category","subcategory","browse","service-detail","booking","checkout-review","payment","provider-en-route","verified-arrival","payout","history-feedback"],
  dispatch:["home/menu","category","subcategory","browse","dispatch-detail","dispatch-request","preview","checkout-review","payment","job-tracking","destination-arrival","payout","history-feedback"]
});

const SHOPDROP_PRODUCT_POLICY = {
  inspectionWindowHours: null, // TO BE CONFIGURED/AGREED
  changeOfMindReturnsEnabled: false
};

const SHOPDROP_SERVICE_TRANSACTION_POLICY = Object.freeze({
  listingReferencePrefix: "SD-SVC",
  orderReferencePrefix: "SD-ORD",
  paymentReferencePrefix: "SD-PAY",
  payoutReferencePrefix: "SD-POT",
  payoutReleaseRule: "VERIFIED_PROVIDER_ARRIVAL"
});

const SHOPDROP_AUTHORITATIVE_FULFILMENT_RULES = Object.freeze({
  products: {
    milestone: "verified_delivery_plus_inspection_window",
    payout_eligibility:
      "verified delivery + configured inspection window clear of qualifying material dispute",
    dispute_scope:
      "material misrepresentation/wrong item/undisclosed significant damage/wrong quantity/not working as advertised and applicable law",
    subjective_dislike_auto_blocks_payout: false
  },
  services: {
    milestone: "verified_provider_arrival",
    payout_eligibility:
      "provider objectively verified at agreed service location/attendance point",
    provider_self_click_sufficient: false,
    quality_or_duration_is_normal_payout_trigger: false,
    no_show_blocks_payout: true
  },
  dispatch: {
    milestone: "verified_destination_arrival",
    payout_eligibility:
      "agreed A-to-B dispatch reaches destination and arrival is objectively verified",
    provider_self_click_sufficient: false,
    post_arrival_work_quality_is_normal_payout_trigger: false
  }
});

const SHOPDROP_CONFIGURABLE_POLICY = {
  productInspectionWindowHours: null,
  commissionEngine: "CONFIGURABLE_TIERED_RULES"
};

// Production-safe V26 helpers.
async function shopdropLoadTaxonomy(){
 const r=await fetch("./taxonomy.json",{cache:"no-store"}); if(!r.ok)throw new Error("Taxonomy unavailable"); return r.json();
}
async function renderMainMenuCategories(target){
 const host=typeof target==="string"?document.querySelector(target):target;if(!host)return;
 const data=await shopdropLoadTaxonomy();const cats=Array.isArray(data)?data:(data.departments||data.categories||[]);
 host.replaceChildren();
 for(const c of cats){
  const d=document.createElement("details"),s=document.createElement("summary");s.textContent=c.name||c.label||"Category";d.appendChild(s);
  const w=document.createElement("div"),all=document.createElement("a");
  const categoryName=c.slug||c.id||c.name||"";
  all.href=`./categories.html?category=${encodeURIComponent(categoryName)}`;all.textContent=`Browse All ${c.name||c.label||""}`.trim();w.appendChild(all);
  for(const sub of (c.subcategories||[])){const subName=typeof sub==="string"?sub:(sub.slug||sub.id||sub.name||"");const a=document.createElement("a");a.href=`./categories.html?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(subName)}`;a.textContent=typeof sub==="string"?sub:(sub.name||sub.label||"Subcategory");w.appendChild(a);}
  d.appendChild(w);host.appendChild(d);
 }
}
function renderMobileMenuCategoryAccordion(target){return renderMainMenuCategories(target);}
function renderHomepageCategories(target){return renderMainMenuCategories(target);}
function withSubmitLock(button,fn){if(!button||button.dataset.busy==="true")return;button.dataset.busy="true";button.disabled=true;return Promise.resolve().then(fn).finally(()=>{button.dataset.busy="false";button.disabled=false;});}
function saveLocalDraft(scope,data,id="new"){localStorage.setItem(`shopdrop:draft:${scope}:${id}`,JSON.stringify({data,saved_at:new Date().toISOString()}));}
function toggleSavedListing(id){const k="shopdrop:saved-listings",s=new Set(JSON.parse(localStorage.getItem(k)||"[]"));s.has(id)?s.delete(id):s.add(id);localStorage.setItem(k,JSON.stringify([...s]));return s.has(id);}
async function runUserAction(button,fn){return withSubmitLock(button,fn);}

// V26_10_LOCAL_RENDER_REPAIR
function renderBrowseHeading(target,title,count){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;
 el.textContent=count==null?String(title||"Browse"):`${title||"Browse"} (${count})`;
}
function renderBrowsePagination(target,page,total,pageSize=SHOPDROP_BROWSE_PAGE_SIZE||24,onPage){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;
 const pages=Math.max(1,Math.ceil((Number(total)||0)/(Number(pageSize)||24)));el.replaceChildren();
 for(let i=1;i<=pages;i++){const b=document.createElement("button");b.type="button";b.textContent=String(i);b.disabled=i===Number(page||1);b.addEventListener("click",()=>onPage?.(i));el.appendChild(b);}
}
function renderListingAvailabilityNotice(target,state){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;
 const labels={available:"Available",reserved:"Reserved / payment pending",sale_in_progress:"Sale in progress",sold:"Sold",paused:"Temporarily unavailable",withdrawn:"Unavailable"};
 el.textContent=labels[state]||String(state||"Availability pending");
}
function renderNotifications(target,items=[]){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;el.replaceChildren();
 if(!items.length){el.textContent="No notifications.";return;}
 for(const x of items){const p=document.createElement("p");p.textContent=x.message||x.title||String(x);el.appendChild(p);}
}
function renderProviderCalendar(target,slots=[]){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;el.replaceChildren();
 if(!slots.length){el.textContent="No availability has been added yet.";return;}
 for(const s of slots){const row=document.createElement("div");row.textContent=`${s.date||""} ${s.start||""}–${s.end||""} ${s.status||""}`.trim();el.appendChild(row);}
}
function renderTransactionReceipt(target,tx={}){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;
 const refs=[tx.order_reference,tx.payment_reference,tx.shipment_reference,tx.payout_reference].filter(Boolean);
 el.textContent=refs.length?refs.join(" • "):"Transaction details will be available after a completed Shop&Drop transaction.";
}
function renderSharedMarketplaceCard(listing={}){
 const a=document.createElement("a");a.className="shopdrop-market-card";
 a.href=listing.href||`./product.html?id=${encodeURIComponent(listing.id||"")}`;
 const img=document.createElement("img");img.loading="lazy";img.decoding="async";img.alt=listing.title||"Shop&Drop listing";if(listing.image_url)img.src=listing.image_url;
 const h=document.createElement("h3");h.textContent=listing.title||"Listing";
 const p=document.createElement("p");p.textContent=listing.price_display||listing.price||"";
 a.append(img,h,p);return a;
}
function renderProductCards(target,listings=[]){
 const el=typeof target==="string"?document.querySelector(target):target;if(!el)return;el.replaceChildren();
 listings.slice(0,SHOPDROP_BROWSE_PAGE_SIZE||24).forEach(x=>el.appendChild(renderSharedMarketplaceCard(x)));
}


// V26_11_POINT1_MAIN_MENU_CATEGORY_REPAIR
// Uses the authoritative taxonomy.json and the existing Main Menu category mount.
async function shopdropMountMainMenuCategories(){
  const host =
    document.getElementById("mainMenuCategories") ||
    document.getElementById("v26NestedCategoryMenu") ||
    document.querySelector("[data-v26-category-menu]");
  if(!host) return false;

  // Earlier builds could leave the correct mount hidden, producing the blank block seen live.
  host.hidden=false;
  host.removeAttribute("hidden");
  host.setAttribute("aria-label","Product categories");
  host.classList.add("shopdrop-main-menu-categories");

  try{
    await renderMainMenuCategories(host);
    return host.children.length>0;
  }catch(err){
    console.error("Shop&Drop category menu could not load",err);
    host.replaceChildren();
    const fallback=document.createElement("a");
    fallback.href="./categories.html";
    fallback.textContent="Browse Product Categories";
    host.appendChild(fallback);
    return false;
  }
}
document.addEventListener("DOMContentLoaded",shopdropMountMainMenuCategories);
