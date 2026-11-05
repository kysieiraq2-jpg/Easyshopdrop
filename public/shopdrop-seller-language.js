/* Shop&Drop seller UI translation bridge; no form/data/payment changes. */
(() => {
 'use strict';
 const dict = {
  af:{'Sell something — FREE':'Verkoop iets — GRATIS','Seller & Service Provider Centre':'Verkoper- en diensverskaffersentrum','My account':'My rekening','Email':'E-pos','Password':'Wagwoord','Submit':'Dien in','Save':'Stoor'},
  ar:{'Sell something — FREE':'بع شيئاً — مجاناً','Seller & Service Provider Centre':'مركز البائع ومقدم الخدمة','My account':'حسابي','Email':'البريد الإلكتروني','Password':'كلمة المرور','Submit':'إرسال','Save':'حفظ'},
  fr:{'Sell something — FREE':'Vendre un article — GRATUIT','Seller & Service Provider Centre':'Espace vendeurs et prestataires','My account':'Mon compte','Email':'E-mail','Password':'Mot de passe','Submit':'Envoyer','Save':'Enregistrer'},
  es:{'Sell something — FREE':'Vender algo — GRATIS','Seller & Service Provider Centre':'Centro de vendedores y proveedores','My account':'Mi cuenta','Email':'Correo electrónico','Password':'Contraseña','Submit':'Enviar','Save':'Guardar'},
  pt:{'Sell something — FREE':'Vender algo — GRÁTIS','Seller & Service Provider Centre':'Centro de vendedores e prestadores','My account':'A minha conta','Email':'E-mail','Password':'Palavra-passe','Submit':'Enviar','Save':'Guardar'}
 };
 const names={en:'English',af:'Afrikaans',ar:'العربية',fr:'Français',es:'Español',pt:'Português'};
 function chosen(){try{const v=localStorage.getItem('shopdrop-ui-language');if(names[v])return v;}catch(_){}const b=(navigator.language||'en').split('-')[0].toLowerCase();return names[b]?b:'en';}
 function init(){
   if(document.getElementById('shopdrop-language-select'))return;
   const wrap=document.createElement('div');wrap.style.cssText='max-width:650px;margin:8px auto;padding:8px 14px;font:14px Arial,sans-serif';
   const label=document.createElement('label');label.htmlFor='shopdrop-language-select';label.textContent='Language: ';
   const sel=document.createElement('select');sel.id='shopdrop-language-select';sel.setAttribute('aria-label','Website language');sel.style.cssText='width:auto;max-width:180px;padding:7px;color:#17202a;background:white';
   for(const [code,name] of Object.entries(names)){const opt=document.createElement('option');opt.value=code;opt.textContent=name;sel.appendChild(opt);}
   wrap.append(label,sel);document.body.insertBefore(wrap,document.body.firstChild);
   const nodes=[...document.querySelectorAll('h1,label,button')].filter(el=>!el.children.length);
   for(const el of nodes)el.dataset.shopdropOriginalText=el.textContent.trim();
   function apply(lang){document.documentElement.lang=lang;for(const el of nodes){const v=el.dataset.shopdropOriginalText;el.textContent=dict[lang]?.[v]||v;}sel.value=lang;}
   sel.addEventListener('change',()=>{try{localStorage.setItem('shopdrop-ui-language',sel.value)}catch(_){}apply(sel.value)});
   apply(chosen());
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
