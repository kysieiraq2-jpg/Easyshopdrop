import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const N = 16384, r = 8, p = 1;
  const key = crypto.scryptSync(password, Buffer.from(salt,'base64'), 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt}$${key.toString('base64')}`;
}

export function verifyPassword(password, encoded) {
  try {
    const [scheme,Ns,rs,ps,salt,keyB64] = encoded.split('$');
    if (scheme !== 'scrypt') return false;
    const key = crypto.scryptSync(password, Buffer.from(salt,'base64'), 32, {
      N:Number(Ns), r:Number(rs), p:Number(ps)
    });
    const expected = Buffer.from(keyB64,'base64');
    return expected.length === key.length && crypto.timingSafeEqual(expected,key);
  } catch {
    return false;
  }
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function verifyHmac(rawBody, signature, secret) {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!signature || signature.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
