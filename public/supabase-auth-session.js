/* Shop&Drop R2-A additive diagnostic only. */
(() => {
  "use strict";
  const URL = "https://dtkdvvxpwonywtsgqmdx.supabase.co";
  function key() {
    return window.SHOPDROP_SUPABASE_PUBLISHABLE_KEY ||
           window.SUPABASE_PUBLISHABLE_KEY ||
           window.ShopDrop?.SUPABASE_PUBLISHABLE_KEY || null;
  }
  async function authHealth() {
    const k = key();
    if (!k) return {ok:false, stage:"configuration", message:"Publishable key not available to diagnostic page."};
    try {
      const r = await fetch(URL + "/auth/v1/health", {
        headers:{apikey:k}, cache:"no-store"
      });
      return {ok:r.ok, stage:"auth-health", status:r.status, body:await r.text()};
    } catch(e) {
      return {ok:false, stage:"network", message:e instanceof Error ? e.message : String(e)};
    }
  }
  window.ShopDropAuthSessionR2A = Object.freeze({authHealth});
})();
