/* Shop&Drop Fix 3F — static UI translations only; preserves all business logic. */
(() => {
'use strict';
const languages={en:'English',af:'Afrikaans',ar:'العربية',fr:'Français',es:'Español',pt:'Português'};
const terms={
'Other Services':{af:'Ander dienste',ar:'خدمات أخرى',fr:'Autres services',es:'Otros servicios',pt:'Outros serviços'},
'Other Service categories':{af:'Ander dienskategorieë',ar:'فئات الخدمات الأخرى',fr:'Catégories de services',es:'Categorías de servicios',pt:'Categorias de serviços'},
'How an Other Service booking works':{af:'Hoe diensbesprekings werk',ar:'كيفية حجز خدمة',fr:'Comment réserver un service',es:'Cómo reservar un servicio',pt:'Como reservar um serviço'},
"Can't find the right category?":{af:'Kan jy nie die regte kategorie vind nie?',ar:'لا تجد الفئة المناسبة؟',fr:'Vous ne trouvez pas la bonne catégorie ?',es:'¿No encuentras la categoría adecuada?',pt:'Não encontra a categoria certa?'},
'Service Attendance':{af:'Diensbywoning',ar:'حضور مقدم الخدمة',fr:'Présence du prestataire',es:'Asistencia del proveedor',pt:'Presença do prestador'},
'Request Dispatching & Transport':{af:'Versoek versending en vervoer',ar:'طلب الشحن والنقل',fr:'Demander une expédition ou un transport',es:'Solicitar envío y transporte',pt:'Solicitar expedição e transporte'},
'How the transaction works':{af:'Hoe die transaksie werk',ar:'كيفية عمل المعاملة',fr:'Comment fonctionne la transaction',es:'Cómo funciona la transacción',pt:'Como funciona a transação'},
'Communication & trust':{af:'Kommunikasie en vertroue',ar:'التواصل والثقة',fr:'Communication et confiance',es:'Comunicación y confianza',pt:'Comunicação e confiança'},
'Dispatch Tracking':{af:'Versendingnasporing',ar:'تتبع الشحن',fr:'Suivi des expéditions',es:'Seguimiento del envío',pt:'Seguimento da expedição'},
'How Shop&Drop Works':{af:'Hoe Shop&Drop werk',ar:'كيف يعمل Shop&Drop',fr:'Comment fonctionne Shop&Drop',es:'Cómo funciona Shop&Drop',pt:'Como funciona o Shop&Drop'},
'Shop products':{af:'Koop produkte',ar:'تسوق المنتجات',fr:'Acheter des produits',es:'Comprar productos',pt:'Comprar produtos'},
'Sell a product — FREE':{af:'Verkoop ’n produk — GRATIS',ar:'بيع منتج — مجاناً',fr:'Vendre un produit — GRATUIT',es:'Vender un producto — GRATIS',pt:'Vender um produto — GRÁTIS'},
'Dispatching & Transport':{af:'Versending en vervoer',ar:'الشحن والنقل',fr:'Expédition et transport',es:'Envíos y transporte',pt:'Expedição e transporte'},
'Complaints & Suggestions':{af:'Klagtes en voorstelle',ar:'الشكاوى والاقتراحات',fr:'Réclamations et suggestions',es:'Quejas y sugerencias',pt:'Reclamações e sugestões'}
};
function chosen(){
 try {const v=localStorage.getItem('shopdrop-ui-language');if(languages[v])return v;}catch(_){}
 const v=(navigator.language||'en').toLowerCase().split('-')[0];
 return languages[v]?v:'en';
}
function init(){
 if(document.getElementById('shopdrop-info-language-select'))return;
 const box=document.createElement('div');box.style.cssText='max-width:900px;margin:8px auto;padding:8px 14px;font:14px Arial,sans-serif';
 const label=document.createElement('label');label.htmlFor='shopdrop-info-language-select';label.textContent='Language: ';
 const select=document.createElement('select');select.id='shopdrop-info-language-select';select.setAttribute('aria-label','Website language');select.style.cssText='width:auto;max-width:180px;padding:7px;color:#17202a;background:white';
 for(const [code,name] of Object.entries(languages)){const opt=document.createElement('option');opt.value=code;opt.textContent=name;select.appendChild(opt);}
 box.append(label,select);document.body.insertBefore(box,document.body.firstChild);
 const nodes=[...document.querySelectorAll('h1,h2,h3,button')].filter(el=>!el.children.length && terms[el.textContent.trim()]);
 for(const el of nodes)el.dataset.shopdropOriginalText=el.textContent.trim();
 function apply(lang){
  document.documentElement.lang=lang;
  for(const el of nodes){const baseline=el.dataset.shopdropOriginalText;el.textContent=terms[baseline]?.[lang]||baseline;}
  select.value=lang;
 }
 select.addEventListener('change',()=>{try{localStorage.setItem('shopdrop-ui-language',select.value)}catch(_){}apply(select.value)});
 apply(chosen());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
