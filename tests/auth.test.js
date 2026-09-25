import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,newSessionToken,sha256,verifyHmac} from '../security/auth.js';
import {createHmac} from 'node:crypto';
test('password hash verifies correct password and rejects incorrect password',()=>{
 const h=hashPassword('A-long-demo-password!');
 assert.notEqual(h,'A-long-demo-password!');
 assert.equal(verifyPassword('A-long-demo-password!',h),true);
 assert.equal(verifyPassword('wrong',h),false);
});
test('session tokens are distinct and hash consistently',()=>{
 const a=newSessionToken(),b=newSessionToken();assert.notEqual(a,b);assert.equal(sha256(a),sha256(a));
});
test('webhook HMAC helper rejects bad signatures',()=>{
 const raw=JSON.stringify({order:'demo'}),secret='local-test-secret';
 const sig=createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifyHmac(raw,sig,secret),true);
 assert.equal(verifyHmac(raw,'0'.repeat(64),secret),false);
});
