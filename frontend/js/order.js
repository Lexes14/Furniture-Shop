(function ($) {
  const orderStatuses = ['pending', 'approved', 'delivered', 'cancelled'];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function setOrderMessage(message, type = 'warning') {
    FurnitureShopAPI.setMessage('#orderMessage', message, type);
    setTimeout(() => FurnitureShopAPI.clearMessage('#orderMessage'), 3500);
  }

  function appendCustomerSearch(data) {
    const search = String($('#orderSearch').val() || '').trim();
    if (search) {
      data.search = search;
    }
  }

  function renderAdminChrome() {
    FurnitureShopAPI.renderRoleNavigation();
    $('#orderEyebrow').text('Admin Orders');
    $('#orderTitle').text('Manage customer orders and update fulfillment status.');
    $('#orderSubtitle').text('Review every customer order, confirm progress, and keep the database status in sync.');
    $('#orderToolbarTitle').text('Customer Orders');
    $('#orderSearch').attr('placeholder', 'Search customer or order #');
    $('#orderStatusFilter').show();
    $('#orderTable thead').html(`
      <tr>
        <th>Order #</th>
        <th>Customer</th>
        <th>Items</th>
        <th>Total</th>
        <th>Status</th>
        <th>Ordered</th>
        <th>Receipt</th>
      </tr>
    `);
  }

  function renderCustomerChrome() {
    $('#orderEyebrow').text('Orders');
    $('#orderTitle').text('Track the status of every order.');
    $('#orderSubtitle').text('View your order status and download receipts for your purchases.');
    $('#orderToolbarTitle').text('My Orders');
    $('#orderSearch').attr('placeholder', 'Search orders');
    $('#orderStatusFilter').hide();
    $('#orderTable thead').html(`
      <tr>
        <th>Order #</th>
        <th>Status</th>
        <th>Total</th>
        <th>Receipt</th>
      </tr>
    `);
  }

  function renderStatusSelect(order) {
    const options = orderStatuses.map((status) => {
      const selected = status === order.status ? 'selected' : '';
      return `<option value="${status}" ${selected}>${status.charAt(0).toUpperCase()}${status.slice(1)}</option>`;
    }).join('');

    return `<select class="status-select js-order-status" data-order-id="${order.id}" data-current-status="${escapeHtml(order.status)}" aria-label="Update status for ${escapeHtml(order.orderNumber)}">${options}</select>`;
  }

  function renderAdminOrders(orders) {
    const $tbody = $('#orderTable tbody');

    if (!orders.length) {
      $tbody.html('<tr><td colspan="7">No orders found.</td></tr>');
      return;
    }

    const rows = orders.map((order) => {
      const customer = order.user
        ? `${escapeHtml(order.user.name || 'Customer')}<small>${escapeHtml(order.user.email || '')}</small>`
        : 'Customer';
      const itemSummary = (order.items || [])
        .map((entry) => `${escapeHtml(entry.item?.name || 'Item')} x${entry.quantity}`)
        .join(', ');

      return `
        <tr>
          <td><strong>${escapeHtml(order.orderNumber)}</strong></td>
          <td class="customer-cell">${customer}</td>
          <td>${itemSummary || 'No items'}</td>
          <td>${FurnitureShopAPI.currency(order.grandTotal)}</td>
          <td>${renderStatusSelect(order)}</td>
          <td>${formatDate(order.orderDate || order.createdAt)}</td>
          <td><button class="btn btn--light js-download-order" data-order-id="${order.id}" data-order-number="${escapeHtml(order.orderNumber)}" type="button">Download</button></td>
        </tr>
      `;
    }).join('');

    $tbody.html(rows);
  }

  function loadAdminOrders() {
    const params = { limit: 100 };
    const search = String($('#orderSearch').val() || '').trim();
    const status = $('#orderStatusFilter').val();

    if (search) {
      params.search = search;
    }
    if (status) {
      params.status = status;
    }

    $('#orderTable tbody').html('<tr><td colspan="7">Loading orders...</td></tr>');

    FurnitureShopAPI.get('/orders', params)
      .done((response) => {
        renderAdminOrders(response.data || []);
      })
      .fail(() => {
        $('#orderTable tbody').html('<tr><td colspan="7">Unable to load orders. Please login again.</td></tr>');
      });
  }

  function loadCustomerOrders() {
    const table = $('#orderTable').DataTable({
      ajax: {
        url: `${FurnitureShopAPI.baseUrl}/orders`,
        data: appendCustomerSearch,
        headers: FurnitureShopAPI.authHeaders(),
        dataSrc: 'data',
        xhrFields: { withCredentials: true },
        error: () => {
          $('#orderTable tbody').html('<tr><td colspan="4">Unable to load orders. Please login again.</td></tr>');
        },
      },
      searching: false,
      paging: true,
      columns: [
        { data: 'orderNumber' },
        { data: 'status', render: (value) => FurnitureShopAPI.statusBadge(value) },
        { data: 'grandTotal', render: (value) => FurnitureShopAPI.currency(value) },
        {
          data: null,
          orderable: false,
          render: (data) => `<button class="btn btn--light js-download-order" data-order-id="${data.id}" data-order-number="${escapeHtml(data.orderNumber)}" type="button">Download</button>`,
        },
      ],
    });

    $('#orderSearch').on('input', FurnitureShopAPI.debounce(() => {
      table.ajax.reload();
    }));
  }

  function loadOrders() {
    if ($('#checkoutForm').length && !FurnitureShopAPI.ensureAuth()) {
      return;
    }

    if (!$('#orderTable').length || !FurnitureShopAPI.ensureAuth()) {
      return;
    }

    const session = FurnitureShopAPI.getSession();

    if (session.user?.role === 'admin') {
      renderAdminChrome();
      $('#orderSearch').on('input', FurnitureShopAPI.debounce(loadAdminOrders));
      $('#orderStatusFilter').on('change', loadAdminOrders);
      loadAdminOrders();
      return;
    }

    renderCustomerChrome();
    loadCustomerOrders();
  }

  $(document).on('click', '.js-download-order', function () {
    const orderId = $(this).data('order-id');
    const orderNumber = $(this).data('order-number');
    FurnitureShopAPI.download(`/pdf/orders/${orderId}`, `order-${orderNumber}.pdf`)
      .fail((xhr) => {
        const reader = new FileReader();
        reader.onload = () => alert('Unable to download receipt.');
        if (xhr.response instanceof Blob) {
          reader.readAsText(xhr.response);
        } else {
          alert('Unable to download receipt.');
        }
      });
  });

  $(document).on('change', '.js-order-status', function () {
    const $select = $(this);
    const orderId = $select.data('order-id');
    const previousStatus = $select.data('current-status');
    const status = $select.val();

    $select.prop('disabled', true);

    FurnitureShopAPI.patch(`/orders/${orderId}/status`, { status })
      .done(() => {
        $select.data('current-status', status);
        setOrderMessage('Order status updated.', 'success');
        loadAdminOrders();
      })
      .fail((xhr) => {
        $select.val(previousStatus);
        setOrderMessage(xhr.responseJSON?.message || 'Failed to update order status.', 'danger');
      })
      .always(() => {
        $select.prop('disabled', false);
      });
  });

  $(document).on('submit', '#checkoutForm', function (event) {
    event.preventDefault();
    FurnitureShopAPI.clearMessage('#checkoutMessage');

    if (!FurnitureShopAPI.ensureAuth()) {
      return;
    }

    const payload = {
      shippingAddress: $('#shipAddress').val(),
      paymentMethod: $('#paymentMethod').val(),
    };

    FurnitureShopAPI.post('/orders', payload)
      .done((response) => {
        FurnitureShopAPI.setMessage('#checkoutMessage', response.message || 'Order placed successfully.', 'success');
        setTimeout(() => {
          window.location.href = 'orders.html';
        }, 900);
      })
      .fail((xhr) => {
        FurnitureShopAPI.setMessage('#checkoutMessage', xhr.responseJSON?.message || 'Failed to place order.', 'danger');
      });
  });

  $(loadOrders);
})(jQuery);
