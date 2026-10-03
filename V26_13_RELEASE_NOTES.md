# Shop&Drop V26-13 FINAL

Controlled follow-up repair based directly on V26-12 FINAL.

## Approved change only
- Repaired the homepage Menu control after the V26-12 cosmetic header rearrangement.
- Root cause: V26-12 moved the Menu button out of its existing `.menuwrap` container while leaving the menu navigation inside it. The existing click-away handler therefore treated the Menu button tap as an outside click and immediately closed the menu.
- V26-13 moves the complete existing `.menuwrap` (Menu button + existing navigation) into the top Account/Menu row.
- Existing menu links, category/subcategory mounts, taxonomy, hrefs, handlers and click-away behaviour are preserved.
- No contact-link, product, second-hand, featured-product, backend, finance, taxonomy or other homepage functionality was changed.
