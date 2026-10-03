/* Shop&Drop V26-13 homepage layout + controlled menu containment repair.
   Reorders/groups EXISTING homepage sections.
   Does NOT alter hrefs, event handlers, listing logic, taxonomy, finance or backend behaviour. */
(function () {
  function norm(s){return String(s||"").replace(/\s+/g," ").trim().toLowerCase();}
  function headingElement(text){
    const wanted=norm(text);
    return [...document.querySelectorAll("h1,h2,h3,h4")].find(el=>norm(el.textContent)===wanted) || null;
  }
  function sectionForHeading(text){
    const h=headingElement(text);
    if(!h)return null;
    return h.closest("section,article,.card,.panel,.v26-section,.v26-card") || h.parentElement;
  }
  function firstExisting(labels){
    for(const label of labels){const s=sectionForHeading(label);if(s)return s;}
    return null;
  }
  function moveAfter(node,anchor){
    if(!node||!anchor||node===anchor)return anchor;
    anchor.insertAdjacentElement("afterend",node);return node;
  }
  document.addEventListener("DOMContentLoaded", function(){
    const main=document.querySelector("main") || document.body;
    const how=firstExisting(["How Shop&Drop Works"]);
    const contact=firstExisting(["Contact Shop&Drop Admin"]);
    const intro=firstExisting(["Shop&Drop"]);
    const shop=firstExisting(["Shop Products"]);
    const service=firstExisting(["Find Other Services","Find a Service"]);
    const dispatch=firstExisting(["Dispatch & Transport"]);
    const sell=firstExisting(["Sell / Offer — FREE","Sell / Offer - FREE"]);
    const categories=firstExisting(["Shop by category","Shop by Category"]);
    const featured=firstExisting(["New & featured products","New & Featured Products"]);
    const preview=[...document.querySelectorAll("section,article,div")].find(el=>norm(el.textContent).startsWith("preview site:"));

    let anchor=preview||null;
    if(how) anchor=anchor?moveAfter(how,anchor):(main.prepend(how),how);
    if(contact) anchor=moveAfter(contact,anchor||how);
    if(how && intro && intro!==how){
      // V26_11_INTRO_CONSOLIDATION_CORRECTED:
      // Keep the original Shop&Drop introduction wording/content intact,
      // but place that content inside the broader How Shop&Drop Works area.
      const introWrap=document.createElement("div");
      introWrap.className="v26-shopdrop-introduction";
      while(intro.firstChild) introWrap.appendChild(intro.firstChild);
      how.appendChild(introWrap);
      intro.hidden=true;
    }

    // One user-friendly action block; existing cards/links are moved, not rewritten.
    const available=[shop,service,dispatch,sell].filter(Boolean);
    if(available.length){
      let action=document.getElementById("v26HomeActionBlock");
      if(!action){
        action=document.createElement("section");
        action.id="v26HomeActionBlock";
        action.className="v26-home-action-block";
        const h=document.createElement("h2");
        h.textContent="WHAT ARE YOU LOOKING FOR?";
        const grid=document.createElement("div");
        grid.className="v26-home-action-grid";
        action.append(h,grid);
      }
      const grid=action.querySelector(".v26-home-action-grid");
      available.forEach(card=>{
        grid.appendChild(card);
        // V26_11_EXISTING_LINK_TILE_CLICK: reuse existing href; never invent/replace link targets.
        const existing=card.matches("a[href]")?card:card.querySelector("a[href]");
        if(existing){
          card.classList.add("v26-home-action-tile");
          if(!card.matches("a[href]")){
            card.setAttribute("role","link");
            card.tabIndex=0;
            const go=()=>existing.click();
            card.addEventListener("click",e=>{if(e.target.closest("a,button,input,select,textarea"))return;go();});
            card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
          }
        }
      });
      if(anchor) moveAfter(action,anchor); else main.prepend(action);
      anchor=action;
    }
    if(categories) anchor=moveAfter(categories,anchor||contact||how);
    if(featured) anchor=moveAfter(featured,anchor||categories);

    
    // V26_11_CONTACT_PRESENTATION — presentation only; preserve existing contact hrefs/config.
    if(contact){
      contact.classList.add("v26-contact-admin");
      // Remove development-only explanatory text from the visible homepage.
      [...contact.querySelectorAll("p,small")].forEach(el=>{
        const tx=norm(el.textContent);
        if(tx.includes("inserted later") || tx.includes("added later") || tx.includes("official email") && tx.includes("whatsapp")){
          el.hidden=true;
        }
      });

      const links=[...contact.querySelectorAll("a[href]")];
      const wa=links.find(a=>/whatsapp|wa\.me/i.test((a.textContent||"")+" "+(a.getAttribute("href")||"")));
      const email=links.find(a=>/email|mailto:/i.test((a.textContent||"")+" "+(a.getAttribute("href")||"")));
      const complaint=links.find(a=>/complaint|suggestion/i.test(a.textContent||""));

      if(wa){
        wa.classList.add("v26-contact-link","v26-whatsapp-link");
        // Familiar WhatsApp-style speech-bubble/phone mark; no external asset/dependency.
        if(!wa.querySelector(".v26-whatsapp-mark")){
          const mark=document.createElement("span");
          mark.className="v26-whatsapp-mark";
          mark.setAttribute("aria-hidden","true");
          mark.textContent="☎";
          wa.prepend(mark);
        }
        const txt=[...wa.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
        if(txt) txt.textContent=" WhatsApp Shop&Drop";
      }
      if(email){
        email.classList.add("v26-contact-link","v26-email-link");
        if(!email.querySelector(".v26-email-mark")){
          const mark=document.createElement("span");
          mark.className="v26-email-mark";
          mark.setAttribute("aria-hidden","true");
          mark.textContent="✉";
          email.prepend(mark);
        }
        const txt=[...email.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
        if(txt) txt.textContent=" Email Shop&Drop";
      }
      if(complaint) complaint.classList.add("v26-contact-link","v26-complaint-link");
    }

    
    // V26_11_HEADER_COSMETIC_REPAIR — layout only; reuse existing controls and handlers.
    const pageHeader=document.querySelector("header");
    if(pageHeader){
      pageHeader.classList.add("v26-clean-header");
      const brand=[...pageHeader.querySelectorAll("a,div,strong,h1,h2")].find(el=>norm(el.textContent)==="shop&drop");
      const menu=[...pageHeader.querySelectorAll("button,a")].find(el=>norm(el.textContent).includes("menu"));
      const searchInput=pageHeader.querySelector('input[type="search"],input[placeholder*="Search" i]');
      const searchButton=[...pageHeader.querySelectorAll("button,input[type='submit']")].find(el=>norm(el.textContent||el.value)==="search");
      const bag=[...pageHeader.querySelectorAll("a,button")].find(el=>norm(el.textContent)==="bag");
      const account=[...pageHeader.querySelectorAll("a,button")].find(el=>/sign in\s*\/\s*account/i.test(el.textContent||""));

      if(brand) brand.classList.add("v26-header-brand");
      if(searchInput) searchInput.classList.add("v26-header-search-input");
      if(searchButton) searchButton.classList.add("v26-header-search-button");
      if(menu) menu.classList.add("v26-header-menu-button");
      if(bag) bag.classList.add("v26-header-bag");
      if(account) account.classList.add("v26-header-account");

      // Build layout wrappers by MOVING the existing elements only.
      if(brand && !pageHeader.querySelector(".v26-header-brand-row")){
        const row=document.createElement("div"); row.className="v26-header-brand-row";
        brand.parentNode.insertBefore(row,brand); row.appendChild(brand);
      }
      if(account && menu && !pageHeader.querySelector(".v26-header-account-menu-row")){
        const row=document.createElement("div"); row.className="v26-header-account-menu-row";
        account.parentNode.insertBefore(row,account);
        // V26_13_MENU_CONTAINMENT_REPAIR:
        // Move the complete .menuwrap (button + nav), not the button alone.
        // The existing click-away handler relies on the button remaining inside .menuwrap.
        const menuWrap=menu.closest(".menuwrap") || menu;
        row.append(account,menuWrap);
      }
      if(searchInput && searchButton && !pageHeader.querySelector(".v26-header-search-row")){
        const row=document.createElement("div"); row.className="v26-header-search-row";
        const first=searchInput;
        first.parentNode.insertBefore(row,first);
        row.append(searchInput,searchButton);
      }
      if(bag && !pageHeader.querySelector(".v26-header-bag-row")){
        const row=document.createElement("div"); row.className="v26-header-bag-row";
        bag.parentNode.insertBefore(row,bag);
        row.append(bag);
      }
    }

    document.documentElement.dataset.shopdropHomepageLayout="v26-13";
  });
})();