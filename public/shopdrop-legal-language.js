/* Shop&Drop legal-page language selector — does not translate legal terms. */
(() => {
  'use strict';
  const names={en:'English',af:'Afrikaans',ar:'العربية',fr:'Français',es:'Español',pt:'Português'};
  const messages={
    en:'Legal information is currently available in English. An approved translation is not yet available.',
    af:'Regsinligting is tans in Engels beskikbaar. ’n Goedgekeurde vertaling is nog nie beskikbaar nie.',
    ar:'المعلومات القانونية متاحة حالياً باللغة الإنجليزية. لا تتوفر ترجمة معتمدة بعد.',
    fr:'Les informations juridiques sont actuellement en anglais. Aucune traduction approuvée n’est encore disponible.',
    es:'La información legal está disponible actualmente en inglés. Aún no hay una traducción aprobada.',
    pt:'A informação jurídica está atualmente disponível em inglês. Ainda não existe uma tradução aprovada.'
  };
  function chosen(){
    try{const v=localStorage.getItem('shopdrop-ui-language');if(names[v])return v;}catch(_){}
    const b=(navigator.language||'en').toLowerCase().split('-')[0];
    return names[b]?b:'en';
  }
  function init(){
    if(document.getElementById('shopdrop-legal-language'))return;
    const wrap=document.createElement('div');
    wrap.style.cssText='max-width:900px;margin:8px auto;padding:12px;font:14px Arial,sans-serif;background:#f7f8fa;color:#17202a;border-radius:8px';
    const label=document.createElement('label');
    label.textContent='Language: ';label.htmlFor='shopdrop-legal-language';
    const select=document.createElement('select');select.id='shopdrop-legal-language';
    select.setAttribute('aria-label','Website language');
    for(const [code,name] of Object.entries(names)){
      const option=document.createElement('option');option.value=code;option.textContent=name;select.appendChild(option);
    }
    const note=document.createElement('p');note.setAttribute('role','note');
    wrap.append(label,select,note);
    document.body.insertBefore(wrap,document.body.firstChild);
    function apply(lang){
      document.documentElement.lang='en'; // Legal body is still English.
      select.value=lang;note.textContent=messages[lang]||messages.en;
      note.lang=lang;note.dir=lang==='ar'?'rtl':'ltr';
    }
    select.addEventListener('change',()=>{
      try{localStorage.setItem('shopdrop-ui-language',select.value);}catch(_){}
      apply(select.value);
    });
    apply(chosen());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
