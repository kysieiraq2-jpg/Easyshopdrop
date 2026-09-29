# Shop&Drop V25.9 Release Notes

## Final preview corrections from mobile testing
- Fixed mobile form/select overflow so country and location dropdowns stay inside their cards on narrow Android screens.
- Added international calling-code dropdowns for both Cellphone and optional WhatsApp on the seller application form.
- Country selection automatically preselects the matching calling code while still allowing a different WhatsApp code.
- Expanded calling-code data from the available international country dataset while retaining verified existing codes.
- Added buyer-location currency display groundwork: the shopping country automatically determines the display currency; live FX conversion remains a backend integration so seller original currency/value is preserved.
- Improved checkout address field sizing and Country label alignment on mobile.
- Retained explicit preview feedback for actions that cannot complete on GitHub Pages (orders, payments, saved addresses, live catalogue results).

## Testing rule
Previously passed areas remain locked. Final testing should focus on the changed mobile fields, international phone/WhatsApp selectors, buyer currency indication and preview-action feedback.
