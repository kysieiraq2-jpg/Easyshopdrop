import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../app/server.js',import.meta.url),'utf8');
test('live payment callback remains disabled',()=>assert.match(server,/Live payment webhook disabled/));
test('health endpoint is present',()=>assert.match(server,/\/api\/health/));
test('V23 security headers are present',()=>{assert.match(server,/Content-Security-Policy/);assert.match(server,/X-Content-Type-Options/)});
test('V23 login throttling and origin checks are present',()=>{assert.match(server,/Too many login attempts/);assert.match(server,/Origin not allowed/)});
test('V24+ health version is present',()=>assert.match(server,/version:'24\.(?:0|1|2)\.0'/));

const home=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const seller=readFileSync(new URL('../public/seller.html',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../public/checkout.html',import.meta.url),'utf8');
test('V23 homepage menu is present',()=>{assert.match(home,/☰ Menu/);assert.match(home,/Seller Centre/);assert.match(home,/Help \/ How Shop&Drop Works/)});
test('V23 seller preview validation is present',()=>{assert.match(seller,/Enter a product name/);assert.match(seller,/Preview mode: Seller Centre/)});
test('V23 worldwide checkout fields are present',()=>{assert.match(checkout,/State \/ Province \/ Region/);assert.match(checkout,/Country/);assert.match(checkout,/Preview order/)});

const tracking=readFileSync(new URL('../public/tracking.html',import.meta.url),'utf8');
const adminTracking=readFileSync(new URL('../public/admin-tracking.html',import.meta.url),'utf8');
test('V23.1 customer tracking portal is present',()=>{assert.match(tracking,/Track My Order/);assert.match(tracking,/Seller payout eligible/)});
test('V23.1 admin transaction tracking portal is present',()=>{assert.match(adminTracking,/Transaction Tracking/);assert.match(adminTracking,/Shop&Drop commission/)});
test('V23.1 homepage exposes tracking and preview search feedback',()=>{assert.match(home,/Track My Order/);assert.match(home,/Search preview/)});

const migration24=readFileSync(new URL('../db/v24_migration.sql',import.meta.url),'utf8');
const services=readFileSync(new URL('../public/services.html',import.meta.url),'utf8');
test('V24 multi-seller fulfilment schema is present',()=>{assert.match(migration24,/fulfilment_groups/);assert.match(migration24,/fulfilment_shipments/);assert.match(migration24,/notifications/)});
test('V24 service marketplace schema supports flexible pricing',()=>{assert.match(migration24,/service_listings/);assert.match(migration24,/kilometre/);assert.match(migration24,/gig/);assert.match(migration24,/treatment/)});
test('V24 services page includes agreed service categories',()=>{assert.match(services,/Pest Control/);assert.match(services,/Once-off Cleaning/);assert.match(services,/Entertainment & Performers/);assert.match(services,/Special Occasion Vehicles/)});
test('V24 server supports service and tracking APIs',()=>{assert.match(server,/\/api\/services/);assert.match(server,/\/api\/service-bookings\/preview/);assert.match(server,/\/api\/order-tracking/)});
test('V24 homepage exposes services',()=>assert.match(home,/Services & Dispatching/));

const migration241=readFileSync(new URL('../db/v24_1_migration.sql',import.meta.url),'utf8');
const account241=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
const seller241=readFileSync(new URL('../public/seller.html',import.meta.url),'utf8');
const adminMarket241=readFileSync(new URL('../public/admin-marketplace.html',import.meta.url),'utf8');
test('V24.1 health version and configurable commission engine are present',()=>{assert.match(server,/version:'24\.(?:1|2)\.0'/);assert.match(server,/commissionQuote/);assert.match(server,/\/api\/commission\/preview/)});
test('V24.1 progressive commission schema is configurable',()=>{assert.match(migration241,/commission_rules/);assert.match(migration241,/rate_basis_points/);assert.match(migration241,/commission_snapshots/)});
test('V24.1 returns disputes and risk exception schema is present',()=>{assert.match(migration241,/return_disputes/);assert.match(migration241,/risk_flags/);assert.match(server,/\/api\/admin\/exceptions/)});
test('V24.1 pet supplies are product categories not service categories',()=>{assert.match(migration241,/Pet Supplies/);assert.match(migration241,/Fish & Aquarium/);assert.doesNotMatch(services,/Pet Services/)});
test('V24.1 seller service form has controlled category description scheduling and minimum booking',()=>{assert.match(seller241,/Choose service category/);assert.match(seller241,/Service description/);assert.match(seller241,/Minimum booking \/ units/);assert.match(seller241,/Available from/)});
test('V24.1 account exposes tracking feedback sharing and disputes',()=>{assert.match(account241,/Track order/);assert.match(account241,/Leave feedback/);assert.match(account241,/Tell a Friend/);assert.match(account241,/Returns & Disputes Centre/)});
test('V24.1 admin is automation-first and exception-based',()=>{assert.match(adminMarket241,/Exception Queue/);assert.match(adminMarket241,/Commission Rules/);assert.match(adminMarket241,/owns no seller inventory/)});
test('V24.1 homepage restores admin sign in and inclusive overview',()=>{assert.match(home,/Administrator Sign In/);assert.match(home,/private individuals/);assert.match(home,/Registration and listing are FREE/)});

const taxonomy242=readFileSync(new URL('../public/taxonomy.json',import.meta.url),'utf8');
const migration242=readFileSync(new URL('../db/v24_2_taxonomy.sql',import.meta.url),'utf8');
test('V24.2 master taxonomy covers major Shop&Drop departments',()=>{for(const x of ['Automotive','Baby & Toddler','Beauty & Personal Care','Cellphones & Wearables','Computers & Tablets','Fashion','Home & Kitchen','Pet Supplies','Arts, Crafts & Handmade','Industrial & Business Supplies'])assert.match(taxonomy242,new RegExp(x.replace(/[&]/g,'&')))});
test('V24.2 taxonomy migration is idempotent and hierarchical',()=>{assert.match(migration242,/NOT EXISTS/);assert.match(migration242,/parent_id/);assert.match(migration242,/Pet Supplies/)});
test('V24.2 seller product form uses controlled category selection',()=>{assert.match(seller241,/Choose product category/);assert.match(seller241,/taxonomy\.json/)});

const conditionMigration2421=readFileSync(new URL('../db/v24_2_1_condition.sql',import.meta.url),'utf8');
test('V24.2.1 second-hand is a condition filter across the master taxonomy',()=>{assert.doesNotMatch(taxonomy242,/\"name\": \"Second-Hand & Pre-Owned\"/);assert.match(home,/Second-Hand & Pre-Owned/);assert.match(home,/condition=used/);assert.match(home,/condition=refurbished/);assert.match(conditionMigration2421,/active=false/)});
test('V24.2.1 seller captures product condition',()=>{for(const x of ['New','Like New','Used / Pre-Owned','Refurbished'])assert.match(seller241,new RegExp(x));assert.match(server,/p\.condition=\$/)});

// V24.2.2 handmade furniture taxonomy
test('V24.2.2 adds handmade furniture and woodwork branches',()=>{for(const x of ['Handmade Furniture — Tables & Desks','Handmade Furniture — Custom & Bespoke Furniture','Handmade Furniture — Outdoor & Garden Furniture']) assert.match(taxonomy242,new RegExp(x.replace(/[&]/g,'&')))})
