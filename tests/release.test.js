import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../app/server.js',import.meta.url),'utf8');
test('live payment callback remains disabled',()=>assert.match(server,/Live payment webhook disabled/));
test('health endpoint is present',()=>assert.match(server,/\/api\/health/));
test('V22 security headers are present',()=>{assert.match(server,/Content-Security-Policy/);assert.match(server,/X-Content-Type-Options/)});
test('V22 login throttling and origin checks are present',()=>{assert.match(server,/Too many login attempts/);assert.match(server,/Origin not allowed/)});
test('V22 health version is present',()=>assert.match(server,/version:'22\.0\.0'/));
