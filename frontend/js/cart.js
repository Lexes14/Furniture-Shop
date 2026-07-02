(function ($) {
  function renderCart(cart) {
    const items = cart?.items || [];
    const $body = $('#cartTableBody');
    const $totalItems = $('#cartTotalItems');
    const $subtotal = $('#cartSubtotal');

    if (!$body.length) {
      return;
    }

    if (!items.length) {
      $body.html('<tr><td colspan="5">Your cart is empty.</td></tr>');
      $totalItems.text('0');
      $subtotal.text(FurnitureShopAPI.currency(0));
      return;
    }

    $body.html(items.map((cartItem) => `
      <tr>
        <td>${cartItem.item?.name || 'Item'}</td>
        <td>${FurnitureShopAPI.currency(cartItem.unitPrice)}</td>
        <td><input class="cart-qty" type="number" min="1" value="${cartItem.quantity}" data-cart-item-id="${cartItem.id}" style="width:90px"></td>
        <td>${FurnitureShopAPI.currency(cartItem.subtotal)}</td>
        <td>
          <button class="btn btn--light js-update-cart" data-cart-item-id="${cartItem.id}" type="button">Update</button>
          <button class="btn btn--ghost js-remove-cart" data-cart-item-id="${cartItem.id}" type="button">Remove</button>
        </td>
      </tr>
    `).join(''));

    $totalItems.text(cart.totalItems || items.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
    $subtotal.text(FurnitureShopAPI.currency(cart.subtotal || items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)));
  }

  function loadCart() {
    if (!FurnitureShopAPI.ensureAuth()) {
      return;
    }

    FurnitureShopAPI.get('/cart')
      .done((response) => renderCart(response.data || {}))
      .fail((xhr) => {
        FurnitureShopAPI.setMessage('#cartMessage', xhr.responseJSON?.message || 'Failed to load cart.', 'danger');
      });
  }

  $(document).on('click', '.js-update-cart', function () {
    const cartItemId = $(this).data('cart-item-id');
    const quantity = Number($(`.cart-qty[data-cart-item-id="${cartItemId}"]`).val() || 1);

    FurnitureShopAPI.put(`/cart/items/${cartItemId}`, { quantity })
      .done((response) => renderCart(response.data || {}))
      .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to update cart item.'));
  });

  $(document).on('click', '.js-remove-cart', function () {
    const cartItemId = $(this).data('cart-item-id');
    FurnitureShopAPI.del(`/cart/items/${cartItemId}`)
      .done((response) => renderCart(response.data || {}))
      .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to remove cart item.'));
  });

  $(document).on('click', '#clearCartButton', function () {
    FurnitureShopAPI.del('/cart/clear')
      .done((response) => renderCart(response.data || {}))
      .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to clear cart.'));
  });

  $(loadCart);
})(jQuery);