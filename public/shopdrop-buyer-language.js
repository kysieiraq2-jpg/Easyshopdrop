/* Shop&Drop multilingual buyer-page UI bridge.
   Static interface labels only; never changes financial data or form values. */
(() => {
 'use strict';
 const names={en:'English',af:'Afrikaans',ar:'العربية',fr:'Français',es:'Español',pt:'Português'};
 const terms={
 'Checkout':{af:'Betaalpunt',ar:'إتمام الشراء',fr:'Paiement',es:'Finalizar compra',pt:'Finalizar compra'},
 'Shopping bag':{af:'Inkopiemandjie',ar:'سلة التسوق',fr:'Panier',es:'Cesta de compra',pt:'Cesto de compras'},
 'Delivery address':{af:'Afleweringsadres',ar:'عنوان التسليم',fr:'Adresse de livraison',es:'Dirección de entrega',pt:'Morada de entrega'},
 'Payment method':{af:'Betaalmetode',ar:'طريقة الدفع',fr:'Mode de paiement',es:'Método de pago',pt:'Método de pagamento'},
 'Find a courier':{af:'Vind ’n koerier',ar:'العثور على شركة توصيل',fr:'Trouver un transporteur',es:'Buscar un mensajero',pt:'Encontrar uma transportadora'},
 'Save address':{af:'Stoor adres',ar:'حفظ العنوان',fr:'Enregistrer l’adresse',es:'Guardar dirección',pt:'Guardar morada'},
 'Preview order':{af:'Voorskou bestelling',ar:'معاينة الطلب',fr:'Aperçu de la commande',es:'Vista previa del pedido',pt:'Pré-visualizar encomenda'},
 'Track My Order':{af:'Volg my bestelling',ar:'تتبع طلبي',fr:'Suivre ma commande',es:'Seguir mi pedido',pt:'Seguir a minha encomenda'},
 'Order journey':{af:'Bestelling se reis',ar:'رحلة الطلب',fr:'Parcours de commande',es:'Recorrido del pedido',pt:'Percurso da encomenda'},
 'Tracking Source & Status':{af:'Naspoorbron en status',ar:'مصدر التتبع والحالة',fr:'Source et état du suivi',es:'Fuente y estado del seguimiento',pt:'Origem e estado do seguimento'},
 'Track order':{af:'Volg bestelling',ar:'تتبع الطلب',fr:'Suivre la commande',es:'Seguir pedido',pt:'Seguir encomenda'},
 'Returns, Refunds & Disputes':{af:'Terugsendings, terugbetalings en geskille',ar:'المرتجعات والمبالغ المستردة والنزاعات',fr:'Retours, remboursements et litiges',es:'Devoluciones, reembolsos y disputas',pt:'Devoluções, reembolsos e litígios'},
 'My Returns & Refunds':{af:'My terugsendings en terugbetalings',ar:'مرتجعاتي ومبالغي المستردة',fr:'Mes retours et remboursements',es:'Mis devoluciones y reembolsos',pt:'As minhas devoluções e reembolsos'},
 'Open dispute':{af:'Open geskil',ar:'فتح نزاع',fr:'Ouvrir un litige',es:'Abrir disputa',pt:'Abrir litígio'},
 'Categories & Search':{af:'Kategorieë en soek',ar:'الفئات والبحث',fr:'Catégories et recherche',es:'Categorías y búsqueda',pt:'Categorias e pesquisa'},
 'Where do you want to shop?':{af:'Waar wil jy inkopies doen?',ar:'أين تريد التسوق؟',fr:'Où souhaitez-vous acheter ?',es:'¿Dónde quieres comprar?',pt:'Onde pretende comprar?'},
 'What are you looking for?':{af:'Waarna soek jy?',ar:'عمّ تبحث؟',fr:'Que recherchez-vous ?',es:'¿Qué estás buscando?',pt:'O que procura?'},
 'Product departments A–Z':{af:'Produkafdelings A–Z',ar:'أقسام المنتجات أ–ي',fr:'Rayons de produits A–Z',es:'Secciones de productos A–Z',pt:'Departamentos de produtos A–Z'},
 'Search Products':{af:'Soek produkte',ar:'البحث عن المنتجات',fr:'Rechercher des produits',es:'Buscar productos',pt:'Pesquisar produtos'}
 };
 function current(){
   try{const s=localStorage.getItem('shopdrop-ui-language');if(names[s])return s;}catch(_){}
   const b=(navigator.language||'en').toLowerCase().split('-')[0];
   return names[b]?b:'en';
 }
 function init(){
   if(document.getElementById('shopdrop-buyer-language-select'))return;
   const box=document.createElement('div');
   box.style.cssText='max-width:900px;margin:8px auto;padding:8px 14px;font:14px Arial,sans-serif';
   const label=document.createElement('label');
   label.htmlFor='shopdrop-buyer-language-select';label.textContent='Language: ';
   const select=document.createElement('select');
   select.id='shopdrop-buyer-language-select';select.setAttribute('aria-label','Website language');
   select.style.cssText='width:auto;max-width:180px;padding:7px;color:#17202a;background:white';
   for(const [code,name] of Object.entries(names)){
     const option=document.createElement('option');option.value=code;option.textContent=name;select.appendChild(option);
   }
   box.append(label,select);document.body.insertBefore(box,document.body.firstChild);
   // Only static UI nodes. Never modify checkout amounts, addresses, or order records.
   const nodes=[...document.querySelectorAll('h1,h2,button')].filter(el=>el.children.length===0 && terms[el.textContent.trim()]);
   for(const el of nodes)el.dataset.shopdropOriginalText=el.textContent.trim();
   function apply(lang){
     document.documentElement.lang=lang;
     for(const el of nodes){
       const base=el.dataset.shopdropOriginalText;
       el.textContent=terms[base]?.[lang]||base;
     }
     select.value=lang;
   }
   select.addEventListener('change',()=>{
     try{localStorage.setItem('shopdrop-ui-language',select.value);}catch(_){}
     apply(select.value);
   });
   apply(current());
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
