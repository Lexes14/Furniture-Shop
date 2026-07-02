(function ($) {
  let salesLineChart;
  let categoryPieChart;
  let productBarChart;
  const orderStatuses = ['pending', 'approved', 'delivered', 'cancelled'];

  function buildChart(instance, ctx, config) {
    if (instance) {
      instance.destroy();
    }

    return new Chart(ctx, config);
  }

  function loadOverview() {
    FurnitureShopAPI.get('/reports/overview')
      .done((response) => {
        const data = response.data || {};
        $('#metricOrders').text(data.totalOrders || 0);
        $('#metricUsers').text(data.totalUsers || 0);
        $('#metricLowStock').text(data.lowStockItems || 0);
        $('#metricRevenue').text(FurnitureShopAPI.currency(data.revenue || 0));
      });
  }

  function loadCharts() {
    FurnitureShopAPI.get('/charts/sales-line')
      .done((response) => {
        const chartData = response.data;
        const ctx = document.getElementById('salesLineChart');
        if (ctx) {
          salesLineChart = buildChart(salesLineChart, ctx, { type: 'line', data: chartData, options: { responsive: true, plugins: { legend: { display: false } } } });
        }
      });

    FurnitureShopAPI.get('/charts/category-pie')
      .done((response) => {
        const chartData = response.data;
        const ctx = document.getElementById('categoryPieChart');
        if (ctx) {
          categoryPieChart = buildChart(categoryPieChart, ctx, { type: 'pie', data: chartData, options: { responsive: true } });
        }
      });

    FurnitureShopAPI.get('/charts/product-bar')
      .done((response) => {
        const chartData = response.data;
        const ctx = document.getElementById('productBarChart');
        if (ctx) {
          productBarChart = buildChart(productBarChart, ctx, { type: 'bar', data: chartData, options: { responsive: true, plugins: { legend: { display: false } } } });
        }
      });
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setOrderMessage(message, type = 'warning') {
    FurnitureShopAPI.setMessage('#orderMessage', message, type);
    setTimeout(() => FurnitureShopAPI.clearMessage('#orderMessage'), 3500);
  }

  function renderStatusSelect(order) {
    const options = orderStatuses.map((status) => {
      const selected = status === order.status ? 'selected' : '';
      return `<option value="${status}" ${selected}>${status.charAt(0).toUpperCase()}${status.slice(1)}</option>`;
    }).join('');

    return `<select class="status-select js-order-status" data-order-id="${order.id}" data-current-status="${escapeHtml(order.status)}" aria-label="Update status for ${escapeHtml(order.orderNumber)}">${options}</select>`;
  }

  function renderOrders(orders) {
    const $tbody = $('#dashboardOrderTable tbody');

    if (!orders.length) {
      $tbody.html('<tr><td colspan="6">No orders found.</td></tr>');
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
        </tr>
      `;
    }).join('');

    $tbody.html(rows);
  }

  function loadOrders() {
    const params = { limit: 20 };
    const search = String($('#dashboardOrderSearch').val() || '').trim();
    const status = $('#dashboardOrderStatus').val();

    if (search) {
      params.search = search;
    }
    if (status) {
      params.status = status;
    }

    $('#dashboardOrderTable tbody').html('<tr><td colspan="6">Loading orders...</td></tr>');

    FurnitureShopAPI.get('/orders', params)
      .done((response) => {
        renderOrders(response.data || []);
      })
      .fail(() => {
        $('#dashboardOrderTable tbody').html('<tr><td colspan="6">Unable to load orders.</td></tr>');
      });
  }

  function bindOrderControls() {
    $('#dashboardOrderSearch').on('input', FurnitureShopAPI.debounce(loadOrders));
    $('#dashboardOrderStatus').on('change', loadOrders);

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
          loadOverview();
        })
        .fail((xhr) => {
          $select.val(previousStatus);
          setOrderMessage(xhr.responseJSON?.message || 'Failed to update order status.', 'danger');
        })
        .always(() => {
          $select.prop('disabled', false);
        });
    });
  }

  $(function () {
    if (!FurnitureShopAPI.ensureAuth(['admin'])) {
      return;
    }

    $('[data-reveal]').addClass('is-ready');
    loadOverview();
    loadCharts();
    bindOrderControls();
    loadOrders();
  });
})(jQuery);
