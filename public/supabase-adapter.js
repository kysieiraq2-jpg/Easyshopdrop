// Shop&Drop V26.24 — Supabase isolated adapter
// ADDITIVE ONLY: this file does not alter or override existing V26.24 behavior.
// It exposes explicit helper methods for future controlled integration calls.
// Existing pages, routes, common.js behavior and Supabase backend remain unchanged.

(function () {
  'use strict';

  function config() {
    if (typeof SHOPDROP_SUPABASE_URL === 'undefined' ||
        typeof SHOPDROP_SUPABASE_PUBLISHABLE_KEY === 'undefined') {
      throw new Error('Shop&Drop Supabase configuration is unavailable.');
    }
    return {
      url: SHOPDROP_SUPABASE_URL,
      key: SHOPDROP_SUPABASE_PUBLISHABLE_KEY
    };
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
    cancellations: (token, body) => invoke('cancellations', token, body),
    courierQuotes: (token, body) => invoke('courier-quotes', token, body),
    createListingReference: (token, body) => invoke('create-listing-reference', token, body),
    createPaymentSession: (token, body) => invoke('create-payment-session', token, body),
    createPayout: (token, body) => invoke('create-payout', token, body),
    disputeEvidence: (token, body) => invoke('dispute-evidence', token, body),
    disputes: (token, body) => invoke('disputes', token, body),
    feedback: (token, body) => invoke('feedback', token, body),
    listingReports: (token, body) => invoke('listing-reports', token, body),
    verifyDispatchArrival: (token, body) => invoke('verify-dispatch-arrival', token, body),
    verifyServiceArrival: (token, body) => invoke('verify-service-arrival', token, body)
  });

  // Deliberately not exposed here:
  // - change-requests: requires verified admin authorization before activation.
  // - payment-webhook: provider-to-server webhook; must never be browser invoked.

  window.ShopDropSupabaseAdapter = Object.freeze({
    invoke,
    functions
  });
})();
