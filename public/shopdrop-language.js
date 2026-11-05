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

/* Shop&Drop multilingual homepage bridge — additive. */
(() => {
 'use strict';
 const terms = {
  'Search products': {af:'Soek produkte',ar:'البحث عن المنتجات',fr:'Rechercher des produits',es:'Buscar productos',pt:'Pesquisar produtos'},
  'Search': {af:'Soek',ar:'بحث',fr:'Rechercher',es:'Buscar',pt:'Pesquisar'},
  '☰ Menu': {af:'☰ Kieslys',ar:'☰ القائمة',fr:'☰ Menu',es:'☰ Menú',pt:'☰ Menu'},
  'Home / Shop': {af:'Tuis / Winkel',ar:'الرئيسية / التسوق',fr:'Accueil / Boutique',es:'Inicio / Tienda',pt:'Início / Loja'},
  'Shop New Products': {af:'Koop nuwe produkte',ar:'تسوق منتجات جديدة',fr:'Acheter des produits neufs',es:'Comprar productos nuevos',pt:'Comprar produtos novos'},
  'Products & Categories': {af:'Produkte en kategorieë',ar:'المنتجات والفئات',fr:'Produits et catégories',es:'Productos y categorías',pt:'Produtos e categorias'},
  'Other Services': {af:'Ander dienste',ar:'خدمات أخرى',fr:'Autres services',es:'Otros servicios',pt:'Outros serviços'},
  'Dispatching & Transport': {af:'Versending en vervoer',ar:'الشحن والنقل',fr:'Expédition et transport',es:'Envíos y transporte',pt:'Expedição e transporte'},
  'Sell a Product — FREE': {af:'Verkoop ’n produk — GRATIS',ar:'بيع منتج — مجاناً',fr:'Vendre un produit — GRATUIT',es:'Vender un producto — GRATIS',pt:'Vender um produto — GRÁTIS'},
  'My Bag / Checkout': {af:'My mandjie / Betaal',ar:'سلتي / الدفع',fr:'Mon panier / Paiement',es:'Mi cesta / Pagar',pt:'O meu cesto / Pagamento'},
  'Sign In / Create Account': {af:'Meld aan / Skep rekening',ar:'تسجيل الدخول / إنشاء حساب',fr:'Connexion / Créer un compte',es:'Entrar / Crear cuenta',pt:'Entrar / Criar conta'},
  'Sign In / Account': {af:'Meld aan / Rekening',ar:'تسجيل الدخول / الحساب',fr:'Connexion / Compte',es:'Entrar / Cuenta',pt:'Entrar / Conta'},
  'Bag': {af:'Mandjie',ar:'السلة',fr:'Panier',es:'Cesta',pt:'Cesto'},
  'Shop Products': {af:'Koop produkte',ar:'تسوق المنتجات',fr:'Acheter des produits',es:'Comprar productos',pt:'Comprar produtos'},
  'Find Other Services': {af:'Vind ander dienste',ar:'ابحث عن خدمات أخرى',fr:'Trouver des services',es:'Encontrar servicios',pt:'Encontrar serviços'},
  'Dispatch & Transport': {af:'Versending en vervoer',ar:'الشحن والنقل',fr:'Expédition et transport',es:'Envíos y transporte',pt:'Expedição e transporte'},
  'Sell / Offer — FREE': {af:'Verkoop / Bied aan — GRATIS',ar:'بيع / تقديم — مجاناً',fr:'Vendre / Proposer — GRATUIT',es:'Vender / Ofrecer — GRATIS',pt:'Vender / Oferecer — GRÁTIS'},
  'Sell an Item': {af:'Verkoop ’n item',ar:'بيع سلعة',fr:'Vendre un article',es:'Vender un artículo',pt:'Vender um artigo'},
  'Offer a Service': {af:'Bied ’n diens aan',ar:'تقديم خدمة',fr:'Proposer un service',es:'Ofrecer un servicio',pt:'Oferecer um serviço'},
  'Shop by category': {af:'Koop volgens kategorie',ar:'تسوق حسب الفئة',fr:'Acheter par catégorie',es:'Comprar por categoría',pt:'Comprar por categoria'},
  'New & featured products': {af:'Nuwe en uitgeligte produkte',ar:'منتجات جديدة ومميزة',fr:'Produits nouveaux et en vedette',es:'Productos nuevos y destacados',pt:'Produtos novos e em destaque'}
 };
 const key='shopdrop-ui-language';
 function language(){
   try {const v=localStorage.getItem(key);if(['en','af','ar','fr','es','pt'].includes(v))return v;}catch(_){}
   const b=(navigator.language||'en').split('-')[0].toLowerCase();
   return ['en','af','ar','fr','es','pt'].includes(b)?b:'en';
 }
 function apply(lang){
   document.querySelectorAll('#shopdropHeader a,#shopdropHeader button,#v264Homepage h2,#v264Homepage .v264Actions a,.section h2,#searchButton').forEach(el=>{
     if(el.children.length) return;
     const baseline=el.dataset.shopdropOriginalText||(el.dataset.shopdropOriginalText=el.textContent.trim());
     const translated=terms[baseline]?.[lang];
     if(translated)el.textContent=translated;
     else if(lang==='en'&&terms[baseline])el.textContent=baseline;
   });
   document.querySelectorAll('#search').forEach(el=>{
     el.placeholder=terms['Search products'][lang]||'Search products';
     el.setAttribute('aria-label',el.placeholder);
   });
   const control=document.getElementById('shopdrop-language-control');
   const menu=document.getElementById('menu');
   if(control && menu && !menu.contains(control)){
     control.style.cssText='position:relative;inset:auto;z-index:auto;background:#fff;color:#111;border:1px solid #ddd;border-radius:8px;padding:8px;margin:8px 0;font:14px system-ui,sans-serif';
     menu.appendChild(control);
   }
 }
 function init(){
   apply(language());
   document.getElementById('shopdrop-language-select')?.addEventListener('change',e=>apply(e.target.value));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
