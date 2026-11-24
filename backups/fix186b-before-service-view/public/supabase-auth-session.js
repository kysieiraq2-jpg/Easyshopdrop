/* Shop&Drop R2-A diagnostic repair — additive file only.
   Uses the browser-safe Supabase publishable key.
   Does not modify or override V26.24. */
(() => {
  "use strict";

  const SUPABASE_URL = "https://dtkdvvxpwonywtsgqmdx.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q";

  async function authHealth() {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        headers: {
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        cache: "no-store"
      });

      return {
        ok: response.ok,
        stage: "auth-health",
        status: response.status,
        body: await response.text()
      };
    } catch (error) {
      return {
        ok: false,
        stage: "network",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  window.ShopDropAuthSessionR2A = Object.freeze({ authHealth });
})();
