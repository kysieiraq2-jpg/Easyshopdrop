import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../app/server.js',import.meta.url),'utf8');
test('live payment callback remains disabled',()=>assert.match(server,/Live payment webhook disabled/));
test('health endpoint is present',()=>assert.match(server,/\/api\/health/));
test('V23 security headers are present',()=>{assert.match(server,/Content-Security-Policy/);assert.match(server,/X-Content-Type-Options/)});
test('V23 login throttling and origin checks are present',()=>{assert.match(server,/Too many login attempts/);assert.match(server,/Origin not allowed/)});
test('V24 health version is present',()=>assert.match(server,/version:'24\.0\.0'/));

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
