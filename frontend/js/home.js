(function ($) {
  
  function renderFeaturedProducts(items) {
    const $container = $('#featuredProducts');
    if (!$container.length) {
      return;
    }

    if (!items.length) {
      $container.html('<article class="panel"><div class="panel__body"><h3>No featured items yet</h3><p class="section__subtitle">Products will appear once the backend returns featured items.</p></div></article>');
      return;
    }

    const html = items.map((item) => `
      <article class="panel" data-reveal>
        <div class="panel__body">
          <h3>${item.name}</h3>
          <p class="section__subtitle">${item.category?.name || 'Furniture'}</p>
          <div class="card__meta">
            <span>${FurnitureShopAPI.currency(item.price)}</span>
            <span class="badge badge--success">${Number(item.stock?.quantity || 0)} stock</span>
          </div>
          <button class="btn btn--light" data-item-id="${item.id}" type="button">View Details</button>
        </div>
      </article>
    `).join('');

    $container.html(html);
  }

  
  $(document).on('click', '#featuredProducts [data-item-id]', function () {
    window.location.href = `product.html?item=${$(this).data('item-id')}`;
  });

  
  $(function () {
    FurnitureShopAPI.get('/items', { featured: true, status: 'active', limit: 6, page: 1 })
      .done((response) => {
        renderFeaturedProducts(response.data || []);
      })
      .fail(() => {
        renderFeaturedProducts([]);
      });
  });
})(jQuery);