(() => {
  'use strict';

  function initialize() {
    const title =
      document.getElementById('title');

    const category =
      document.getElementById(
        'dispatchCategory174'
      );

    const subtype =
      document.getElementById(
        'dispatchSubtype174'
      );

    if (!title || !category || !subtype) {
      return;
    }

    if (document.getElementById(
      'shopdropTitleSelect185A'
    )) {
      return;
    }

    const label = title.closest('label');

    if (!label) return;

    const select =
      document.createElement('select');

    select.id = 'shopdropTitleSelect185A';
    select.required = true;

    select.setAttribute(
      'aria-label',
      'Transport or equipment service title'
    );

    function refresh() {
      const selected = subtype.value;

      select.replaceChildren(
        new Option(
          'Choose transport or equipment title',
          ''
        )
      );

      Array.from(subtype.options).forEach(
        option => {
          if (!option.value) return;

          select.add(
            new Option(
              option.textContent,
              option.value
            )
          );
        }
      );

      select.disabled = !category.value;

      if (selected) {
        select.value = selected;
      }

      title.value = select.value;

      title.dispatchEvent(
        new Event('input', {
          bubbles: true
        })
      );
    }

    category.addEventListener(
      'change',
      () => {
        refresh();
      }
    );

    subtype.addEventListener(
      'change',
      refresh
    );

    select.addEventListener(
      'change',
      () => {
        subtype.value = select.value;

        subtype.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        );

        title.value = select.value;
      }
    );

    const originalTitle = title.value;

    title.insertAdjacentElement(
      'beforebegin',
      select
    );

    title.hidden = true;
    title.style.display = 'none';

    refresh();

    if (
      originalTitle &&
      Array.from(select.options).some(
        option =>
          option.value === originalTitle
      )
    ) {
      select.value = originalTitle;
      title.value = originalTitle;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
