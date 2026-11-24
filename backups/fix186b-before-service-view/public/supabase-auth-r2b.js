/* Shop&Drop R2-B session diagnostic repair.
   Additive diagnostic file only — no V26.24 file is modified. */
(() => {
  "use strict";

  const URL = "https://dtkdvvxpwonywtsgqmdx.supabase.co";
  const KEY = "sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q";
  let memorySession = null;

  async function request(path, options = {}) {
    const response = await fetch(URL + path, {
      ...options,
      headers: {
        "apikey": KEY,
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      cache: "no-store"
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : {}; }
    catch { body = { raw: text }; }
    return { ok: response.ok, status: response.status, body };
  }

  async function signUp(email, password) {
    return request("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: { full_name: "Shop&Drop R2-B Test User" }
      })
    });
  }

  async function signIn(email, password) {
    const r = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    if (r.ok && r.body && r.body.access_token) {
      memorySession = {
        access_token: r.body.access_token,
        refresh_token: r.body.refresh_token || null,
        expires_in: r.body.expires_in || null,
        user_id: r.body.user?.id || null
      };
    }
    return r;
  }

  function summary() {
    if (!memorySession) return null;
    return {
      has_access_token: Boolean(memorySession.access_token),
      has_refresh_token: Boolean(memorySession.refresh_token),
      expires_in: memorySession.expires_in,
      user_id: memorySession.user_id
    };
  }

  window.ShopDropR2B = Object.freeze({ signUp, signIn, summary });
})();
