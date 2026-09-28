import { integrationStatus } from '../integrations/provider-registry.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { hashPassword, verifyPassword, newSessionToken, sha256, verifyHmac } from '../security/auth.js';
import { paymentAdapter } from '../integrations/payment.js';
import { shippingAdapter } from '../integrations/shipping.js';
const {Pool}=pg;
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const PORT=Number(process.env.PORT||3000);
const IS_PROD=process.env.NODE_ENV==='production';
const MAX_BODY_BYTES=Number(process.env.MAX_BODY_BYTES||262144);
const PUBLIC_ORIGIN=(process.env.PUBLIC_ORIGIN||'').replace(/\/$/,'');
const loginAttempts=new Map();

function securityHeaders(){return {
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
 ...(IS_PROD?{'Strict-Transport-Security':'max-age=31536000; includeSubDomains'}:{})
}}
function json(res,c,d,h={}){res.writeHead(c,{...securityHeaders(),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...h});res.end(JSON.stringify(d))}
async function body(req){let s='',n=0;for await(const x of req){n+=x.length;if(n>MAX_BODY_BYTES){let e=Error('Request body too large');e.statusCode=413;throw e}s+=x}return s}
function requestOriginAllowed(req){if(!PUBLIC_ORIGIN)return true;const o=req.headers.origin;if(!o)return true;return o===PUBLIC_ORIGIN}
function rateKey(req,scope){return `${scope}:${req.socket.remoteAddress||'unknown'}`}
function rateLimited(req,scope,limit=10,windowMs=15*60*1000){const k=rateKey(req,scope),now=Date.now(),old=loginAttempts.get(k)||[];const fresh=old.filter(t=>now-t<windowMs);fresh.push(now);loginAttempts.set(k,fresh);return fresh.length>limit}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''))}
function strongPassword(v){v=String(v||'');return v.length>=12&&v.length<=128&&/[A-Za-z]/.test(v)&&/\d/.test(v)}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{let i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
async function user(req){let t=cookies(req).esd_session;if(!t)return null;let r=await pool.query(`SELECT u.id,u.email,u.role,u.full_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[sha256(t)]);return r.rows[0]||null}
function okRole(u,roles){return u&&roles.includes(u.role)}
async function audit(u,a,t,id,d={}){await pool.query(`INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)`,[u?.id||null,a,t,id||null,JSON.stringify(d)])}

async function serviceFeeQuote(db,amountCents,transactionType='product',categoryId=null){
 const amount=Math.max(0,Number(amountCents)||0); let r;
 try{r=await db.query(`SELECT threshold_from_cents,threshold_to_cents,rate_basis_points FROM commission_rules WHERE active=true AND (transaction_type='all' OR transaction_type=$1) AND (category_id IS NULL OR category_id=$2) ORDER BY (category_id IS NOT NULL) DESC,priority ASC,threshold_from_cents ASC`,[transactionType,categoryId]);}
 catch{const bps=Math.max(0,Number(process.env.SHOPDROP_DEFAULT_SERVICE_FEE_BPS||0));return {serviceFeeCents:Math.round(amount*bps/10000),effectiveBasisPoints:bps,rules:[{fallback:true,rateBasisPoints:bps}]};}
 if(!r.rows.length){const bps=Math.max(0,Number(process.env.SHOPDROP_DEFAULT_SERVICE_FEE_BPS||0));return {serviceFeeCents:Math.round(amount*bps/10000),effectiveBasisPoints:bps,rules:[{fallback:true,rateBasisPoints:bps}]};}
 let commission=0,used=[]; for(const x of r.rows){const from=Number(x.threshold_from_cents),to=x.threshold_to_cents==null?amount:Number(x.threshold_to_cents),portion=Math.max(0,Math.min(amount,to)-from);if(portion<=0)continue;commission+=Math.round(portion*Number(x.rate_basis_points)/10000);used.push({fromCents:from,toCents:x.threshold_to_cents==null?null:Number(x.threshold_to_cents),rateBasisPoints:Number(x.rate_basis_points),portionCents:portion});}
 if(!used.length){const bps=Math.max(0,Number(process.env.SHOPDROP_DEFAULT_SERVICE_FEE_BPS||0));commission=Math.round(amount*bps/10000);used=[{fallback:true,rateBasisPoints:bps,portionCents:amount}]} const minimumFeeCents=Math.max(0,Number(process.env.SHOPDROP_MIN_SERVICE_FEE_CENTS||1000));if(amount>0&&commission<minimumFeeCents){commission=minimumFeeCents;used.push({minimumFeeCents,minimumApplied:true});} return {serviceFeeCents:commission,effectiveBasisPoints:amount?Math.round(commission*10000/amount):0,rules:used};
}

async function signin(res,u){let t=newSessionToken(),h=Number(process.env.SESSION_TTL_HOURS||24);await pool.query(`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3||' hours')::interval)`,[u.id,sha256(t),h]);json(res,200,{user:u},{'Set-Cookie':`esd_session=${encodeURIComponent(t)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${h*3600}${IS_PROD?'; Secure':''}`})}

async function route(req,res){
 const u=new URL(req.url,`http://${req.headers.host}`), me=await user(req);
 try{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&!requestOriginAllowed(req))return json(res,403,{error:'Origin not allowed'});
  if(req.method==='GET'&&u.pathname==='/api/me')return json(res,200,{user:me});
  if(req.method==='POST'&&u.pathname==='/api/register'){
   let b=JSON.parse(await body(req)||'{}');if(rateLimited(req,'register',5))return json(res,429,{error:'Too many registration attempts. Try again later.'});if(!validEmail(b.email)||!strongPassword(b.password)||String(b.fullName||'').trim().length<2)return json(res,400,{error:'Valid name/email and a 12+ character password containing letters and numbers required'});
   try{let r=await pool.query(`INSERT INTO users(email,password_hash,role,full_name) VALUES($1,$2,'customer',$3) RETURNING id,email,role,full_name`,[b.email.toLowerCase().trim(),hashPassword(b.password),b.fullName.trim()]);return signin(res,r.rows[0])}catch(e){if(e.code==='23505')return json(res,409,{error:'Email already registered'});throw e}
  }
  if(req.method==='POST'&&u.pathname==='/api/login'){
   let b=JSON.parse(await body(req)||'{}');if(rateLimited(req,'login',10))return json(res,429,{error:'Too many login attempts. Try again later.'});let r=await pool.query(`SELECT id,email,password_hash,role,full_name FROM users WHERE email=$1`,[(b.email||'').toLowerCase().trim()]);
   if(!r.rows[0]||!verifyPassword(b.password||'',r.rows[0].password_hash))return json(res,401,{error:'Invalid email or password'});
   let x=r.rows[0];delete x.password_hash;return signin(res,x)
  }
  if(req.method==='POST'&&u.pathname==='/api/logout'){let t=cookies(req).esd_session;if(t)await pool.query(`DELETE FROM sessions WHERE token_hash=$1`,[sha256(t)]);return json(res,200,{ok:true},{'Set-Cookie':'esd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'})}

  if(req.method==='GET'&&u.pathname==='/api/categories'){
   let r=await pool.query(`SELECT c.id,c.name category,c.slug,c.parent_id,COALESCE(count(p.id),0)::int product_count FROM categories c LEFT JOIN products p ON (p.category_id=c.id OR (p.category_id IS NULL AND p.category=c.name)) AND p.status='approved' WHERE c.active=true GROUP BY c.id,c.name,c.slug,c.parent_id,c.sort_order ORDER BY c.sort_order,c.name`);return json(res,200,{categories:r.rows})
  }
  if(req.method==='GET'&&u.pathname==='/api/products'){
   let q=(u.searchParams.get('q')||'').trim(),cat=(u.searchParams.get('category')||'').trim(),condition=(u.searchParams.get('condition')||'').trim();
   let vals=[],w=[`p.status='approved'`];
   if(q){vals.push(`%${q}%`);w.push(`(p.name ILIKE $${vals.length} OR p.description ILIKE $${vals.length} OR p.sku ILIKE $${vals.length} OR EXISTS(SELECT 1 FROM categories cq WHERE cq.id=p.category_id AND cq.name ILIKE $${vals.length}))`)}
   if(cat){vals.push(cat);w.push(`(p.category=$${vals.length} OR EXISTS(SELECT 1 FROM categories cf WHERE cf.id=p.category_id AND (cf.slug=$${vals.length} OR cf.name=$${vals.length})))`)}
   if(condition){vals.push(condition);w.push(`p.condition=$${vals.length}`)}
   let r=await pool.query(`SELECT p.id,p.name,p.description,p.category,p.category_id,cat.name category_name,cat.slug category_slug,p.brand,p.condition,p.price_cents,p.currency_code,p.price_zar_cents,p.stock,p.image_url,p.is_special,p.special_price_cents,p.delivery_scope,p.created_at,COALESCE(round(avg(rv.rating),1),0) rating,count(rv.id)::int review_count FROM products p LEFT JOIN categories cat ON cat.id=p.category_id LEFT JOIN product_reviews rv ON rv.product_id=p.id AND rv.status='published' WHERE ${w.join(' AND ')} GROUP BY p.id,cat.name,cat.slug ORDER BY p.is_special DESC,p.created_at DESC`,vals);
   return json(res,200,{products:r.rows})
  }
  if(req.method==='GET'&&u.pathname.startsWith('/api/products/')){
   let id=u.pathname.split('/').pop(),r=await pool.query(`SELECT p.id,p.name,p.description,p.category,p.brand,p.condition,p.price_cents,p.currency_code,p.price_zar_cents,p.stock,p.image_url,p.is_special,p.special_price_cents,p.delivery_scope,p.created_at,COALESCE(round(avg(rv.rating),1),0) rating,count(rv.id)::int review_count FROM products p LEFT JOIN product_reviews rv ON rv.product_id=p.id AND rv.status='published' WHERE p.id=$1 AND p.status='approved' GROUP BY p.id`,[id]);
   if(!r.rows[0])return json(res,404,{error:'Product not found'});let reviews=await pool.query(`SELECT rv.rating,rv.review_text,rv.created_at,'Verified buyer' AS reviewer FROM product_reviews rv WHERE rv.product_id=$1 AND rv.status='published' ORDER BY rv.created_at DESC`,[id]);return json(res,200,{product:r.rows[0],reviews:reviews.rows})
  }

  if(req.method==='GET'&&u.pathname==='/api/cart'){
   if(!me)return json(res,401,{error:'Login required'});let r=await pool.query(`SELECT c.product_id,c.quantity,p.name,p.price_cents,p.stock,p.image_url FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=$1 AND p.status='approved'`,[me.id]);return json(res,200,{items:r.rows})
  }
  if(req.method==='POST'&&u.pathname==='/api/cart'){
   if(!me)return json(res,401,{error:'Login required'});let b=JSON.parse(await body(req)||'{}');let q=Number(b.quantity);if(!b.productId||!Number.isInteger(q)||q<0)return json(res,400,{error:'Invalid cart item'});
   if(q===0)await pool.query(`DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2`,[me.id,b.productId]);else {const avail=await pool.query(`SELECT stock,status FROM products WHERE id=$1`,[b.productId]);if(!avail.rows[0]||avail.rows[0].status!=='approved'||avail.rows[0].stock<q)return json(res,409,{error:'Requested quantity is not available'});await pool.query(`INSERT INTO cart_items(user_id,product_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now()`,[me.id,b.productId,q]);}
   return json(res,200,{ok:true})
  }

  if(req.method==='GET'&&u.pathname==='/api/wishlist'){
   if(!me)return json(res,401,{error:'Login required'});let r=await pool.query(`SELECT p.id,p.name,p.description,p.category,p.brand,p.condition,p.price_cents,p.currency_code,p.price_zar_cents,p.stock,p.image_url,p.is_special,p.special_price_cents,p.delivery_scope FROM wishlists w JOIN products p ON p.id=w.product_id WHERE w.user_id=$1 ORDER BY w.created_at DESC`,[me.id]);return json(res,200,{products:r.rows})
  }
  if(req.method==='POST'&&u.pathname==='/api/wishlist'){
   if(!me)return json(res,401,{error:'Login required'});let b=JSON.parse(await body(req)||'{}');if(b.remove)await pool.query(`DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2`,[me.id,b.productId]);else await pool.query(`INSERT INTO wishlists(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[me.id,b.productId]);return json(res,200,{ok:true})
  }

  
  if(req.method==='GET'&&u.pathname==='/api/addresses'){
   if(!me)return json(res,401,{error:'Login required'});let r=await pool.query(`SELECT * FROM customer_addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at DESC`,[me.id]);return json(res,200,{addresses:r.rows})
  }
  if(req.method==='POST'&&u.pathname==='/api/addresses'){
   if(!me)return json(res,401,{error:'Login required'});let b=JSON.parse(await body(req)||'{}');if(!b.label||!b.recipientName||!b.line1||!b.city||!b.province||!b.postalCode)return json(res,400,{error:'Complete address required'});
   let c=await pool.connect();try{await c.query('BEGIN');if(b.isDefault)await c.query(`UPDATE customer_addresses SET is_default=false WHERE user_id=$1`,[me.id]);let r=await c.query(`INSERT INTO customer_addresses(user_id,label,recipient_name,line1,line2,city,province,postal_code,phone,is_default) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[me.id,b.label,b.recipientName,b.line1,b.line2||'',b.city,b.province,b.postalCode,b.phone||'',!!b.isDefault]);await c.query('COMMIT');return json(res,201,{address:r.rows[0]})}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
  }

  if(req.method==='GET'&&u.pathname==='/api/integrations/options')return json(res,200,integrationStatus());
  if(req.method==='GET'&&u.pathname==='/api/checkout/preview'){
   if(!okRole(me,['customer']))return json(res,401,{error:'Customer login required'});
   const addressId=u.searchParams.get('addressId');
   const a=await pool.query(`SELECT id,label,recipient_name,line1,line2,city,province,postal_code,phone FROM customer_addresses WHERE id=$1 AND user_id=$2`,[addressId,me.id]);
   if(!a.rows[0])return json(res,400,{error:'Select one of your saved addresses'});
   const r=await pool.query(`SELECT c.quantity,p.price_cents,p.seller_target_cents,p.shopdrop_service_fee_cents,p.stock,p.status FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=$1`,[me.id]);
   if(!r.rows.length)return json(res,400,{error:'Cart is empty'});
   if(r.rows.some(x=>x.status!=='approved'||x.stock<x.quantity))return json(res,409,{error:'Cart includes unavailable stock'});
   const subtotalCents=r.rows.reduce((n,x)=>n+x.quantity*x.price_cents,0);const serviceFeeCents=r.rows.reduce((n,x)=>n+x.quantity*Number(x.shopdrop_service_fee_cents||0),0);const sellerProceedsCents=r.rows.reduce((n,x)=>n+x.quantity*Number(x.seller_target_cents??x.price_cents),0); return json(res,200,{address:a.rows[0],productSubtotalCents:subtotalCents,shopdropServiceFeeCents:serviceFeeCents,sellerProceedsCents,deliveryFeeCents:null,paymentProcessingFeeCents:null,totalCents:null,paymentAvailable:false,shippingQuoteAvailable:false,message:'Published product prices already include the disclosed Shop&Drop marketplace service fee. Live courier quote and payment processing require connected providers before a final payable total can be shown.'});
  }
  if(req.method==='POST'&&u.pathname==='/api/orders'){
   if(!okRole(me,['customer']))return json(res,401,{error:'Customer login required'});let b=JSON.parse(await body(req)||'{}'),items=b.items;
   if(!Array.isArray(items)||!items.length)return json(res,400,{error:'Cart is empty'});if(!b.addressId)return json(res,400,{error:'Select a saved delivery address'});let c=await pool.connect();try{await c.query('BEGIN');const addr=await c.query(`SELECT id,label,recipient_name,line1,line2,city,province,postal_code,phone FROM customer_addresses WHERE id=$1 AND user_id=$2`,[b.addressId,me.id]);if(!addr.rows[0])throw Error('Delivery address not found');let total=0,checked=[];
    for(let x of items){let r=await c.query(`SELECT id,seller_id,price_cents,seller_target_cents,shopdrop_service_fee_cents,stock,status FROM products WHERE id=$1 FOR UPDATE`,[x.productId]),p=r.rows[0],q=Number(x.quantity);if(!p||p.status!=='approved'||!Number.isInteger(q)||q<1||p.stock<q)throw Error('A product is unavailable or out of stock');total+=p.price_cents*q;checked.push({p,q})}
    const orderServiceFee=checked.reduce((n,x)=>n+(Number(x.p.shopdrop_service_fee_cents)||0)*x.q,0);const sellerTargets=checked.reduce((n,x)=>n+(Number(x.p.seller_target_cents)||Number(x.p.price_cents))*x.q,0);let o=await c.query(`INSERT INTO orders(customer_id,total_cents,product_subtotal_cents,shopdrop_commission_cents,seller_proceeds_cents,delivery_address_snapshot) VALUES($1,$2,$2,$3,$2-$3,$4) RETURNING *`,[me.id,total,orderServiceFee,JSON.stringify(addr.rows[0])]);await c.query(`UPDATE orders SET sd_order_ref='SD-'||to_char(now(),'YYYY')||'-'||lpad(nextval('shopdrop_order_seq')::text,8,'0') WHERE id=$1`,[o.rows[0].id]);o=await c.query('SELECT * FROM orders WHERE id=$1',[o.rows[0].id]);await c.query(`INSERT INTO commission_snapshots(order_id,gross_cents,commission_cents,effective_basis_points,rules_snapshot) VALUES($1,$2,$3,$4,$5)`,[o.rows[0].id,total,orderServiceFee,total?Math.round(orderServiceFee*10000/total):0,JSON.stringify([{source:'listing_fee_snapshots'}])]);for(let x of checked){await c.query(`INSERT INTO order_items(order_id,product_id,seller_id,quantity,unit_price_cents) VALUES($1,$2,$3,$4,$5)`,[o.rows[0].id,x.p.id,x.p.seller_id,x.q,x.p.price_cents]);await c.query(`UPDATE products SET stock=stock-$1,sold_out_at=CASE WHEN stock-$1=0 THEN now() ELSE NULL END,updated_at=now() WHERE id=$2`,[x.q,x.p.id])}await c.query(`INSERT INTO payments(order_id,amount_cents) VALUES($1,$2)`,[o.rows[0].id,total]);await c.query(`INSERT INTO shipments(order_id) VALUES($1)`,[o.rows[0].id]); await c.query(`INSERT INTO seller_payouts(seller_id,order_id,gross_cents,commission_cents,net_cents,status) SELECT oi.seller_id,$1,SUM(oi.quantity*oi.unit_price_cents)::int,SUM(oi.quantity*COALESCE(p.shopdrop_service_fee_cents,0))::int,SUM(oi.quantity*COALESCE(p.seller_target_cents,p.price_cents))::int,'held' FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1 GROUP BY oi.seller_id`,[o.rows[0].id]);
    await c.query(`INSERT INTO fulfilment_groups(order_id,seller_id,gross_cents,commission_cents,seller_proceeds_cents) SELECT $1,oi.seller_id,SUM(oi.quantity*oi.unit_price_cents)::int,SUM(oi.quantity*COALESCE(p.shopdrop_service_fee_cents,0))::int,SUM(oi.quantity*COALESCE(p.seller_target_cents,p.price_cents))::int FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1 GROUP BY oi.seller_id ON CONFLICT(order_id,seller_id) DO NOTHING`,[o.rows[0].id]);await c.query(`UPDATE fulfilment_groups SET st_ref=COALESCE(st_ref,'ST-'||to_char(now(),'YYYY')||'-'||lpad(nextval('shopdrop_seller_tx_seq')::text,8,'0')),shopdrop_service_fee_cents=commission_cents,seller_target_proceeds_cents=seller_proceeds_cents WHERE order_id=$1`,[o.rows[0].id]);
    await c.query(`INSERT INTO fulfilment_shipments(fulfilment_group_id,order_id,seller_id) SELECT id,order_id,seller_id FROM fulfilment_groups WHERE order_id=$1 ON CONFLICT DO NOTHING`,[o.rows[0].id]);await c.query(`UPDATE fulfilment_shipments SET shipment_ref=COALESCE(shipment_ref,'SH-'||to_char(now(),'YYYY')||'-'||lpad(nextval('shopdrop_shipment_seq')::text,8,'0')) WHERE order_id=$1`,[o.rows[0].id]);
    await c.query(`INSERT INTO notifications(user_id,order_id,fulfilment_group_id,channel,template_key,payload) SELECT fg.seller_id,fg.order_id,fg.id,'in_app','seller_order_received',jsonb_build_object('orderId',fg.order_id,'grossCents',fg.gross_cents) FROM fulfilment_groups fg WHERE fg.order_id=$1`,[o.rows[0].id]);
    await c.query(`DELETE FROM cart_items WHERE user_id=$1`,[me.id]);await c.query('COMMIT');return json(res,201,{order:o.rows[0],payment:await paymentAdapter.createPayment({orderId:o.rows[0].id,sdOrderRef:o.rows[0].sd_order_ref,amountCents:total}),deliveryFeeCents:null,finalTotalCents:null,message:'Demo order only. No payment collected, delivery quote or courier booking.'})
   }catch(e){await c.query('ROLLBACK');return json(res,400,{error:e.message})}finally{c.release()}
  }
  if(req.method==='GET'&&u.pathname==='/api/orders'){
   if(!me)return json(res,401,{error:'Login required'});let r=me.role==='customer'?await pool.query(`SELECT * FROM orders WHERE customer_id=$1 ORDER BY created_at DESC`,[me.id]):me.role==='seller'?await pool.query(`SELECT DISTINCT o.* FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.seller_id=$1 ORDER BY o.created_at DESC`,[me.id]):await pool.query(`SELECT * FROM orders ORDER BY created_at DESC`);return json(res,200,{orders:r.rows})
  }
  if(req.method==='GET'&&/^\/api\/orders\/[0-9a-f-]{36}$/.test(u.pathname)){
   if(!me)return json(res,401,{error:'Login required'});
   const id=u.pathname.split('/').pop();
   const r=await pool.query(`SELECT o.*,p.status payment_status,sh.status shipment_status,sh.tracking_number FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN shipments sh ON sh.order_id=o.id WHERE o.id=$1 AND (o.customer_id=$2 OR $3='admin' OR ($3='seller' AND EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.seller_id=$2)))`,[id,me.id,me.role]);
   if(!r.rows[0])return json(res,404,{error:'Order not found'});
   const items=await pool.query(`SELECT oi.product_id,oi.quantity,oi.unit_price_cents,p.name FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1 AND ($2='admin' OR $2='customer' OR oi.seller_id=$3)`,[id,me.role,me.id]);
   return json(res,200,{order:r.rows[0],items:items.rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/sellers/apply'){
   if(!okRole(me,['customer']))return json(res,403,{error:'Customer account required'});
   const b=JSON.parse(await body(req)||'{}'); const sellerType=String(b.sellerType||'individual'); const storeName=String(b.storeName||me.full_name||'Individual seller').trim(); if(!['individual','home_business','business','second_hand'].includes(sellerType))return json(res,400,{error:'Invalid seller type'}); if(storeName.length<2||storeName.length>100)return json(res,400,{error:'Seller/display name must be 2–100 characters'});
   const c=await pool.connect();try{await c.query('BEGIN');
    const existing=await c.query('SELECT 1 FROM seller_profiles WHERE user_id=$1',[me.id]);
    if(existing.rowCount){await c.query('ROLLBACK');return json(res,409,{error:'Seller application already exists'});}
    await c.query("INSERT INTO seller_profiles(user_id,store_name,status,seller_type,country_code,phone,whatsapp) VALUES($1,$2,'pending',$3,$4,$5,$6)",[me.id,storeName,sellerType,String(b.countryCode||''),String(b.phone||''),String(b.whatsapp||'')]);
    await c.query("UPDATE users SET role='seller' WHERE id=$1",[me.id]);await c.query('COMMIT');
    return json(res,201,{status:'pending',storeName});
   }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
  }
  if(req.method==='PATCH'&&/^\/api\/seller\/products\/[0-9a-f-]{36}$/.test(u.pathname)){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'});
   const b=JSON.parse(await body(req)||'{}');const id=u.pathname.split('/').pop();
   const price=Number(b.priceCents),stock=Number(b.stock),condition=String(b.condition||'new');
   if(!['new','like_new','used','refurbished'].includes(condition)||!Number.isSafeInteger(target)||target<0||!Number.isSafeInteger(stock)||stock<0||
      String(b.name||'').trim().length<2||String(b.category||'').trim().length<2)
      return json(res,400,{error:'Invalid product name, category, price or stock'});
   const image=String(b.imageUrl||'');
   if(image && (!(/^https:\/\/[^\s]+$/i.test(image)||/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image))||image.length>2048))return json(res,400,{error:'Image must be an HTTPS URL'});
   const r=await pool.query(`UPDATE products SET name=$1,category=$2,description=$3,price_cents=$4,stock=$5,image_url=$6,condition=$7,status='pending',updated_at=now() WHERE id=$8 AND seller_id=$9 RETURNING *`,
    [b.name.trim(),b.category.trim(),String(b.description||''),price,stock,image,condition,id,me.id]);
   return json(res,r.rowCount?200:404,r.rowCount?{product:r.rows[0]}:{error:'Product not found'});
  }
  // Local image storage is for development only; use managed object storage in production.
  if(req.method==='POST'&&u.pathname==='/api/seller/images'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'});
   const approved=await pool.query("SELECT 1 FROM seller_profiles WHERE user_id=$1 AND status='approved'",[me.id]);
   if(!approved.rowCount)return json(res,403,{error:'Seller not approved'});
   if(Number(req.headers['content-length']||0)>3000000)return json(res,413,{error:'Image too large'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>3000000)return json(res,413,{error:'Image too large'});}
   const b=JSON.parse(raw||'{}'), encoded=String(b.base64||'');
   if(encoded.length>2800000||!encoded||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return json(res,400,{error:'Invalid image encoding'});
   const bytes=Buffer.from(encoded,'base64');if(bytes.length>2000000||bytes.length<20)return json(res,400,{error:'Images must be under 2 MB'});
   const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
   if(!jpg&&!png&&!webp)return json(res,400,{error:'Only JPEG, PNG and WebP images are supported'});
   const ext=jpg?'jpg':png?'png':'webp',dir=path.resolve(__dirname,'..','public','uploads');
   fs.mkdirSync(dir,{recursive:true});const filename=crypto.randomUUID()+'.'+ext;
   fs.writeFileSync(path.join(dir,filename),bytes,{flag:'wx'});
   return json(res,201,{imageUrl:'/uploads/'+filename,note:'Development storage; files may be lost when containers restart'});
  }
  if(req.method==='GET'&&u.pathname==='/api/seller/summary'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'});
   const [products,orders]=await Promise.all([
    pool.query(`SELECT count(*)::int total,count(*) FILTER (WHERE status='approved')::int approved,count(*) FILTER (WHERE status='pending')::int pending,COALESCE(sum(stock),0)::int units FROM products WHERE seller_id=$1`,[me.id]),
    pool.query(`SELECT count(DISTINCT oi.order_id)::int orders,COALESCE(sum(oi.quantity*oi.unit_price_cents),0)::bigint gross_cents FROM order_items oi WHERE oi.seller_id=$1`,[me.id])
   ]);
   return json(res,200,{...products.rows[0],...orders.rows[0]});
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/status'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   return json(res,200,{payment:{provider:'demo',live:false},shipping:{provider:'demo',live:false},imageStorage:{provider:'local development',persistent:false}});
  }
  if(req.method==='GET'&&u.pathname==='/api/seller/products'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'});
   const r=await pool.query('SELECT * FROM products WHERE seller_id=$1 ORDER BY created_at DESC',[me.id]);return json(res,200,{products:r.rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/seller/products'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'});
   const b=JSON.parse(await body(req)||'{}');const target=Number(b.sellerTargetCents??b.priceCents),stock=Number(b.stock),condition=String(b.condition||'new');
   if(!['new','like_new','used','refurbished'].includes(condition)||!b.name||!b.category||!Number.isSafeInteger(target)||target<0||!Number.isSafeInteger(stock)||stock<0)return json(res,400,{error:'Invalid product details'});
   if(b.imageUrl && (!(/^https:\/\/[^\s]+$/i.test(b.imageUrl)||/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(b.imageUrl))||b.imageUrl.length>2048))return json(res,400,{error:'Image must be an HTTPS URL'});
   let categoryId=b.categoryId||null,categoryName=String(b.category||'').trim();if(categoryId){const cr=await pool.query(`SELECT id,name FROM categories WHERE id=$1 AND active=true`,[categoryId]);if(!cr.rows[0])return json(res,400,{error:'Invalid category'});categoryName=cr.rows[0].name;}const fee=await serviceFeeQuote(pool,target,'product',categoryId);const published=target+fee.serviceFeeCents;const r=await pool.query(`INSERT INTO products(seller_id,name,description,category,category_id,price_cents,seller_target_cents,shopdrop_service_fee_cents,published_price_cents,stock,image_url,condition,listing_ref) SELECT user_id,$2,$3,$4,$5,$6,$7,$8,$6,$9,$10,$11,'LI-'||to_char(now(),'YYYY')||'-'||lpad(nextval('shopdrop_listing_seq')::text,8,'0') FROM seller_profiles WHERE user_id=$1 AND status='approved' RETURNING *`,[me.id,b.name,b.description||'',categoryName,categoryId,published,target,fee.serviceFeeCents,stock,b.imageUrl||'',condition]);
   if(!r.rows[0])return json(res,403,{error:'Seller not approved'});return json(res,201,{product:r.rows[0]});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/sellers'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const r=await pool.query('SELECT s.user_id id,s.store_name,s.status,u.email FROM seller_profiles s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC');return json(res,200,{sellers:r.rows});
  }
  if(req.method==='POST'&&/^\/api\/admin\/sellers\/[0-9a-f-]{36}$/.test(u.pathname)){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const b=JSON.parse(await body(req)||'{}');if(!['approved','suspended','rejected','pending'].includes(b.status))return json(res,400,{error:'Invalid status'});
   const r=await pool.query('UPDATE seller_profiles SET status=$1 WHERE user_id=$2 RETURNING user_id',[b.status,u.pathname.split('/').pop()]);return json(res,r.rowCount?200:404,{ok:!!r.rowCount});
  }
  if(req.method==='POST'&&/^\/api\/admin\/products\/[0-9a-f-]{36}$/.test(u.pathname)){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const b=JSON.parse(await body(req)||'{}');if(!['approved','rejected','inactive','pending'].includes(b.status))return json(res,400,{error:'Invalid status'});
   const r=await pool.query('UPDATE products SET status=$1 WHERE id=$2 RETURNING id',[b.status,u.pathname.split('/').pop()]);return json(res,r.rowCount?200:404,{ok:!!r.rowCount});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/products'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const r=await pool.query('SELECT id,name,status,price_cents,stock FROM products ORDER BY created_at DESC');return json(res,200,{products:r.rows});
  }
  // V24 services marketplace and transaction support.
  if(req.method==='GET'&&u.pathname==='/api/services'){
   let q=(u.searchParams.get('q')||'').trim(),unit=(u.searchParams.get('pricingUnit')||'').trim(),vals=[],w=[`s.status='approved'`];
   if(q){vals.push(`%${q}%`);w.push(`(s.title ILIKE $${vals.length} OR s.description ILIKE $${vals.length} OR s.service_area ILIKE $${vals.length})`)}
   if(unit){vals.push(unit);w.push(`s.pricing_unit=$${vals.length}`)}
   const r=await pool.query(`SELECT s.id,s.title,s.description,s.pricing_unit,s.unit_price_cents,s.currency_code,s.minimum_units,s.service_area,s.country_code,s.image_url,c.name category FROM service_listings s LEFT JOIN categories c ON c.id=s.category_id WHERE ${w.join(' AND ')} ORDER BY s.created_at DESC`,vals);return json(res,200,{services:r.rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/seller/services'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller/provider access required'});const b=JSON.parse(await body(req)||'{}'),units=['hour','day','kilometre','gig','event','job','treatment'],target=Number(b.sellerTargetUnitCents),min=Number(b.minimumUnits||1);
   if(String(b.title||'').trim().length<2||!units.includes(b.pricingUnit)||!Number.isSafeInteger(target)||target<=0||!Number.isFinite(min)||min<=0)return json(res,400,{error:'Valid title, pricing unit, amount you want to receive and minimum units required'});
   const approved=await pool.query(`SELECT 1 FROM seller_profiles WHERE user_id=$1 AND status='approved'`,[me.id]);if(!approved.rowCount)return json(res,403,{error:'Provider not approved'});
   let categoryId=b.categoryId||null;if(!categoryId&&b.categoryName){const cr=await pool.query(`SELECT id FROM categories WHERE lower(name)=lower($1) AND active=true LIMIT 1`,[String(b.categoryName)]);categoryId=cr.rows[0]?.id||null;}const fee=await serviceFeeQuote(pool,target,'service',categoryId),published=target+fee.serviceFeeCents;const r=await pool.query(`INSERT INTO service_listings(provider_id,category_id,title,description,pricing_unit,unit_price_cents,seller_target_unit_cents,shopdrop_service_fee_unit_cents,published_unit_price_cents,currency_code,minimum_units,service_area,country_code,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$6,$9,$10,$11,$12,$13) RETURNING *`,[me.id,categoryId,String(b.title).trim(),String(b.description||''),b.pricingUnit,published,target,fee.serviceFeeCents,String(b.currencyCode||'ZAR'),min,String(b.serviceArea||''),String(b.countryCode||''),String(b.imageUrl||'')]);if(b.availableFrom&&b.availableUntil)await pool.query(`INSERT INTO service_availability(service_id,starts_at,ends_at) VALUES($1,$2,$3)`,[r.rows[0].id,b.availableFrom,b.availableUntil]);return json(res,201,{service:r.rows[0]});
  }
  if(req.method==='GET'&&u.pathname==='/api/seller/services'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller/provider access required'});const r=await pool.query(`SELECT * FROM service_listings WHERE provider_id=$1 ORDER BY created_at DESC`,[me.id]);return json(res,200,{services:r.rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/service-bookings/preview'){
   if(!okRole(me,['customer']))return json(res,401,{error:'Customer login required'});const b=JSON.parse(await body(req)||'{}'),units=Number(b.units);const r=await pool.query(`SELECT id,provider_id,title,pricing_unit,unit_price_cents,seller_target_unit_cents,shopdrop_service_fee_unit_cents,published_unit_price_cents,currency_code,minimum_units,status FROM service_listings WHERE id=$1`,[b.serviceId]);const s=r.rows[0];if(!s||s.status!=='approved')return json(res,404,{error:'Service unavailable'});if(!Number.isFinite(units)||units<Number(s.minimum_units))return json(res,400,{error:'Invalid quantity/duration'});const publishedUnit=Number(s.published_unit_price_cents||s.unit_price_cents),targetUnit=Number(s.seller_target_unit_cents||s.unit_price_cents),feeUnit=Number(s.shopdrop_service_fee_unit_cents||Math.max(0,publishedUnit-targetUnit)),subtotal=Math.round(units*publishedUnit),commission=Math.round(units*feeUnit),providerProceeds=Math.round(units*targetUnit);return json(res,200,{service:s,units,subtotalCents:subtotal,shopdropServiceFeeCents:commission,providerProceedsCents:providerProceeds,paymentAvailable:false,message:'Preview only. Published service rates already include the disclosed Shop&Drop marketplace service fee. Live booking payment activates after a certified payment provider is connected.'});
  }
  if(req.method==='GET'&&u.pathname==='/api/order-tracking'){
   if(!me)return json(res,401,{error:'Login required'});const orderId=u.searchParams.get('orderId');const own=await pool.query(`SELECT id,status,created_at FROM orders WHERE id=$1 AND (customer_id=$2 OR $3='admin' OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=orders.id AND oi.seller_id=$2))`,[orderId,me.id,me.role]);if(!own.rowCount)return json(res,404,{error:'Order not found'});const groups=await pool.query(`SELECT fg.id,fg.st_ref,fg.seller_id,fg.status,fs.shipment_ref,fs.provider,fs.tracking_number,fs.status shipment_status,fs.handed_to_courier_at,fs.delivered_at FROM fulfilment_groups fg LEFT JOIN fulfilment_shipments fs ON fs.fulfilment_group_id=fg.id WHERE fg.order_id=$1 ORDER BY fg.created_at`,[orderId]);return json(res,200,{order:own.rows[0],fulfilments:groups.rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/category-requests'){
   const b=JSON.parse(await body(req)||'{}'),name=String(b.requestedName||'').trim();if(name.length<2)return json(res,400,{error:'Requested category/service name required'});const r=await pool.query(`INSERT INTO category_requests(user_id,requested_name,description) VALUES($1,$2,$3) RETURNING id,status`,[me?.id||null,name,String(b.description||'')]);return json(res,201,{request:r.rows[0]});
  }
  if(req.method==='POST'&&u.pathname==='/api/referrals'){
   if(!me)return json(res,401,{error:'Login required'});const b=JSON.parse(await body(req)||'{}'),code=crypto.randomBytes(9).toString('base64url');const r=await pool.query(`INSERT INTO referrals(referrer_user_id,order_id,referral_code,channel) VALUES($1,$2,$3,$4) RETURNING referral_code`,[me.id,b.orderId||null,code,String(b.channel||'share')]);return json(res,201,{referralCode:r.rows[0].referral_code});
  }

  if(req.method==='POST'&&u.pathname==='/api/reviews'){
   if(!okRole(me,['customer']))return json(res,401,{error:'Customer login required'});let b=JSON.parse(await body(req)||'{}'),rating=Number(b.rating);if(!b.productId||!Number.isInteger(rating)||rating<1||rating>5)return json(res,400,{error:'Rating must be 1 to 5'});
   let bought=await pool.query(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.customer_id=$1 AND oi.product_id=$2 AND o.status='delivered' LIMIT 1`,[me.id,b.productId]);if(!bought.rows[0])return json(res,403,{error:'Only customers who received the product can review it'});
   await pool.query(`INSERT INTO product_reviews(product_id,customer_id,rating,review_text) VALUES($1,$2,$3,$4) ON CONFLICT(product_id,customer_id) DO UPDATE SET rating=EXCLUDED.rating,review_text=EXCLUDED.review_text,status='published'`,[b.productId,me.id,rating,b.reviewText||'']);return json(res,201,{ok:true})
  }

  if(req.method==='GET'&&u.pathname==='/api/seller/profile'){
   if(!okRole(me,['seller','admin']))return json(res,403,{error:'Seller access required'});let r=await pool.query(`SELECT * FROM seller_profiles WHERE user_id=$1`,[me.id]);return json(res,200,{profile:r.rows[0]})
  }
  if(req.method==='POST'&&u.pathname==='/api/seller/profile'){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'});let b=JSON.parse(await body(req)||'{}');let r=await pool.query(`UPDATE seller_profiles SET store_name=COALESCE($1,store_name),description=COALESCE($2,description),logo_url=COALESCE($3,logo_url),slug=COALESCE($4,slug) WHERE user_id=$5 RETURNING *`,[b.storeName,b.description,b.logoUrl,b.slug,me.id]);return json(res,200,{profile:r.rows[0]})
  }
  if(req.method==='POST'&&/^\/api\/seller\/shipments\/[0-9a-f-]{36}$/.test(u.pathname)){
   if(!okRole(me,['seller']))return json(res,403,{error:'Seller access required'}); const b=JSON.parse(await body(req)||'{}'),orderId=u.pathname.split('/').pop();
   const allowed=['preparing','courier_booked','collected','in_transit','out_for_delivery','delivered']; if(!allowed.includes(b.status))return json(res,400,{error:'Invalid shipment status'});
   const owns=await pool.query(`SELECT 1 FROM order_items WHERE order_id=$1 AND seller_id=$2 LIMIT 1`,[orderId,me.id]); if(!owns.rowCount)return json(res,404,{error:'Order not found'});
   const r=await pool.query(`UPDATE shipments SET status=$1,tracking_number=COALESCE(NULLIF($2,''),tracking_number),handed_to_courier_at=CASE WHEN $1 IN ('collected','in_transit','out_for_delivery','delivered') THEN COALESCE(handed_to_courier_at,now()) ELSE handed_to_courier_at END,delivered_at=CASE WHEN $1='delivered' THEN COALESCE(delivered_at,now()) ELSE delivered_at END,updated_at=now() WHERE order_id=$3 RETURNING *`,[b.status,String(b.trackingNumber||''),orderId]); return json(res,200,{shipment:r.rows[0]});
  }
  if(req.method==='POST'&&u.pathname==='/api/admin/categories'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'}); const b=JSON.parse(await body(req)||'{}');
   const name=String(b.name||'').trim(),slug=String(b.slug||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).trim(); if(name.length<2||!slug)return json(res,400,{error:'Category name required'});
   const r=await pool.query(`INSERT INTO categories(name,slug,parent_id,sort_order) VALUES($1,$2,$3,$4) RETURNING *`,[name,slug,b.parentId||null,Number(b.sortOrder)||0]); return json(res,201,{category:r.rows[0]});
  }
  if(req.method==='POST'&&/^\/api\/admin\/products\/[0-9a-f-]{36}\/special$/.test(u.pathname)){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'}); const b=JSON.parse(await body(req)||'{}'),id=u.pathname.split('/')[4];
   const sp=b.specialPriceCents==null?null:Number(b.specialPriceCents); const r=await pool.query(`UPDATE products SET is_special=$1,special_price_cents=$2,special_starts_at=$3,special_ends_at=$4 WHERE id=$5 RETURNING id,is_special,special_price_cents`,[!!b.isSpecial,sp,b.startsAt||null,b.endsAt||null,id]); return json(res,r.rowCount?200:404,r.rowCount?{product:r.rows[0]}:{error:'Product not found'});
  }
  if(req.method==='POST'&&u.pathname==='/api/feedback'){
   if(!me)return json(res,401,{error:'Login required'}); const b=JSON.parse(await body(req)||'{}'),rating=Number(b.rating),audience=me.role==='seller'?'seller':'buyer'; if(!Number.isInteger(rating)||rating<1||rating>5)return json(res,400,{error:'Rating must be 1 to 5'});
   await pool.query(`INSERT INTO platform_feedback(user_id,order_id,audience,rating,topic,comments) VALUES($1,$2,$3,$4,$5,$6)`,[me.id,b.orderId||null,audience,rating,String(b.topic||'overall'),String(b.comments||'')]); return json(res,201,{ok:true});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/feedback'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'}); const r=await pool.query(`SELECT f.*,u.email FROM platform_feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 200`); return json(res,200,{feedback:r.rows});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/summary'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});let qs=['SELECT count(*)::int n FROM users',`SELECT count(*)::int n FROM seller_profiles WHERE status='approved'`,'SELECT count(*)::int n FROM products','SELECT count(*)::int n FROM orders','SELECT COALESCE(sum(net_cents),0)::int n FROM seller_payouts'];let a=await Promise.all(qs.map(q=>pool.query(q)));return json(res,200,{users:a[0].rows[0].n,sellers:a[1].rows[0].n,products:a[2].rows[0].n,orders:a[3].rows[0].n,payoutsCents:a[4].rows[0].n})
  }
  // Read-only operational reporting: no manual payment, refund or payout execution.
  if(req.method==='GET'&&u.pathname==='/api/admin/order-operations'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const r=await pool.query(`SELECT o.id,o.created_at,o.status AS order_status,o.total_cents,
     pay.status AS payment_status,pay.provider,pay.provider_reference,
     sh.status AS shipment_status,sh.tracking_number,
     (SELECT count(*)::int FROM order_items oi WHERE oi.order_id=o.id) AS item_count
     FROM orders o LEFT JOIN payments pay ON pay.order_id=o.id
     LEFT JOIN shipments sh ON sh.order_id=o.id ORDER BY o.created_at DESC LIMIT 100`);
   return json(res,200,{orders:r.rows,livePaymentsEnabled:false,liveShippingEnabled:false,
     note:'Read-only demo records; do not treat order status as proof of settlement.'});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/seller-reconciliation'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const r=await pool.query(`SELECT oi.seller_id,sp.store_name,
     COALESCE(SUM(oi.quantity*oi.unit_price_cents),0)::bigint AS gross_order_cents,
     COALESCE(SUM(CASE WHEN pay.status='paid' THEN oi.quantity*oi.unit_price_cents ELSE 0 END),0)::bigint AS recorded_paid_order_cents,
     COALESCE(SUM(CASE WHEN pay.status='refunded' THEN oi.quantity*oi.unit_price_cents ELSE 0 END),0)::bigint AS recorded_refunded_order_cents,
     count(DISTINCT oi.order_id)::int AS order_count
     FROM order_items oi JOIN seller_profiles sp ON sp.user_id=oi.seller_id
     JOIN orders o ON o.id=oi.order_id LEFT JOIN payments pay ON pay.order_id=o.id
     GROUP BY oi.seller_id,sp.store_name ORDER BY sp.store_name`);
   return json(res,200,{sellers:r.rows,settlementReady:false,
     note:'Indicative ledger only. No verified provider settlement, fees, disputes or refunds integrated; do not pay sellers from these figures.'});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/refund-review'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});
   const r=await pool.query(`SELECT o.id,o.created_at,o.status AS order_status,o.total_cents,
     pay.status AS payment_status,pay.provider_reference
     FROM orders o LEFT JOIN payments pay ON pay.order_id=o.id
     WHERE o.status IN ('cancelled','refunded') OR pay.status IN ('failed','refunded')
     ORDER BY o.created_at DESC LIMIT 100`);
   return json(res,200,{orders:r.rows,refundExecutionEnabled:false,
     note:'Review queue only; no actual refund has been initiated by this endpoint.'});
  }
  if(req.method==='GET'&&(u.pathname==='/api/service-fee/preview'||u.pathname==='/api/commission/preview')){
   const target=Number(u.searchParams.get('targetCents')??u.searchParams.get('amountCents')),type=u.searchParams.get('type')==='service'?'service':'product';if(!Number.isSafeInteger(target)||target<0)return json(res,400,{error:'Valid targetCents required'});const q=await serviceFeeQuote(pool,target,type);return json(res,200,{sellerTargetCents:target,serviceFeeCents:q.serviceFeeCents,publishedPriceCents:target+q.serviceFeeCents,effectiveBasisPoints:q.effectiveBasisPoints,rules:q.rules,note:'Configurable marketplace service-fee preview. Final rules remain subject to Shop&Drop launch economics testing.'});
  }
  if(req.method==='GET'&&u.pathname==='/api/notifications'){
   if(!me)return json(res,401,{error:'Login required'});const r=await pool.query(`SELECT id,channel,template_key,payload,status,created_at,sent_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[me.id]);return json(res,200,{notifications:r.rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/disputes'){
   if(!me)return json(res,401,{error:'Login required'});const b=JSON.parse(await body(req)||'{}'),reason=String(b.reason||'other'),allowed=['not_received','damaged','wrong_item','not_as_described','cancelled','service_issue','other'];if(!allowed.includes(reason)||!b.orderId)return json(res,400,{error:'Order and valid reason required'});const own=await pool.query(`SELECT 1 FROM orders WHERE id=$1 AND customer_id=$2`,[b.orderId,me.id]);if(!own.rowCount)return json(res,404,{error:'Order not found'});const r=await pool.query(`INSERT INTO return_disputes(order_id,opened_by,reason,description,evidence_urls) VALUES($1,$2,$3,$4,$5) RETURNING *`,[b.orderId,me.id,reason,String(b.description||''),JSON.stringify(Array.isArray(b.evidenceUrls)?b.evidenceUrls:[])]);await pool.query(`UPDATE seller_payouts SET status='held' WHERE order_id=$1 AND status<>'paid'`,[b.orderId]);return json(res,201,{dispute:r.rows[0]});
  }
  if(req.method==='GET'&&u.pathname==='/api/admin/exceptions'){
   if(!okRole(me,['admin']))return json(res,403,{error:'Admin access required'});const [risk,disputes,failedPayouts]=await Promise.all([pool.query(`SELECT count(*)::int n FROM risk_flags WHERE status IN ('open','reviewing')`),pool.query(`SELECT count(*)::int n FROM return_disputes WHERE status NOT IN ('resolved_refund','resolved_no_refund','closed')`),pool.query(`SELECT count(*)::int n FROM seller_payouts WHERE status='failed'`)]);return json(res,200,{attentionRequired:risk.rows[0].n+disputes.rows[0].n+failedPayouts.rows[0].n,riskFlags:risk.rows[0].n,openDisputes:disputes.rows[0].n,failedPayouts:failedPayouts.rows[0].n});
  }
  if(req.method==='GET'&&u.pathname==='/api/health'){await pool.query('SELECT 1');return json(res,200,{ok:true,version:'25.0.0',livePaymentsEnabled:false,liveShippingEnabled:false})}
  if(req.method==='POST'&&u.pathname==='/api/payments/webhook'){
   const raw=await body(req),secret=process.env.PAYMENT_WEBHOOK_SECRET||'',sig=String(req.headers['x-shopdrop-signature']||'');
   if(!secret||secret.startsWith('disabled-'))return json(res,503,{error:'Live payment webhook disabled until a verified provider adapter is installed'});
   if(!verifyHmac(raw,sig,secret))return json(res,401,{error:'Invalid webhook signature'});
   return json(res,503,{error:'Signature verified, but live settlement processing remains disabled pending provider certification'});
  }

  if(req.method==='GET'){
   let f=u.pathname==='/'?'/index.html':u.pathname,root=path.resolve(__dirname,'..','public'),p=path.resolve(root,'.'+f);if(p.startsWith(root+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){let ext=path.extname(p),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{...securityHeaders(),'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-store':'public, max-age=300'});return res.end(fs.readFileSync(p))}
  }
  return json(res,404,{error:'Not found'})
 }catch(e){console.error(e);return json(res,e.statusCode||500,{error:e.statusCode===413?'Request body too large':'Internal server error'})}
}
http.createServer((q,r)=>route(q,r)).listen(PORT,()=>console.log(`Shop&Drop V24.1 on ${PORT}`));
