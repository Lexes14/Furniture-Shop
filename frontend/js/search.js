(function ($) {
  const MIN_CHARS = 2;
  const RESULT_LIMIT = 6;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function itemThumb(item) {
    const images = FurnitureShopAPI.itemImages ? FurnitureShopAPI.itemImages(item) : [];
    const src = images[0] ? FurnitureShopAPI.uploadUrl('products', images[0]) : '';
    if (!src) {
      return '<div class="search-widget__thumb search-widget__thumb--empty"></div>';
    }
    return `<img class="search-widget__thumb" src="${src}" alt="${escapeHtml(item.name)}">`;
  }

  function goToItem(itemId) {
    window.location.href = `product.html?item=${itemId}`;
  }

  // Wires up a full autocomplete dropdown on any existing search input,
  // without touching whatever OTHER 'input' handlers that field might
  // already have (e.g. item.js's infinite-scroll search on #productSearch
  // keeps working unchanged — jQuery supports multiple handlers on the
  // same event, so both run side by side).
  function createAutocomplete(inputSelector, resultsSelector) {
    const $input = $(inputSelector);
    if (!$input.length) {
      return;
    }

    let $results = $(resultsSelector);
    if (!$results.length) {
      const $wrapper = $input.parent();
      if ($wrapper.css('position') === 'static') {
        $wrapper.css('position', 'relative');
      }
      $results = $('<div class="search-widget__results" style="display:none;"></div>');
      $input.after($results);
    }

    let activeIndex = -1;
    let currentResults = [];
    let requestToken = 0;

    function renderResults(items) {
      currentResults = items;
      activeIndex = -1;

      if (!items.length) {
        $results.html('<div class="search-widget__empty">No matching products found.</div>').show();
        return;
      }

      const html = items.map((item, index) => `
        <div class="search-widget__item" data-index="${index}" data-item-id="${item.id}">
          ${itemThumb(item)}
          <div class="search-widget__info">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.category?.name || 'Furniture')} &middot; ${FurnitureShopAPI.currency(item.price)}</span>
          </div>
        </div>
      `).join('');

      $results.html(html).show();
    }

    function clearResults() {
      $results.hide().empty();
      currentResults = [];
      activeIndex = -1;
    }

    function setActive(index) {
      const $items = $results.find('.search-widget__item');
      $items.removeClass('is-active');
      if (index >= 0 && index < $items.length) {
        $items.eq(index).addClass('is-active');
        activeIndex = index;
      }
    }

    function runSearch(term) {
      const thisRequest = ++requestToken;

      FurnitureShopAPI.get('/items', { search: term, status: 'active', limit: RESULT_LIMIT, page: 1 })
        .done((response) => {
          if (thisRequest !== requestToken) return;
          renderResults(response.data || []);
        })
        .fail(() => {
          if (thisRequest !== requestToken) return;
          renderResults([]);
        });
    }

    const debouncedSearch = FurnitureShopAPI.debounce((term) => runSearch(term), 250);

    $input.on('input.autocomplete', function () {
      const term = String($(this).val() || '').trim();
      if (term.length < MIN_CHARS) {
        clearResults();
        return;
      }
      debouncedSearch(term);
    });

    $input.on('keydown.autocomplete', function (event) {
      const $items = $results.find('.search-widget__item');
      if (!$items.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(Math.min(activeIndex + 1, $items.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = activeIndex >= 0 ? currentResults[activeIndex] : currentResults[0];
        if (target) goToItem(target.id);
      } else if (event.key === 'Escape') {
        clearResults();
      }
    });

    $results.on('click', '.search-widget__item', function () {
      goToItem($(this).data('item-id'));
    });

    $(document).on('click.autocomplete-' + inputSelector.replace('#', ''), function (event) {
      if (!$(event.target).closest($input).length && !$(event.target).closest($results).length) {
        clearResults();
      }
    });
  }

  // Initialize autocomplete on the home and product search inputs
  $(function () {
    createAutocomplete('#homeSearchInput', '#homeSearchResults');
    createAutocomplete('#productSearch', '#productSearchResults');
  });
})(jQuery);