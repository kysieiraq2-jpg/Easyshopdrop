/* Shop&Drop V26-13 homepage layout + controlled menu containment repair.
   Reorders/groups EXISTING homepage sections.
   Does NOT alter registration, listings, photographs, checkout,
   payments, taxonomy, Supabase or backend behaviour.

   FIX 177 CORRECTED:
   Four green marketplace blocks in the original 2x2 order:
   1. Transport Services & Equipment Hire
   2. Other Services
   3. Shop Products
   4. Sell an Item — FREE

   Reuse original working destination links.
   Preserve existing contact and header functionality.
*/
(function () {
  function norm(s){
    return String(s||"").replace(/\s+/g," ").trim().toLowerCase();
  }

  function headingElement(text){
    const wanted=norm(text);
    return [...document.querySelectorAll("h1,h2,h3,h4")]
      .find(el=>norm(el.textContent)===wanted) || null;
  }

  function sectionForHeading(text){
    const h=headingElement(text);
    if(!h)return null;
    return h.closest(
      "a.v264Card,section,article,.card,.panel,.v26-section,.v26-card"
    ) || h.parentElement;
  }

  function firstExisting(labels){
    for(const label of labels){
      const s=sectionForHeading(label);
      if(s)return s;
    }
    return null;
  }

  function moveAfter(node,anchor){
    if(!node||!anchor||node===anchor)return anchor;
    anchor.insertAdjacentElement("afterend",node);
    return node;
  }

  function setImportant(el,name,value){
    if(el){
      el.style.setProperty(name,value,"important");
    }
  }

  function greenBlock(link){
    if(!link)return;

    link.classList.remove("v264Card","v26-home-action-tile");
    link.removeAttribute("role");
    link.removeAttribute("tabindex");

    setImportant(link,"display","flex");
    setImportant(link,"flex-direction","column");
    setImportant(link,"align-items","center");
    setImportant(link,"justify-content","center");
    setImportant(link,"gap","6px");
    setImportant(link,"width","100%");
    setImportant(link,"min-width","0");
    setImportant(link,"min-height","125px");
    setImportant(link,"height","100%");
    setImportant(link,"padding","12px 8px");
    setImportant(link,"margin","0");
    setImportant(link,"box-sizing","border-box");
    setImportant(link,"background","#0f766e");
    setImportant(link,"background-image","none");
    setImportant(link,"color","#ffffff");
    setImportant(link,"border","1px solid #0f766e");
    setImportant(link,"border-radius","12px");
    setImportant(link,"font-weight","700");
    setImportant(link,"font-size","14px");
    setImportant(link,"line-height","1.35");
    setImportant(link,"text-align","center");
    setImportant(link,"text-decoration","none");
    setImportant(link,"white-space","normal");
    setImportant(link,"overflow-wrap","anywhere");
    setImportant(link,"box-shadow","none");
    setImportant(link,"transform","none");
    setImportant(link,"cursor","pointer");

    [...link.querySelectorAll("h2,h3,p,small,strong,span")]
      .forEach(child=>{
        setImportant(child,"color","#ffffff");
        setImportant(child,"text-align","center");
        setImportant(child,"margin","0");
        setImportant(child,"white-space","normal");
        setImportant(child,"overflow-wrap","anywhere");
      });
  }

  document.addEventListener("DOMContentLoaded", function(){
    const main=document.querySelector("main") || document.body;

    const how=firstExisting(["How Shop&Drop Works"]);
    const contact=firstExisting(["Contact Shop&Drop Admin"]);
    const intro=firstExisting(["Shop&Drop"]);

    const shop=
      document.querySelector('a.v264Card[href="./categories.html"]') ||
      firstExisting(["Shop Products"]);

    const service=
      document.querySelector('a.v264Card[href="./services.html"]') ||
      firstExisting(["Find Other Services","Find a Service"]);

    const dispatch=
      document.querySelector('a.v264Card[href="./dispatching.html"]') ||
      firstExisting([
        "Transport Services & Equipment Hire",
        "Dispatch & Transport"
      ]);

    const sell=firstExisting([
      "Sell / Offer — FREE",
      "Sell / Offer - FREE"
    ]);

    const categories=document.getElementById("shopdropHomeCategories197a")||firstExisting([
      "Shop by category",
      "Shop by Category"
    ]);

    const featured=firstExisting([
      "New & featured products",
      "New & Featured Products"
    ]);

    const preview=[...document.querySelectorAll("section,article,div")]
      .find(el=>norm(el.textContent).startsWith("preview site:"));

    let anchor=preview||null;

    if(how){
      anchor=anchor?moveAfter(how,anchor):(main.prepend(how),how);
    }

    if(contact){
      anchor=moveAfter(contact,anchor||how);
    }

    if(how && intro && intro!==how){
      const introWrap=document.createElement("div");
      introWrap.className="v26-shopdrop-introduction";

      while(intro.firstChild){
        introWrap.appendChild(intro.firstChild);
      }

      how.appendChild(introWrap);
      intro.hidden=true;
    }

    // FIX 177 CORRECTED:
    // Reuse the four original working links.
    // The Other Services block links to services.html.
    const actions=sell && sell.querySelector(".v264Actions");

    const itemLink=actions &&
      actions.querySelector('a[href="./sell-item.html?v=198j"],a[href="./sell-item.html?v=198i"],a[href="./product-selling-198h.html?v=198h"],a[href="./sell-item.html?v=198g"],a[href="./sell-item.html"]');

    const complete=
      dispatch &&
      service &&
      shop &&
      sell &&
      itemLink;

    if(complete){
      let action=document.getElementById("v26HomeActionBlock");

      if(!action){
        action=document.createElement("section");
        action.id="v26HomeActionBlock";
        action.className="v26-home-action-block";

        const heading=document.createElement("h2");
        heading.textContent="WHAT ARE YOU LOOKING FOR?";

        const grid=document.createElement("div");
        grid.className="v26-home-action-grid";

        action.append(heading,grid);
      }

      const grid=action.querySelector(".v26-home-action-grid");

      // Transport Services & Equipment Hire.
      const transportHeading=dispatch.querySelector("h2");
      const transportDescription=dispatch.querySelector("p");

      if(transportHeading){
        transportHeading.textContent=
          "Transport Services & Equipment Hire";
      }

      if(transportDescription){
        transportDescription.textContent=
          "Transport Services & Vehicle Hire • " +
          "Machinery, Equipment & Tool Hire";
      }

      // Other Services.
      const serviceHeading=service.querySelector("h2");
      const serviceDescription=service.querySelector("p");

      if(serviceHeading){
        serviceHeading.textContent="Other Services";
      }

      if(serviceDescription){
        serviceDescription.textContent=
          "Everyday services & professionals";
      }

      // Shop Products.
      const shopHeading=shop.querySelector("h2");
      const shopDescription=shop.querySelector("p");

      if(shopHeading){
        shopHeading.textContent="Shop Products";
      }

      if(shopDescription){
        shopDescription.textContent=
          "New, handmade & second-hand";
      }

      // Sell an Item.
      itemLink.textContent="Sell an Item — FREE";

      // Original white-card layout becomes four green blocks.
      // Move existing links rather than creating new destinations.
      grid.replaceChildren(
        dispatch,
        service,
        shop,
        itemLink
      );

      // The unused Sell / Offer container remains in the DOM.
      // Its other service/transport advertising links are preserved.
      sell.hidden=true;
      setImportant(sell,"display","none");

      setImportant(grid,"display","grid");
      setImportant(
        grid,
        "grid-template-columns",
        "repeat(2,minmax(0,1fr))"
      );
      setImportant(grid,"gap","10px");
      setImportant(grid,"width","100%");
      setImportant(grid,"align-items","stretch");

      [dispatch,service,shop,itemLink].forEach(greenBlock);

      // Ensure headings and descriptions stay white.
      [transportHeading,serviceHeading,shopHeading]
        .filter(Boolean)
        .forEach(heading=>{
          setImportant(heading,"color","#ffffff");
          setImportant(heading,"font-size","14px");
          setImportant(heading,"font-weight","700");
          setImportant(heading,"line-height","1.35");
          setImportant(heading,"margin","0");
        });

      [
        transportDescription,
        serviceDescription,
        shopDescription
      ].filter(Boolean).forEach(description=>{
        setImportant(description,"color","#ffffff");
        setImportant(description,"font-size","11px");
        setImportant(description,"font-weight","400");
        setImportant(description,"line-height","1.35");
        setImportant(description,"margin","0");
      });

      action.dataset.shopdropFourGreenActions="177";

      if(anchor){
        moveAfter(action,anchor);
      }else{
        main.prepend(action);
      }

      anchor=action;
    }else{
      // Safety fallback: preserve the original layout if
      // any expected existing link is missing.
      const available=[dispatch,service,shop,sell].filter(Boolean);

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
        });

        if(anchor){
          moveAfter(action,anchor);
        }else{
          main.prepend(action);
        }

        anchor=action;
      }
    }

    if(categories){
      anchor=moveAfter(categories,anchor||contact||how);
    }

    if(featured){
      anchor=moveAfter(featured,anchor||categories);
    }

    // V26_11_CONTACT_PRESENTATION:
    // Preserve existing contact hrefs and configuration.
    if(contact){
      contact.classList.add("v26-contact-admin");

      [...contact.querySelectorAll("p,small")].forEach(el=>{
        const tx=norm(el.textContent);

        if(
          tx.includes("inserted later") ||
          tx.includes("added later") ||
          (tx.includes("official email") && tx.includes("whatsapp"))
        ){
          el.hidden=true;
        }
      });

      const links=[...contact.querySelectorAll("a[href]")];

      const wa=links.find(a=>
        /whatsapp|wa\.me/i.test(
          (a.textContent||"")+" "+(a.getAttribute("href")||"")
        )
      );

      const email=links.find(a=>
        /email|mailto:/i.test(
          (a.textContent||"")+" "+(a.getAttribute("href")||"")
        )
      );

      const complaint=links.find(a=>
        /complaint|suggestion/i.test(a.textContent||"")
      );

      if(wa){
        wa.classList.add("v26-contact-link","v26-whatsapp-link");

        if(!wa.querySelector(".v26-whatsapp-mark")){
          const mark=document.createElement("span");
          mark.className="v26-whatsapp-mark";
          mark.setAttribute("aria-hidden","true");
          mark.textContent="☎";
          wa.prepend(mark);
        }

        const txt=[...wa.childNodes].find(n=>
          n.nodeType===Node.TEXT_NODE && n.textContent.trim()
        );

        if(txt){
          txt.textContent=" WhatsApp Shop&Drop";
        }
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

        const txt=[...email.childNodes].find(n=>
          n.nodeType===Node.TEXT_NODE && n.textContent.trim()
        );

        if(txt){
          txt.textContent=" Email Shop&Drop";
        }
      }

      if(complaint){
        complaint.classList.add(
          "v26-contact-link","v26-complaint-link"
        );
      }
    }

    // V26_21:
    // Header is stable static markup.
    // No DOM re-parenting is permitted here.
    document.documentElement.dataset.shopdropHomepageLayout="v26-13";

    // V26_25_BROWSE_BAG_EQUAL_WIDTH:
    // Preserve previously approved header alignment.
    if(
      document.querySelector(".shopdrop-browse-bag-row") &&
      !document.getElementById("shopdropBrowseBagAlignmentFix")
    ){
      const style=document.createElement("style");
      style.id="shopdropBrowseBagAlignmentFix";

      style.textContent=`
        .shopdrop-header-actions{
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          gap:8px!important;
          width:100%!important;
        }

        .shopdrop-header-secondary,
        .shopdrop-browse-bag-row{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
          gap:8px!important;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          align-items:stretch!important;
          justify-self:stretch!important;
        }

        .shopdrop-header-secondary > *,
        .shopdrop-browse-bag-row > *{
          min-width:0!important;
          width:100%!important;
          max-width:100%!important;
          margin:0!important;
          box-sizing:border-box!important;
        }

        .shopdrop-browse-bag-row .shopdrop-header-bag,
        .shopdrop-browse-bag-row .shopdrop-header-browse{
          display:flex!important;
          flex-direction:column!important;
          align-items:center!important;
          justify-content:center!important;
          width:100%!important;
          min-width:0!important;
          justify-self:stretch!important;
          text-align:center!important;
          white-space:normal!important;
        }

        /* V26_26_HEIGHT_ONLY:
           Preserve approved header button heights. */
        .shopdrop-browse-bag-row .shopdrop-header-bag,
        .shopdrop-browse-bag-row .shopdrop-header-browse{
          height:64px!important;
          min-height:64px!important;
          max-height:64px!important;
          padding:4px!important;
          box-sizing:border-box!important;
        }

        .shopdrop-browse-bag-row .shopdrop-header-browse{
          gap:2px!important;
        }

        .shopdrop-header-browse strong{
          font-size:12px!important;
          line-height:1.15!important;
        }

        .shopdrop-header-browse small{
          font-size:10px!important;
          line-height:1.15!important;
        }
      `;

      document.head.appendChild(style);
    }
  });
})();
