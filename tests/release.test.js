import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../app/server.js',import.meta.url),'utf8');
test('live payment callback remains disabled',()=>assert.match(server,/Live payment webhook disabled/));
test('health endpoint is present',()=>assert.match(server,/\/api\/health/));
test('V23 security headers are present',()=>{assert.match(server,/Content-Security-Policy/);assert.match(server,/X-Content-Type-Options/)});
test('V23 login throttling and origin checks are present',()=>{assert.match(server,/Too many login attempts/);assert.match(server,/Origin not allowed/)});
test('V24+ health version is present',()=>assert.match(server,/version:'(?:24\.(?:0|1|2)\.0|25\.0\.0)'/));

const home=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const seller=readFileSync(new URL('../public/seller.html',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../public/checkout.html',import.meta.url),'utf8');
test('V23 homepage menu is present',()=>{assert.match(home,/☰ Menu/);assert.match(home,/Seller \/ Service Provider Centre/);assert.match(home,/How Shop&Drop Works/)});
test('V23 seller preview validation is present',()=>{assert.match(seller,/Enter a product name/);assert.match(seller,/Preview mode: Seller Centre/)});
test('V23 worldwide checkout fields are present',()=>{assert.match(checkout,/State \/ Province \/ Region/);assert.match(checkout,/Country/);assert.match(checkout,/Preview order/)});

const tracking=readFileSync(new URL('../public/tracking.html',import.meta.url),'utf8');
const adminTracking=readFileSync(new URL('../public/admin-tracking.html',import.meta.url),'utf8');
test('V23.1 customer tracking portal is present',()=>{assert.match(tracking,/Track My Order/);assert.match(tracking,/Seller payout eligible/)});
test('V23.1 admin transaction tracking portal is present',()=>{assert.match(adminTracking,/Transaction Tracking/);assert.match(adminTracking,/Shop&Drop (?:commission|marketplace service fee)/)});
test('V23.1 homepage exposes tracking and preview search feedback',()=>{assert.match(home,/Track My Order/);assert.match(home,/Search preview/)});

const migration24=readFileSync(new URL('../db/v24_migration.sql',import.meta.url),'utf8');
const services=readFileSync(new URL('../public/services.html',import.meta.url),'utf8');
test('V24 multi-seller fulfilment schema is present',()=>{assert.match(migration24,/fulfilment_groups/);assert.match(migration24,/fulfilment_shipments/);assert.match(migration24,/notifications/)});
test('V24 service marketplace schema supports flexible pricing',()=>{assert.match(migration24,/service_listings/);assert.match(migration24,/kilometre/);assert.match(migration24,/gig/);assert.match(migration24,/treatment/)});
test('V24 services page includes agreed service categories',()=>{assert.match(services,/Pest Control/);assert.match(services,/Cleaning Services/);assert.match(services,/Entertainment & Performers/);assert.match(services,/Special Occasion Vehicles/)});
test('V24 server supports service and tracking APIs',()=>{assert.match(server,/\/api\/services/);assert.match(server,/\/api\/service-bookings\/preview/);assert.match(server,/\/api\/order-tracking/)});
test('V25.4 homepage separates Other Services and dispatching',()=>{assert.match(home,/>Other Services</);assert.match(home,/Dispatching & Transport/)});

const migration241=readFileSync(new URL('../db/v24_1_migration.sql',import.meta.url),'utf8');
const account241=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
const seller241=readFileSync(new URL('../public/seller.html',import.meta.url),'utf8');
const adminMarket241=readFileSync(new URL('../public/admin-marketplace.html',import.meta.url),'utf8');
test('V24.1+ configurable fee engine is present',()=>{assert.match(server,/serviceFeeQuote/);assert.match(server,/\/api\/service-fee\/preview/)});
test('V24.1 progressive commission schema is configurable',()=>{assert.match(migration241,/commission_rules/);assert.match(migration241,/rate_basis_points/);assert.match(migration241,/commission_snapshots/)});
test('V24.1 returns disputes and risk exception schema is present',()=>{assert.match(migration241,/return_disputes/);assert.match(migration241,/risk_flags/);assert.match(server,/\/api\/admin\/exceptions/)});
test('V24.1 pet supplies are product categories not service categories',()=>{assert.match(migration241,/Pet Supplies/);assert.match(migration241,/Fish & Aquarium/);assert.match(services,/Pet Services/);assert.match(services,/physical pet products remain in Product listings/)});
test('V24.1 seller service form has controlled category description scheduling and minimum booking',()=>{assert.match(seller241,/Choose service category/);assert.match(seller241,/Service description/);assert.match(seller241,/Minimum booking \/ units/);assert.match(seller241,/Available from/)});
test('V24.1 account exposes tracking feedback sharing and disputes',()=>{assert.match(account241,/Track order/);assert.match(account241,/Leave feedback/);assert.match(account241,/Tell a Friend/);assert.match(account241,/Returns & Disputes Centre/)});
test('V24.1 admin is automation-first and exception-based',()=>{assert.match(adminMarket241,/Exception Queue/);assert.match(adminMarket241,/Marketplace Service Fee Rules/);assert.match(adminMarket241,/owns no seller inventory/)});
test('V24.1 homepage restores admin sign in and inclusive overview',()=>{assert.match(home,/Administrator Sign In/);assert.match(home,/private individuals/);assert.match(home,/Registration and listing are FREE/)});

const taxonomy242=readFileSync(new URL('../public/taxonomy.json',import.meta.url),'utf8');
const migration242=readFileSync(new URL('../db/v24_2_taxonomy.sql',import.meta.url),'utf8');
test('V24.2 master taxonomy covers major Shop&Drop departments',()=>{for(const x of ['Automotive','Baby & Toddler','Beauty & Personal Care','Cellphones & Wearables','Computers & Tablets','Fashion','Home & Kitchen','Pet Supplies','Arts, Crafts & Handmade','Industrial & Business Supplies'])assert.match(taxonomy242,new RegExp(x.replace(/[&]/g,'&')))});
test('V24.2 taxonomy migration is idempotent and hierarchical',()=>{assert.match(migration242,/NOT EXISTS/);assert.match(migration242,/parent_id/);assert.match(migration242,/Pet Supplies/)});
test('V24.2 seller product form uses controlled category selection',()=>{assert.match(seller241,/Choose main category/);assert.match(seller241,/taxonomy\.json/)});

const conditionMigration2421=readFileSync(new URL('../db/v24_2_1_condition.sql',import.meta.url),'utf8');
test('V24.2.1 second-hand is a condition filter across the master taxonomy',()=>{assert.doesNotMatch(taxonomy242,/\"name\": \"Second-Hand & Pre-Owned\"/);assert.match(home,/Second-Hand & Pre-Owned/);assert.match(home,/condition=used/);assert.match(home,/condition=refurbished/);assert.match(conditionMigration2421,/active=false/)});
test('V24.2.1 seller captures product condition',()=>{for(const x of ['New','Like New','Used / Pre-Owned','Refurbished'])assert.match(seller241,new RegExp(x));assert.match(server,/p\.condition=\$/)});

// V24.2.2 handmade furniture taxonomy
test('V24.2.2 adds handmade furniture and woodwork branches',()=>{for(const x of ['Handmade Furniture — Tables & Desks','Handmade Furniture — Custom & Bespoke Furniture','Handmade Furniture — Outdoor & Garden Furniture']) assert.match(taxonomy242,new RegExp(x.replace(/[&]/g,'&')))})


const migration25=readFileSync(new URL('../db/v25_transaction_orchestration.sql',import.meta.url),'utf8');
const payment25=readFileSync(new URL('../integrations/payment.js',import.meta.url),'utf8');
const shipping25=readFileSync(new URL('../integrations/shipping.js',import.meta.url),'utf8');
const providers25=readFileSync(new URL('../integrations/provider-registry.js',import.meta.url),'utf8');
test('V25 uses LI SD ST and SH transaction references',()=>{for(const x of ['listing_ref','sd_order_ref','st_ref','shipment_ref'])assert.match(migration25,new RegExp(x));assert.match(server,/SD-/);assert.match(server,/ST-/);assert.match(server,/SH-/)});
test('V25 retires testing-only fixed 10 percent seed',()=>{assert.match(migration25,/rate_basis_points=1000/);assert.match(migration25,/active=false/);assert.doesNotMatch(server,/amount\*\.10/)});
test('V25 seller sees target proceeds fee and published price model',()=>{assert.match(seller,/Amount you want to receive/);assert.match(seller,/marketplace service fee/);assert.match(seller,/final customer price/);assert.match(server,/sellerTargetCents/);assert.match(server,/publishedPriceCents/)});
test('V25 payment boundary supports marketplace collection and seller payout',()=>{assert.match(payment25,/oneBuyerCheckout/);assert.match(payment25,/createSellerPayout/);assert.match(payment25,/raw PAN\/CVV/)});
test('V25 provider registry includes South African and optional international paths',()=>{assert.match(providers25,/Stitch/);assert.match(providers25,/Payfast/);assert.match(providers25,/FNB eCommerce/);assert.match(providers25,/PayPal/)});
test('V25 courier boundary preserves seller dispatch and integrated future mode',()=>{assert.match(shipping25,/Seller packs\/dispatches/);assert.match(shipping25,/Seller-arranged courier/);assert.match(migration25,/booking_mode/);assert.match(migration25,/courier_options/)});
test('V25 notification delivery logging supports automated channels',()=>{assert.match(migration25,/notification_delivery_log/);assert.match(providers25,/WhatsApp Business Platform/);assert.match(providers25,/SMS provider/)});


test('V25.1 progressive marketplace service fee test schedule is present',()=>{
 const feeSql=readFileSync(new URL('../db/v25_1_fee_schedule.sql',import.meta.url),'utf8');
 assert.match(feeSql,/100000,800/);assert.match(feeSql,/500000,650/);assert.match(feeSql,/2000000,500/);assert.match(feeSql,/NULL,400/);
 assert.match(seller,/function previewServiceFee/);assert.match(seller,/Math\.max\(1000,fee\)/);
 assert.match(server,/SHOPDROP_MIN_SERVICE_FEE_CENTS\|\|1000/);
});


test('V25.2 service listings use transparent provider target plus fee model',()=>{
 const migration252=readFileSync(new URL('../db/v25_2_service_fee_transparency.sql',import.meta.url),'utf8');
 assert.match(seller,/Amount you want to receive per unit/);assert.match(seller,/serviceFeePreview/);assert.match(seller,/final customer rate/);
 assert.match(server,/sellerTargetUnitCents/);assert.match(server,/seller_target_unit_cents/);assert.match(server,/published_unit_price_cents/);
 assert.match(migration252,/shopdrop_service_fee_unit_cents/);
});


const dispatch253=readFileSync(new URL('../public/dispatching.html',import.meta.url),'utf8');
const migration253=readFileSync(new URL('../db/v25_3_dispatch_completion.sql',import.meta.url),'utf8');
test('V25.4 separates Other Services from dispatching',()=>{assert.match(services,/<h1>Other Services<\/h1>/);assert.doesNotMatch(services,/<b>Transport & Dispatch<\/b>/);assert.match(dispatch253,/Request Dispatching & Transport/);assert.match(home,/dispatching\.html/)});
test('V25.3 dispatching captures dedicated transport request details',()=>{for(const x of ['Collection location','Delivery destination','Load description','Approximate weight','Special requirements'])assert.match(dispatch253,new RegExp(x));assert.match(migration253,/dispatch_requests/);assert.match(migration253,/dispatch_offers/);assert.match(migration253,/request_ref/)});
test('V25.3 tracking and disputes use explicit SD references',()=>{assert.match(tracking,/Shop&Drop SD Order Number/);const returns253=readFileSync(new URL('../public/returns.html',import.meta.url),'utf8');assert.match(returns253,/SD Order and ST seller transaction automatically/)});
test('V25.3 completion supports buyer confirmation plus automatic protection expiry',()=>{assert.match(tracking,/Buyer may confirm received or report a problem/);assert.match(tracking,/automatically after the protection period/);assert.match(migration253,/buyer_confirmed_at/);assert.match(migration253,/protection_deadline/)});
test('V25.3 checkout keeps buyer total transparent without exposing seller allocation',()=>{assert.match(checkout,/each ST seller portion/);assert.match(checkout,/SD Order total/);assert.match(checkout,/Applicable taxes/)});

// V25.4 Other Services discovery and dispatch preview
test('V25.4 Other Services cards drive Shop&Drop listing search',()=>{assert.match(services,/service-card/);assert.match(services,/data-category=\"Pest Control\"/);assert.match(services,/approved Shop&Drop service listing/);assert.match(services,/Customers browse only Shop&Drop service listings/)});
test('V25.4 dispatch preview shows request summary and unit guidance',()=>{assert.match(dispatch253,/Dispatch Request Preview/);assert.match(dispatch253,/Approximate weight \(kg, optional\)/);assert.match(dispatch253,/Live submission will create the DR reference/)});

const categories255=readFileSync(new URL('../public/categories.html',import.meta.url),'utf8');
const help255=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');
test('V25.5 main menu is a functional first-time visitor map',()=>{for(const x of ['Shop New Products','Second-Hand & Pre-Owned','Categories & Search','Other Services','Dispatching & Transport','Sell a Product — FREE','List a Service — FREE','My Bag / Checkout','My Orders','Track My Order','Returns & Disputes','Seller / Service Provider Centre','How Shop&Drop Works'])assert.match(home,new RegExp(x.replace(/[&]/g,'&')));assert.match(home,/categories\.html/);assert.match(home,/help\.html/)});
test('V25.5 categories hub reuses core ShopDrop destinations',()=>{assert.match(categories255,/New Products/);assert.match(categories255,/Second-Hand & Pre-Owned/);assert.match(categories255,/services\.html/);assert.match(categories255,/dispatching\.html/);assert.match(categories255,/taxonomy\.json/)});
test('V25.5 help page explains products services dispatch references and protection',()=>{for(const x of ['Sell a product — FREE','Other Services','Dispatching & Transport','SD Order','ST reference','protection period'])assert.match(help255,new RegExp(x))});
test('V25.5 Other Services taxonomy is expanded and controlled',()=>{for(const x of ['Automotive Services','Cleaning Services','Personal & Beauty Services','Pet Services','Repair & Maintenance Services','Other Service — requires approval']){assert.match(services,new RegExp(x));assert.match(seller,new RegExp(x))}});
test('V25.5 checkout preview gives explicit empty-bag feedback',()=>assert.match(checkout,/Your bag is empty in this preview/));
