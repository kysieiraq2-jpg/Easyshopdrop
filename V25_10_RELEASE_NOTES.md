# Shop&Drop V25.10 release notes

Final correction release for the V25 front-end/mobile functional testing phase.

- Replaced long telephone/WhatsApp dialing-code selects with searchable country-code fields. Users can search/type a country name, ISO country code or dialing code (for example Spain, ES or +34). Full country names are shown.
- Kept Cellphone and WhatsApp dialing codes independent while still defaulting both from the selected seller country.
- Fixed Checkout Preview order feedback by targeting an explicit accessible status element rather than relying on a global element-name binding. Empty preview bags now show immediate visible feedback.
- No previously passed workflows were intentionally changed.
