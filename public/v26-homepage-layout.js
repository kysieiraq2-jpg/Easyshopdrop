
/* Shop&Drop V26-13 homepage layout + controlled menu containment repair.
   Reorders/groups EXISTING homepage sections.
   Does NOT alter hrefs, event handlers, listing logic, taxonomy, finance or backend behaviour.
   Homepage four-card presentation fix: each marketplace option is a separate tile.

   BROWSE/BAG ALIGNMENT FIX:
   Keep both bottom header buttons equal in width and aligned
   with the Sign In / Account and Menu buttons above.
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
      // Keep the original Shop&Drop introduction wording/content intact,
      // but place that content inside the broader How Shop&Drop Works area.
      const introWrap=document.createElement("div");
      introWrap.className="v26-shopdrop-introduction";
      while(intro.firstChild){
        introWrap.appendChild(intro.firstChild);
      }
      how.appendChild(introWrap);
      intro.hidden=true;
    }

    // Four independent marketplace tiles.
    // Preserve existing headings, descriptions, links and event handlers.
    // Dispatch first; two columns remain controlled by existing CSS.
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

        // V26_11_EXISTING_LINK_TILE_CLICK:
        // Reuse existing href; never invent/replace link targets.
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
    // Presentation only; preserve existing contact hrefs/config.
    if(contact){
      contact.classList.add("v26-contact-admin");

      // Remove development-only explanatory text from visible homepage.
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
    // CSS-only correction. Preserve original header HTML and links.
    // Align bottom Browse/Bag row with top Sign In/Menu row.
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
          min-height:58px!important;
          justify-self:stretch!important;
          text-align:center!important;
        }

        .shopdrop-browse-bag-row .shopdrop-header-browse{
          white-space:normal!important;
        }

        .shopdrop-browse-bag-row .shopdrop-header-bag{
          white-space:normal!important;
        }
      `;
      document.head.appendChild(style);
    }
  });
})();
