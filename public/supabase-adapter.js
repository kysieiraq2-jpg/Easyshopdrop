// Shop&Drop V26.24 — Supabase isolated adapter
// ADDITIVE ONLY: this file does not alter or override existing V26.24 behavior.
// It exposes explicit helper methods for future controlled integration calls.
// Existing pages, routes, common.js behavior and Supabase backend remain unchanged.

(function () {
  'use strict';

  // Public browser configuration only. Never put service-role keys here.
  function config() {
    return { url: 'https://dtkdvvxpwonywtsgqmdx.supabase.co', key: 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q' };
  }

  async function invoke(functionName, accessToken, body) {
    const { url, key } = config();

    if (!accessToken) {
      throw new Error('Authenticated Shop&Drop session required.');
    }

    const response = await fetch(
      url + '/functions/v1/' + encodeURIComponent(functionName),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify(body ?? {})
      }
    );

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : {};

    if (!response.ok) {
      throw new Error(
        data?.user_message ||
        data?.message ||
        data?.error ||
        'Shop&Drop secure service request failed.'
      );
    }

    return data;
  }

  const functions = Object.freeze({
    createCheckoutOrder: (token, body) => invoke('create-checkout-order', token, body),
    cancellations: (token, body) => invoke('cancellations', token, body),
    courierQuotes: (token, body) => invoke('courier-quotes', token, body),
    createListingReference: (token, body) => invoke('create-listing-reference', token, body),
    createPaymentSession: (token, body) => invoke('create-payment-session', token, body),
    disputeEvidence: (token, body) => invoke('dispute-evidence', token, body),
    disputes: (token, body) => invoke('disputes', token, body),
    feedback: (token, body) => invoke('feedback', token, body),
    listingReports: (token, body) => invoke('listing-reports', token, body),
    verifyDispatchArrival: (token, body) => invoke('verify-dispatch-arrival', token, body),
    verifyServiceArrival: (token, body) => invoke('verify-service-arrival', token, body)
  });

  // Only explicitly approved functions are exposed to frontend pages.
  // The generic invoke method remains private to this module.
  // Deliberately not exposed here:
  // - change-requests: requires verified admin authorization before activation.
  // - payment-webhook: provider-to-server webhook; must never be browser invoked.
  // - create-payout: privileged payout execution; must never be exposed as a browser helper.

  // Authenticated browser calls: obtain the token from the same Supabase Auth
  // storage/session used by sign-in and registration, never from page input.
  // This is a convenience boundary only; Edge Functions must enforce RLS and
  // server-side authorization for every request.
  let clientPromise;
  async function authClient() {
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(({ createClient }) => {
          const { url, key } = config();
          return createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true,
                    detectSessionInUrl: true }
          });
        }).catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }

  async function verifiedToken() {
    const client = await authClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Please sign in to Shop&Drop first.');
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      throw new Error('Session expired. Please sign in again.');
    }
    return token;
  }

  const authenticatedFunctions = Object.freeze(
    Object.fromEntries(Object.entries(functions).map(([name, fn]) => [
      name, async (body) => fn(await verifiedToken(), body)
    ]))
  );

  window.ShopDropSupabaseAdapter = Object.freeze({
    functions,
    authenticatedFunctions
  });
})();
