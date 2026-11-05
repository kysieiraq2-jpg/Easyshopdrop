/* Shop&Drop Fix 3I: additional form labels only. No input values or validation changes. */
(() => {
 'use strict';
 const names=['en','af','ar','fr','es','pt'];
 const translations={
  'Mobile number (international format)':{af:'Selfoonnommer (internasionale formaat)',ar:'رقم الهاتف (بالتنسيق الدولي)',fr:'Numéro de mobile (format international)',es:'Número de móvil (formato internacional)',pt:'Número de telemóvel (formato internacional)'},
  'Seller type':{af:'Verkopertipe',ar:'نوع البائع',fr:'Type de vendeur',es:'Tipo de vendedor',pt:'Tipo de vendedor'},
  'Seller / business name':{af:'Verkoper- / besigheidsnaam',ar:'اسم البائع / النشاط التجاري',fr:'Nom du vendeur / entreprise',es:'Nombre del vendedor / empresa',pt:'Nome do vendedor / empresa'},
  'Country':{af:'Land',ar:'البلد',fr:'Pays',es:'País',pt:'País'},
  'Cellphone':{af:'Selfoon',ar:'الهاتف المحمول',fr:'Téléphone portable',es:'Teléfono móvil',pt:'Telemóvel'},
  'WhatsApp (optional)':{af:'WhatsApp (opsioneel)',ar:'واتساب (اختياري)',fr:'WhatsApp (facultatif)',es:'WhatsApp (opcional)',pt:'WhatsApp (opcional)'},
  'Choose how you would like to pay':{af:'Kies hoe jy wil betaal',ar:'اختر طريقة الدفع',fr:'Choisissez votre mode de paiement',es:'Elige cómo deseas pagar',pt:'Escolha como pretende pagar'},
  'Courier company':{af:'Koeriermaatskappy',ar:'شركة التوصيل',fr:'Transporteur',es:'Empresa de mensajería',pt:'Transportadora'}
 };
 const placeholders={
  'Address label':{af:'Adresbenaming',ar:'اسم العنوان',fr:'Libellé de l’adresse',es:'Etiqueta de dirección',pt:'Nome da morada'},
  'Recipient name':{af:'Ontvanger se naam',ar:'اسم المستلم',fr:'Nom du destinataire',es:'Nombre del destinatario',pt:'Nome do destinatário'},
  'Street address':{af:'Straatadres',ar:'عنوان الشارع',fr:'Adresse',es:'Dirección',pt:'Morada'},
  'City':{af:'Stad',ar:'المدينة',fr:'Ville',es:'Ciudad',pt:'Cidade'},
  'State / Province / Region':{af:'Staat / Provinsie / Streek',ar:'الولاية / المحافظة / المنطقة',fr:'État / Province / Région',es:'Estado / Provincia / Región',pt:'Estado / Província / Região'},
  'Postal / ZIP code':{af:'Poskode',ar:'الرمز البريدي',fr:'Code postal',es:'Código postal',pt:'Código postal'},
  'Search courier name':{af:'Soek koeriernaam',ar:'ابحث عن شركة توصيل',fr:'Rechercher un transporteur',es:'Buscar empresa de mensajería',pt:'Pesquisar transportadora'},
  'Mobile number':{af:'Selfoonnommer',ar:'رقم الهاتف المحمول',fr:'Numéro de mobile',es:'Número de móvil',pt:'Número de telemóvel'}
 };
 function lang(){
   try{const v=localStorage.getItem('shopdrop-ui-language');if(names.includes(v))return v;}catch(_){}
   const v=(navigator.language||'en').toLowerCase().split('-')[0];return names.includes(v)?v:'en';
 }
 function init(){
   const labels=[...document.querySelectorAll('label')].filter(e=>!e.children.length && translations[e.textContent.trim()]);
   const inputs=[...document.querySelectorAll('input')].filter(e=>placeholders[e.getAttribute('placeholder')]);
   for(const e of labels)e.dataset.shopdropFormOriginal=e.textContent.trim();
   for(const e of inputs)e.dataset.shopdropPlaceholderOriginal=e.getAttribute('placeholder');
   function apply(code){
     for(const e of labels){
       const key=e.dataset.shopdropFormOriginal;
       e.textContent=translations[key]?.[code]||key;
     }
     for(const e of inputs){
       const key=e.dataset.shopdropPlaceholderOriginal;
       e.setAttribute('placeholder',placeholders[key]?.[code]||key);
     }
   }
   document.addEventListener('change',event=>{
     if(event.target?.matches('select[id*="language"]'))apply(event.target.value);
   });
   apply(lang());
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
