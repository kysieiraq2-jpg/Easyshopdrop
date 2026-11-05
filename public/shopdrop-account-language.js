/* Shop&Drop multilingual registration/sign-in bridge — UI labels only. */
(() => {
  'use strict';
  const translations = {
    af: {'Create your free account':'Skep jou gratis rekening','Sign in to Shop&Drop':'Meld aan by Shop&Drop','Email':'E-pos','Password':'Wagwoord','Confirm password':'Bevestig wagwoord','Create account':'Skep rekening','Sign in':'Meld aan','Full name':'Volle naam','Mobile number':'Selfoonnommer'},
    ar: {'Create your free account':'أنشئ حسابك المجاني','Sign in to Shop&Drop':'تسجيل الدخول إلى Shop&Drop','Email':'البريد الإلكتروني','Password':'كلمة المرور','Confirm password':'تأكيد كلمة المرور','Create account':'إنشاء حساب','Sign in':'تسجيل الدخول','Full name':'الاسم الكامل','Mobile number':'رقم الهاتف المحمول'},
    fr: {'Create your free account':'Créez votre compte gratuit','Sign in to Shop&Drop':'Se connecter à Shop&Drop','Email':'E-mail','Password':'Mot de passe','Confirm password':'Confirmer le mot de passe','Create account':'Créer un compte','Sign in':'Se connecter','Full name':'Nom complet','Mobile number':'Numéro de mobile'},
    es: {'Create your free account':'Crea tu cuenta gratuita','Sign in to Shop&Drop':'Iniciar sesión en Shop&Drop','Email':'Correo electrónico','Password':'Contraseña','Confirm password':'Confirmar contraseña','Create account':'Crear cuenta','Sign in':'Iniciar sesión','Full name':'Nombre completo','Mobile number':'Número de móvil'},
    pt: {'Create your free account':'Crie a sua conta gratuita','Sign in to Shop&Drop':'Iniciar sessão no Shop&Drop','Email':'E-mail','Password':'Palavra-passe','Confirm password':'Confirmar palavra-passe','Create account':'Criar conta','Sign in':'Iniciar sessão','Full name':'Nome completo','Mobile number':'Número de telemóvel'}
  };
  const names = {en:'English',af:'Afrikaans',ar:'العربية',fr:'Français',es:'Español',pt:'Português'};
  const key = 'shopdrop-ui-language';
  function selected() {
    try {const v=localStorage.getItem(key);if(names[v])return v;}catch(_){}
    const v=(navigator.language||'en').toLowerCase().split('-')[0];
    return names[v]?v:'en';
  }
  function init() {
    if(document.getElementById('shopdrop-language-select'))return;
    const wrapper=document.createElement('div');
    wrapper.style.cssText='max-width:650px;margin:8px auto;padding:8px 14px;font:14px Arial,sans-serif';
    const label=document.createElement('label');
    label.htmlFor='shopdrop-language-select';label.textContent='Language: ';
    const select=document.createElement('select');
    select.id='shopdrop-language-select';select.setAttribute('aria-label','Website language');
    select.style.cssText='width:auto;max-width:180px;padding:7px;color:#17202a;background:#fff';
    for(const [code,name] of Object.entries(names)){
      const opt=document.createElement('option');opt.value=code;opt.textContent=name;select.appendChild(opt);
    }
    wrapper.append(label,select);document.body.insertBefore(wrapper,document.body.firstChild);
    const nodes=[...document.querySelectorAll('h1,label,button')].filter(el=>el.children.length===0);
    for(const el of nodes)el.dataset.shopdropOriginalText=el.textContent.trim();
    function apply(lang){
      document.documentElement.lang=lang;
      for(const el of nodes){
        const original=el.dataset.shopdropOriginalText;
        el.textContent=translations[lang]?.[original]||original;
      }
      select.value=lang;
    }
    select.addEventListener('change',()=>{
      try{localStorage.setItem(key,select.value);}catch(_){}
      apply(select.value);
    });
    apply(selected());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

/* Shop&Drop Fix 3H: Arabic text direction without changing form or page layout. */
(() => {
  'use strict';
  function chosen() {
    try {
      const saved=localStorage.getItem('shopdrop-ui-language');
      if (saved) return saved;
    } catch (_) {}
    return (navigator.language||'en').toLowerCase().split('-')[0];
  }
  function apply() {
    const arabic=chosen()==='ar';
    // Preserve the overall layout, input direction and numeric/currency formatting.
    document.querySelectorAll('h1,h2,h3,#menu a,#menu button,.shopdrop-main-menu a').forEach(el=>{
      if (!el.dataset.shopdropDirectionOriginal) {
        el.dataset.shopdropDirectionOriginal=el.getAttribute('dir')||'unset';
      }
      if (arabic) {
        el.setAttribute('dir','rtl');
        el.style.textAlign='start';
      } else {
        const original=el.dataset.shopdropDirectionOriginal;
        if(original==='unset')el.removeAttribute('dir');
        else el.setAttribute('dir',original);
        el.style.removeProperty('text-align');
      }
    });
  }
  function init(){
    apply();
    document.addEventListener('change',e=>{
      if(e.target && e.target.matches('select[id*="language"]')) {
        queueMicrotask(apply);
      }
    });
    window.addEventListener('storage',e=>{
      if(e.key==='shopdrop-ui-language')apply();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
