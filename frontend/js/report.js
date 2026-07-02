(function ($) {
  let dailyChart;
  let monthlyChart;
  let bestSellerChart;

  function buildChart(instance, ctx, config) {
    if (instance) {
      instance.destroy();
    }

    return new Chart(ctx, config);
  }

  function loadReports() {
    FurnitureShopAPI.get('/reports/overview')
      .done((response) => {
        const data = response.data || {};
        if ($('#reportTable').length) {
          $('#reportTable').DataTable({
            destroy: true,
            paging: true,
            searching: false,
            data: [
              ['Revenue', 'Overview', FurnitureShopAPI.currency(data.revenue || 0)],
              ['Orders', 'Overview', data.totalOrders || 0],
              ['Transactions', 'Overview', data.totalTransactions || 0],
              ['Products', 'Overview', data.totalProducts || 0],
            ],
            columns: [
              { title: 'Type' },
              { title: 'Reference' },
              { title: 'Value' },
            ],
          });
        }
      });

    FurnitureShopAPI.get('/charts/sales-bar')
      .done((response) => {
        const ctx = document.getElementById('reportDailyChart');
        if (ctx) {
          dailyChart = buildChart(dailyChart, ctx, { type: 'bar', data: response.data, options: { responsive: true, plugins: { legend: { display: false } } } });
        }
      });

    FurnitureShopAPI.get('/charts/sales-line')
      .done((response) => {
        const ctx = document.getElementById('reportMonthlyChart');
        if (ctx) {
          monthlyChart = buildChart(monthlyChart, ctx, { type: 'line', data: response.data, options: { responsive: true } });
        }
      });

    FurnitureShopAPI.get('/charts/product-bar')
      .done((response) => {
        const ctx = document.getElementById('reportBestSellerChart');
        if (ctx) {
          bestSellerChart = buildChart(bestSellerChart, ctx, { type: 'bar', data: response.data, options: { responsive: true, plugins: { legend: { display: false } } } });
        }
      });
  }

  $(function () {
    if (!FurnitureShopAPI.ensureAuth(['admin'])) {
      return;
    }

    loadReports();
  });
})(jQuery);