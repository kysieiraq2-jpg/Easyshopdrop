/* Shop&Drop R3-A diagnostic detail repair.
   Replaces only the additive R3 diagnostic helper. No V26.24 file is modified. */
(() => {
  "use strict";
  const U="https://dtkdvvxpwonywtsgqmdx.supabase.co", K="sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q";
  let T=null, I=null;

  async function signIn(email,password) {
    try {
      const r=await fetch(U+"/auth/v1/token?grant_type=password",{
        method:"POST",
        headers:{apikey:K,"Content-Type":"application/json"},
        body:JSON.stringify({email,password}),
        cache:"no-store"
      });
      const text=await r.text();
      let body;
      try { body=text?JSON.parse(text):{}; } catch { body={raw:text}; }
      if(r.ok && body.access_token && body.user?.id) {
        T=body.access_token; I=body.user.id;
      }
      return {ok:r.ok,status:r.status,body};
    } catch(err) {
      return {ok:false,status:null,body:{message:String(err)}};
    }
  }

  async function q(filter) {
    if(!T||!I) return {ok:false,status:null,body:[],message:"Sign in first."};
    const r=await fetch(U+"/rest/v1/profiles?"+filter,{
      headers:{apikey:K,Authorization:"Bearer "+T},
      cache:"no-store"
    });
    const text=await r.text();
    let body;
    try { body=text?JSON.parse(text):[]; } catch { body=[]; }
    return {ok:r.ok,status:r.status,body};
  }

  window.ShopDropR3A=Object.freeze({
    signIn,
    own:()=>q("id=eq."+encodeURIComponent(I)+"&select=id,full_name,country_code,mobile_number"),
    other:()=>q("id=neq."+encodeURIComponent(I)+"&select=id&limit=1")
  });
})();