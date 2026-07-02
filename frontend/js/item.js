(function ($) {
    const itemCache = new Map();
    let categoriesLoaded = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function loadCategoryOptions() {
        const $category = $('#itemCategoryId');
        if (!$category.length || categoriesLoaded) {
            return $.Deferred().resolve().promise();
        }

        $category.prop('disabled', true).html('<option value="">Loading categories...</option>');

        return FurnitureShopAPI.get('/categories', { limit: 1000 })
            .done((response) => {
                const categories = response.data || [];
                const options = categories.map((category) => (
                    `<option value="${category.id}">${escapeHtml(category.name)}</option>`
                ));

                $category.html(`<option value="">Select category</option>${options.join('')}`);
                categoriesLoaded = true;
            })
            .fail((xhr) => {
                $category.html('<option value="">Unable to load categories</option>');
                FurnitureShopAPI.setMessage('#itemMessage', xhr.responseJSON?.message || 'Failed to load categories.', 'danger');
            })
            .always(() => {
                $category.prop('disabled', false);
            });
    }

    function getProductImages(item) {
        return FurnitureShopAPI.itemImages(item);
    }

    function productImageUrl(image) {
        return FurnitureShopAPI.uploadUrl('products', image);
    }

    // Renders a single image, OR a full prev/next + dots carousel when the
    // item has more than one image. Used both in the admin table cell and
    // in the customer-facing product card.
    function renderImageCarousel(images, altText) {
        if (!images.length) {
            return '<div class="product-thumb product-thumb--empty">No image</div>';
        }

        if (images.length === 1) {
            return `<img class="product-thumb" src="${productImageUrl(images[0])}" alt="${escapeHtml(altText || 'Product image')}">`;
        }

        const slides = images.map((image, index) => `
            <div class="product-carousel__slide${index === 0 ? ' is-active' : ''}">
                <img src="${productImageUrl(image)}" alt="${escapeHtml(altText || 'Product image')} ${index + 1}">
            </div>
        `).join('');

        const dots = images.map((_image, index) => `
            <button type="button" class="product-carousel__dot${index === 0 ? ' is-active' : ''}" data-index="${index}" aria-label="Go to image ${index + 1}"></button>
        `).join('');

        return `
            <div class="product-carousel" data-count="${images.length}">
                <div class="product-carousel__track">${slides}</div>
                <button type="button" class="product-carousel__nav product-carousel__nav--prev js-carousel-prev" aria-label="Previous image">&#10094;</button>
                <button type="button" class="product-carousel__nav product-carousel__nav--next js-carousel-next" aria-label="Next image">&#10095;</button>
                <div class="product-carousel__dots">${dots}</div>
            </div>
        `;
    }

    // ----- Used by the ADMIN dashboard table (#itemTable) -----
    function renderProductCell(_value, _type, item) {
        const images = getProductImages(item);
        return `
            <div class="product-cell">
                ${renderImageCarousel(images, item.name)}
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.sku || '')}</span>
                </div>
            </div>
        `;
    }

    function renderExistingImages(item) {
        const $manager = $('#itemExistingImages');
        if (!$manager.length) {
            return;
        }

        const images = getProductImages(item);
        if (!images.length) {
            $manager.html('<p class="image-manager__empty">No uploaded images yet.</p>');
            return;
        }

        const html = images.map((image) => `
            <div class="image-manager__item" data-image="${escapeHtml(image)}">
                <input type="hidden" name="existingImages" value="${escapeHtml(image)}">
                <img src="${productImageUrl(image)}" alt="${escapeHtml(item.name)}">
                <button class="btn btn--ghost js-remove-existing-image" type="button">Delete</button>
            </div>
        `).join('');

        $manager.html(html);
    }

    function clearExistingImages() {
        $('#itemExistingImages').empty();
    }

    function renderItemActions(item, adminMode) {
        if (!adminMode) {
            if (!FurnitureShopAPI.isLoggedIn()) {
                return '<a class="btn btn--light" href="login.html">Login to Add</a>';
            }

            return `<button class="btn btn--light js-add-cart" data-item-id="${item.id}" type="button">Add to Cart</button>`;
        }

        return `
      <button class="btn btn--light js-edit-item" data-item-id="${item.id}" type="button">Edit</button>
      <button class="btn btn--light js-add-stock" data-item-id="${item.id}" type="button">Stock +</button>
      <button class="btn btn--ghost js-remove-stock" data-item-id="${item.id}" type="button">Stock -</button>
      <button class="btn btn--ghost js-delete-item" data-item-id="${item.id}" type="button">Delete</button>
    `;
    }

    function renderStockQuantity(_value, _type, item) {
        return Number(item.stock?.quantity || 0);
    }

    function saveStockQuantity(item, nextQuantity) {
        const stock = item.stock;
        const payload = {
            itemId: item.id,
            quantity: Math.max(Number(nextQuantity || 0), 0),
            reservedQuantity: Number(stock?.reservedQuantity || 0),
            lowStockLevel: Number(stock?.lowStockLevel || 5),
            location: stock?.location || $('#itemLocation').val() || null,
        };

        if (stock?.id) {
            return FurnitureShopAPI.put(`/stocks/${stock.id}`, payload);
        }

        return FurnitureShopAPI.post('/stocks', payload);
    }

    function adjustStock(table, itemId, direction) {
        const item = itemCache.get(Number(itemId));
        if (!item) {
            alert('Item data is not loaded yet.');
            return;
        }

        const currentQuantity = Number(item.stock?.quantity || 0);
        const label = direction > 0 ? 'add' : 'remove';
        const amount = Number(prompt(`How many stocks do you want to ${label}?`, '1') || 0);

        if (!Number.isInteger(amount) || amount <= 0) {
            alert('Enter a valid whole number.');
            return;
        }

        const nextQuantity = direction > 0
            ? currentQuantity + amount
            : Math.max(currentQuantity - amount, 0);

        saveStockQuantity(item, nextQuantity)
            .done(() => {
                FurnitureShopAPI.setMessage('#itemMessage', `Stock updated from ${currentQuantity} to ${nextQuantity}.`, 'success');
                table.ajax.reload(null, false);
            })
            .fail((xhr) => {
                FurnitureShopAPI.setMessage('#itemMessage', xhr.responseJSON?.message || 'Failed to update stock.', 'danger');
            });
    }

    function bindSearch(table, selector) {
        const $input = $(selector);
        if (!$input.length) {
            return;
        }

        $input.on('input', FurnitureShopAPI.debounce(() => {
            table.ajax.reload();
        }));
    }

    function appendSearch(data, selector) {
        const search = String($(selector).val() || '').trim();
        if (search) {
            data.search = search;
        }
    }

    function loadItemsAjax(selector, baseParams = {}) {
        return function (_data, callback) {
            const params = { ...baseParams, limit: 1000 };
            appendSearch(params, selector);

            FurnitureShopAPI.get('/items', params)
                .done((response) => {
                    callback({ data: response.data || [] });
                })
                .fail(() => {
                    callback({ data: [] });
                    $('#itemTable tbody').html('<tr><td colspan="6">Unable to load items. Please refresh or login again.</td></tr>');
                });
        };
    }

    function attachCartAction() {
        $(document).on('click', '.js-add-cart', function () {
            const itemId = Number($(this).data('item-id'));
            if (!FurnitureShopAPI.ensureAuth()) {
                window.location.href = 'login.html';
                return;
            }

            FurnitureShopAPI.post('/cart/items', { itemId, quantity: 1 })
                .done(() => {
                    window.location.href = 'cart.html';
                })
                .fail((xhr) => {
                    alert(xhr.responseJSON?.message || 'Unable to add item to cart.');
                });
        });
    }

    // Moves the carousel inside $carousel to the given slide index (wraps around).
    function goToCarouselSlide($carousel, index) {
        const $slides = $carousel.find('.product-carousel__slide');
        const $dots = $carousel.find('.product-carousel__dot');
        const count = $slides.length;
        if (!count) {
            return;
        }

        const nextIndex = ((index % count) + count) % count;

        $slides.removeClass('is-active').eq(nextIndex).addClass('is-active');
        $dots.removeClass('is-active').eq(nextIndex).addClass('is-active');
    }

    function attachCarouselControls() {
        $(document).on('click', '.js-carousel-prev', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const $carousel = $(this).closest('.product-carousel');
            const currentIndex = $carousel.find('.product-carousel__slide.is-active').index();
            goToCarouselSlide($carousel, currentIndex - 1);
        });

        $(document).on('click', '.js-carousel-next', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const $carousel = $(this).closest('.product-carousel');
            const currentIndex = $carousel.find('.product-carousel__slide.is-active').index();
            goToCarouselSlide($carousel, currentIndex + 1);
        });

        $(document).on('click', '.product-carousel__dot', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const $carousel = $(this).closest('.product-carousel');
            goToCarouselSlide($carousel, Number($(this).data('index')));
        });
    }

    function attachAdminActions(table) {
        $(document).on('click', '.js-delete-item', function () {
            const itemId = Number($(this).data('item-id'));
            if (!confirm('Delete this item?')) {
                return;
            }

            FurnitureShopAPI.del(`/items/${itemId}`)
                .done(() => table.ajax.reload(null, false))
                .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to delete item.'));
        });

        $(document).on('click', '.js-edit-item', function () {
            const itemId = Number($(this).data('item-id'));
            const item = itemCache.get(itemId);
            if (!item) {
                return;
            }

            loadCategoryOptions().always(() => {
                $('#itemId').val(item.id);
                $('#itemName').val(item.name);
                $('#itemSku').val(item.sku);
                $('#itemCategoryId').val(item.categoryId);
                $('#itemPrice').val(item.price);
                $('#itemCostPrice').val(item.costPrice);
                $('#itemDescription').val(item.description || '');
                $('#itemStatus').val(item.status);
                $('#itemFeatured').val(item.featured ? '1' : '0');
                $('#stockId').val(item.stock?.id || '');
                $('#itemQuantity').val(Number(item.stock?.quantity || 0));
                $('#itemLowStockLevel').val(Number(item.stock?.lowStockLevel || 5));
                $('#itemLocation').val(item.stock?.location || '');
                renderExistingImages(item);
                $('html, body').animate({ scrollTop: $('#itemForm').offset().top - 20 }, 300);
            });
        });

        $(document).on('click', '.js-remove-existing-image', function () {
            $(this).closest('.image-manager__item').remove();
            if (!$('#itemExistingImages .image-manager__item').length) {
                $('#itemExistingImages').html('<p class="image-manager__empty">All existing images will be removed when you save.</p>');
            }
        });

        $(document).on('click', '.js-add-stock', function () {
            adjustStock(table, $(this).data('item-id'), 1);
        });

        $(document).on('click', '.js-remove-stock', function () {
            adjustStock(table, $(this).data('item-id'), -1);
        });

        $(document).on('submit', '#itemForm', function (event) {
            event.preventDefault();
            const itemId = $('#itemId').val();
            const formData = new FormData(this);

            if (itemId && !formData.has('existingImages')) {
                formData.append('existingImages', '');
            }

            const url = itemId ? `/items/${itemId}` : '/items';
            const method = itemId ? 'PUT' : 'POST';

            $.ajax({
                url: `${FurnitureShopAPI.baseUrl}${url}`,
                method,
                data: formData,
                headers: FurnitureShopAPI.authHeaders(),
                processData: false,
                contentType: false,
                dataType: 'json',
                xhrFields: { withCredentials: true },
            })
                .done((response) => {
                    FurnitureShopAPI.setMessage('#itemMessage', response.message || 'Item and stock saved successfully.', 'success');
                    $('#itemForm')[0].reset();
                    $('#itemId').val('');
                    $('#stockId').val('');
                    $('#itemQuantity').val('0');
                    $('#itemLowStockLevel').val('5');
                    clearExistingImages();
                    table.ajax.reload(null, false);
                })
                .fail((xhr) => FurnitureShopAPI.setMessage('#itemMessage', xhr.responseJSON?.message || 'Failed to save item.', 'danger'));
        });
    }

    // ===================================================================
    // CUSTOMER PRODUCT BROWSING — infinite scroll (product.html)
    // ===================================================================
    const PRODUCT_PAGE_SIZE = 12;
    let productPage = 1;
    let productTotalPages = 1;
    let productLoading = false;
    let productSearchTerm = '';

    function productCardHtml(item) {
        const images = getProductImages(item);
        return `
            <article class="product-card" data-item-id="${item.id}">
                <div class="product-card__media">${renderImageCarousel(images, item.name)}</div>
                <div class="product-card__body">
                    <span class="product-card__category">${escapeHtml(item.category?.name || 'Uncategorized')}</span>
                    <h3 class="product-card__name">${escapeHtml(item.name)}</h3>
                    <div class="product-card__meta">
                        <strong class="product-card__price">${FurnitureShopAPI.currency(item.price)}</strong>
                        ${FurnitureShopAPI.statusBadge(item.status)}
                    </div>
                    <span class="product-card__stock">${Number(item.stock?.quantity || 0)} in stock</span>
                    <div class="product-card__actions">${renderItemActions(item, false)}</div>
                </div>
            </article>
        `;
    }

    function loadProductPage($grid, $sentinel, $emptyState, reset) {
        if (productLoading) {
            return;
        }

        if (!reset && productPage > productTotalPages) {
            return;
        }

        productLoading = true;
        $sentinel.addClass('is-loading');

        const params = { page: productPage, limit: PRODUCT_PAGE_SIZE, status: 'active' };
        if (productSearchTerm) {
            params.search = productSearchTerm;
        }

        FurnitureShopAPI.get('/items', params)
            .done((response) => {
                const items = response.data || [];
                const meta = response.meta || {};
                productTotalPages = meta.pages || 1;

                if (reset) {
                    $grid.empty();
                }

                if (!items.length && productPage === 1) {
                    $emptyState.show();
                } else {
                    $emptyState.hide();
                }

                $grid.append(items.map(productCardHtml).join(''));
                productPage += 1;
            })
            .fail(() => {
                if (productPage === 1) {
                    $grid.html('<p class="product-grid__error">Unable to load products. Please refresh or try again.</p>');
                }
            })
            .always(() => {
                productLoading = false;
                $sentinel.removeClass('is-loading');
                if (productPage > productTotalPages) {
                    $sentinel.hide();
                } else {
                    $sentinel.show();
                }
            });
    }

    function initInfiniteScrollProducts() {
        const $grid = $('#productGrid');
        if (!$grid.length) {
            return;
        }

        const $sentinel = $('#productSentinel');
        const $emptyState = $('#productEmpty');
        const $search = $('#productSearch');

        function resetAndLoad() {
            productPage = 1;
            productTotalPages = 1;
            loadProductPage($grid, $sentinel, $emptyState, true);
        }

        resetAndLoad();

        if ($search.length) {
            $search.on('input', FurnitureShopAPI.debounce(() => {
                productSearchTerm = String($search.val() || '').trim();
                resetAndLoad();
            }));
        }

        if ('IntersectionObserver' in window && $sentinel.length) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        loadProductPage($grid, $sentinel, $emptyState, false);
                    }
                });
            }, { rootMargin: '200px' });

            observer.observe($sentinel[0]);
        } else {
            // Fallback for old browsers without IntersectionObserver support
            $(window).on('scroll', FurnitureShopAPI.debounce(() => {
                const scrollBottom = $(window).scrollTop() + $(window).height();
                const sentinelTop = $sentinel.offset()?.top || 0;
                if (scrollBottom >= sentinelTop - 200) {
                    loadProductPage($grid, $sentinel, $emptyState, false);
                }
            }, 150));
        }

        attachCartAction();
    }

    $(function () {
        attachCarouselControls();

        // Customer browsing page (infinite scroll)
        initInfiniteScrollProducts();

        // Admin dashboard page (DataTable + full CRUD)
        if ($('#itemTable').length) {
            if (!FurnitureShopAPI.ensureAuth(['admin'])) {
                return;
            }

            const table = $('#itemTable').DataTable({
                ajax: loadItemsAjax('#itemSearch'),
                paging: true,
                searching: false,
                columns: [
                    { data: null, render: renderProductCell },
                    { data: 'category.name', defaultContent: 'Uncategorized' },
                    { data: 'price', render: (value) => FurnitureShopAPI.currency(value) },
                    { data: null, render: renderStockQuantity },
                    { data: 'status', render: (value) => FurnitureShopAPI.statusBadge(value) },
                    { data: null, orderable: false, render: (data) => renderItemActions(data, true) },
                ],
                drawCallback: function () {
                    const api = this.api();
                    itemCache.clear();
                    api.rows().every(function () {
                        const row = this.data();
                        itemCache.set(Number(row.id), row);
                    });
                },
            });

            bindSearch(table, '#itemSearch');
            loadCategoryOptions();
            attachAdminActions(table);
        }
    });
})(jQuery);