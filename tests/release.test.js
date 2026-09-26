import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../app/server.js',import.meta.url),'utf8');
test('live payment callback remains disabled',()=>assert.match(server,/Live payment webhook disabled/));
test('health endpoint is present',()=>assert.match(server,/\/api\/health/));
test('V23 security headers are present',()=>{assert.match(server,/Content-Security-Policy/);assert.match(server,/X-Content-Type-Options/)});
test('V23 login throttling and origin checks are present',()=>{assert.match(server,/Too many login attempts/);assert.match(server,/Origin not allowed/)});
test('V23 health version is present',()=>assert.match(server,/version:'23\.0\.0'/));

const home=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const seller=readFileSync(new URL('../public/seller.html',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../public/checkout.html',import.meta.url),'utf8');
test('V23 homepage menu is present',()=>{assert.match(home,/☰ Menu/);assert.match(home,/Seller Centre/);assert.match(home,/Help \/ How Shop&Drop Works/)});
test('V23 seller preview validation is present',()=>{assert.match(seller,/Enter a product name/);assert.match(seller,/Preview mode: Seller Centre/)});
test('V23 worldwide checkout fields are present',()=>{assert.match(checkout,/State \/ Province \/ Region/);assert.match(checkout,/Country/);assert.match(checkout,/Preview order/)});
