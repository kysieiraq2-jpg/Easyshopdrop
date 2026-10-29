/* Shop&Drop Phase6C A146 — seller public alias, additive to A123.
   Does not modify seller IDs, product references, or legacy profile handlers. */
(() => {
  'use strict';
  const input = document.getElementById('shopdropSellerAlias');
  const save = document.getElementById('shopdropSaveSellerAlias');
  const status = document.getElementById('shopdropSellerAliasStatus');
  if (!input || !save || !status) return;
  const SUPABASE_URL = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let clientPromise;
  const client = () => clientPromise ||= import('https://esm.sh/@supabase/supabase-js@2')
    .then(({createClient}) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}))
    .catch(error => {clientPromise = null; throw error;});
  const explain = error => error?.code === '23505'
    ? 'That seller name is already taken. Please choose another.'
    : (error?.message || 'Unable to save the seller name.');
  async function sellerProfile(sb) {
    const {data:{user},error} = await sb.auth.getUser();
    if (error || !user) throw Error('Please sign in first.');
    const result = await sb.from('profiles').select('id,role,seller_public_alias').eq('id',user.id).single();
    if (result.error) throw result.error;
    if (result.data.role !== 'seller') throw Error('A seller account is required.');
    return result.data;
  }
  async function load() {
    try {
      const profile = await sellerProfile(await client());
      input.value = profile.seller_public_alias || '';
      status.textContent = profile.seller_public_alias
        ? 'Current public seller name: ' + profile.seller_public_alias
        : 'Choose your unique public seller name.';
    } catch (error) {status.textContent = explain(error);}
  }
  save.addEventListener('click', async () => {
    const alias = input.value.trim().replace(/\s+/g,' ');
    if (alias.length < 3 || alias.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u.test(alias)
      || /(?:@|https?:|www\.|\b(?:ltd|limited|llc|inc|pty|gmbh|corp)\b)/i.test(alias)) {
      status.textContent = 'Use 3–40 characters in an individual-style name. No business names or contact details.';
      return;
    }
    save.disabled = true;
    try {
      const sb = await client();
      const profile = await sellerProfile(sb);
      const result = await sb.from('profiles').update({seller_public_alias:alias})
        .eq('id',profile.id).select('seller_public_alias').single();
      if (result.error) throw result.error;
      input.value = result.data.seller_public_alias;
      status.textContent = 'Public seller name saved. Product display integration follows in the next stage.';
    } catch(error) {status.textContent = explain(error);}
    finally {save.disabled = false;}
  });
  load();
})();
