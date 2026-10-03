# Shop&Drop V26.21 — Controlled Header & Main Menu Repair

Baseline: V26.20 FINAL. All unrelated V26.20 functionality is preserved.

## Audit findings
- The V26.20 mobile header had two competing layout systems: the original `.bar` grid and later JavaScript that re-parented header controls after page load. The wrappers created by the later script became children of the old grid, producing the displaced Sign In/Account text, separated Menu button, Bag placement and excessive header height seen on mobile.
- The Main Menu button itself could open the panel, but the category/navigation area had competing mounts. A second `[data-v26-category-menu]` existed outside the actual menu, while the menu also contained its own taxonomy mount. This made category rendering/runtime placement fragile and contributed to the blank/oversized menu presentation.
- The menu had lost/obscured useful navigation expected from the protected V25.24 functional reference.

## Repair
- Rewrote the homepage header markup as one stable, static responsive component. No runtime DOM re-parenting is used for the header.
- Rewrote the Menu open/close controller with explicit `aria-expanded`, click-away and Escape handling.
- Kept exactly one authoritative category mount inside the Main Menu.
- Categories/subcategories continue to load from the current V26 `taxonomy.json`; no V25 taxonomy/code was copied.
- Restored a complete Main Menu navigation set using current V26 routes: Home/Shop, New Products, Products & Categories, nested Shop Categories, Other Services, Dispatching & Transport, free Product/Service listing, Bag/Checkout, Sign In/Create Account, Account/Orders, Tracking, Returns/Disputes, Seller/Provider Centre, Complaints/Suggestions, Help, Terms, Privacy and Admin Sign In.
- Preserved all unrelated V26.20 code, marketplace logic, finance, backend/integration architecture and homepage functionality.
