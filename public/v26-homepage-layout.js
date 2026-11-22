/* Shop&Drop V26-13 homepage layout + controlled menu containment repair.
   Reorders/groups EXISTING homepage sections.
   Does NOT alter listing, registration, photos, checkout, finance or backend logic.

   FIX 176:
   Present four existing marketplace actions as green buttons.
   Preserve the original destinations and other homepage functionality.

   V26_26_HEIGHT_ONLY:
   Preserve existing widths. Match bottom button heights to top buttons.
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
    const featured=firstExisting([
      "New & featured products","New & Featured Products"
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
      // V26_11_INTRO_CONSOLIDATION_CORRECTED:
      // Keep original introduction content intact.
      const introWrap=document.createElement("div");
      introWrap.className="v26-shopdrop-introduction";
      while(intro.firstChild){
        introWrap.appendChild(intro.firstChild);
      }
      how.appendChild(introWrap);
      intro.hidden=true;
    }

    // Preserve the existing marketplace elements.
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

        // FIX 176:
        // The Sell / Offer section contains multiple independent links.
        // Never make the whole section navigate to one destination.
        if(card===sell){
          card.classList.remove("v26-home-action-tile");
          card.removeAttribute("role");
          card.removeAttribute("tabindex");
          return;
        }

        const existing=card.matches("a[href]")
          ?card
          :card.querySelector("a[href]");

        if(existing){
          card.classList.add("v26-home-action-tile");

          if(!card.matches("a[href]")){
            card.setAttribute("role","link");
            card.tabIndex=0;

            const go=()=>existing.click();

            card.addEventListener("click",e=>{
              if(e.target.closest("a,button,input,select,textarea"))return;
              go();
            });

            card.addEventListener("keydown",e=>{
              if(e.key==="Enter"||e.key===" "){
                e.preventDefault();
                go();
              }
            });
          }
        }
      });

      // FIX 176:
      // Reuse the three existing advertising links and Shop Products.
      // Do not recreate their destinations or touch their page logic.
      if(sell && shop){
        const actions=sell.querySelector(".v264Actions");

        const item=actions &&
          actions.querySelector('a[href="./sell-item.html"]');

        const offer=actions &&
          actions.querySelector('a[href="./seller.html#list-service"]');

        const transport=actions &&
          actions.querySelector('a[href="./dispatching.html"]');

        if(actions && item && offer && transport){
          // Keep original buyer-discovery destinations accessible
          // through the existing main menu.
          if(dispatch){
            dispatch.style.display="none";
          }

          if(service){
            service.style.display="none";
          }

          // Move the original Shop Products link, preserving its href.
          shop.classList.remove("v264Card","v26-home-action-tile");
          shop.removeAttribute("role");
          shop.removeAttribute("tabindex");
          actions.appendChild(shop);

          const shopHeading=shop.querySelector("h2");
          const shopDescription=shop.querySelector("p");

          if(shopHeading){
            shopHeading.textContent="Shop Products";
          }

          if(shopDescription){
            shopDescription.textContent="New, handmade & second-hand";
          }

          item.textContent="Sell an Item — FREE";
          offer.textContent="Offer a Service — FREE";
          transport.textContent=
            "Offer Transport Services or Equipment Hire — FREE";

          const sellHeading=sell.querySelector("h2");
          if(sellHeading){
            sellHeading.hidden=true;
          }

          grid.style.gridTemplateColumns="minmax(0,1fr)";
          sell.style.width="100%";
          sell.style.minWidth="0";
          sell.style.height="auto";
          sell.style.margin="0";
          sell.style.cursor="default";

          actions.style.display="grid";
          actions.style.gridTemplateColumns=
            "repeat(2,minmax(0,1fr))";
          actions.style.gap="10px";
          actions.style.width="100%";
          actions.style.margin="0";
          actions.style.justifyContent="stretch";
          actions.style.alignItems="stretch";

          [item,offer,transport,shop].forEach(link=>{
            link.style.display="flex";
            link.style.flexDirection="column";
            link.style.alignItems="center";
            link.style.justifyContent="center";
            link.style.gap="5px";
            link.style.width="100%";
            link.style.minWidth="0";
            link.style.minHeight="116px";
            link.style.height="100%";
            link.style.padding="12px 8px";
            link.style.margin="0";
            link.style.boxSizing="border-box";
            link.style.background="#0f766e";
            link.style.color="#ffffff";
            link.style.border="1px solid #0f766e";
            link.style.borderRadius="12px";
            link.style.fontWeight="700";
            link.style.fontSize="14px";
            link.style.lineHeight="1.35";
            link.style.textAlign="center";
            link.style.textDecoration="none";
            link.style.whiteSpace="normal";
            link.style.overflowWrap="anywhere";
            link.style.boxShadow="none";
            link.style.transform="none";
          });

          if(shopHeading){
            shopHeading.style.margin="0";
            shopHeading.style.color="#ffffff";
            shopHeading.style.fontSize="14px";
            shopHeading.style.fontWeight="700";
            shopHeading.style.lineHeight="1.35";
          }

          if(shopDescription){
            shopDescription.style.margin="0";
            shopDescription.style.color="#ffffff";
            shopDescription.style.fontSize="11px";
            shopDescription.style.fontWeight="400";
            shopDescription.style.lineHeight="1.35";
          }

          action.dataset.shopdropFourGreenActions="176";
        }
      }

      if(anchor){
        moveAfter(action,anchor);
      }else{
        main.prepend(action);
      }
      anchor=action;
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
    // Preserve the previously approved width alignment.
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
           Match the top row height without changing widths. */
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
