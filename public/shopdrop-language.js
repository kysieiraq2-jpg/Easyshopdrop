/* Shop&Drop multilingual foundation — additive, no payment or account changes.
   Uses browser language as a suggestion, manual selection takes precedence.
   Only explicitly marked interface strings are translated. Product listings,
   user-generated content, legal text and financial figures are never altered. */
(() => {
  'use strict';
  const dictionaries = {
    en: {language:'Language', welcome:'Welcome to Shop&Drop', search:'Search', categories:'Categories', signIn:'Sign in', register:'Register'},
    af: {language:'Taal', welcome:'Welkom by Shop&Drop', search:'Soek', categories:'Kategorieë', signIn:'Meld aan', register:'Registreer'},
    ar: {language:'اللغة', welcome:'مرحباً بك في Shop&Drop', search:'بحث', categories:'الفئات', signIn:'تسجيل الدخول', register:'التسجيل'},
    fr: {language:'Langue', welcome:'Bienvenue sur Shop&Drop', search:'Rechercher', categories:'Catégories', signIn:'Connexion', register:"S’inscrire"},
    es: {language:'Idioma', welcome:'Bienvenido a Shop&Drop', search:'Buscar', categories:'Categorías', signIn:'Iniciar sesión', register:'Registrarse'},
    pt: {language:'Idioma', welcome:'Bem-vindo ao Shop&Drop', search:'Pesquisar', categories:'Categorias', signIn:'Entrar', register:'Registar'}
  };
  const names={en:'English',af:'Afrikaans',ar:'العربية',fr:'Français',es:'Español',pt:'Português'};
  const key='shopdrop-ui-language';
  function choose(){
    let saved=null;
    try { saved=localStorage.getItem(key); } catch (_) {}
    const browser=(navigator.language||'en').toLowerCase().split('-')[0];
    return dictionaries[saved] ? saved : dictionaries[browser] ? browser : 'en';
  }
  function apply(lang){
    if(!dictionaries[lang]) return;
    document.documentElement.lang=lang;
    // Do not force RTL on the existing layout until RTL visual testing is done.
    document.querySelectorAll('[data-shopdrop-i18n]').forEach(el=>{
      const k=el.getAttribute('data-shopdrop-i18n');
      if(Object.prototype.hasOwnProperty.call(dictionaries[lang],k)) el.textContent=dictionaries[lang][k];
    });
    const label=document.getElementById('shopdrop-language-label');
    if(label) label.textContent=dictionaries[lang].language+': ';
    const select=document.getElementById('shopdrop-language-select');
    if(select) select.value=lang;
  }
  function init(){
    if(document.getElementById('shopdrop-language-select')) return;
    const wrap=document.createElement('div');
    wrap.id='shopdrop-language-control';
    wrap.style.cssText='position:fixed;bottom:12px;right:12px;z-index:1000;background:#fff;color:#111;border:1px solid #bbb;border-radius:8px;padding:6px 9px;font:14px system-ui,sans-serif;box-shadow:0 2px 8px #0002';
    const label=document.createElement('label');
    label.id='shopdrop-language-label';
    label.htmlFor='shopdrop-language-select';
    const select=document.createElement('select');
    select.id='shopdrop-language-select';
    select.setAttribute('aria-label','Website language');
    select.style.cssText='font:inherit;max-width:120px;color:#111;background:#fff';
    for(const [code,name] of Object.entries(names)){
      const option=document.createElement('option');option.value=code;option.textContent=name;select.appendChild(option);
    }
    select.addEventListener('change',()=>{
      try {localStorage.setItem(key,select.value);}catch(_){}
      apply(select.value);
    });
    wrap.append(label,select);document.body.appendChild(wrap);
    apply(choose());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
