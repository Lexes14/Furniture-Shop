(function (window, $) {
  const API_BASE_URL = window.FURNITURE_SHOP_API_BASE_URL || 'http://localhost:5000/api';
  const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

  function getToken() {
    return localStorage.getItem('furniture_shop_token') || '';
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('furniture_shop_token', token);
    } else {
      localStorage.removeItem('furniture_shop_token');
    }
  }

  function authHeaders() {
    const headers = {};
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  function isAuthPage() {
    return ['login.html', 'register.html'].some((page) => window.location.pathname.endsWith(page));
  }

  function isProtectedPage() {
    return ['cart.html', 'checkout.html', 'orders.html', 'profile.html', 'dashboard.html', 'users.html', 'items.html', 'reports.html']
      .some((page) => window.location.pathname.endsWith(page));
  }

  function handleUnauthorized(path, xhr) {
    if (xhr.status !== 401 || path === '/auth/login' || path === '/auth/register') {
      return;
    }

    setToken('');
    renderAuthNavigation();

    if (isProtectedPage() && !isAuthPage()) {
      redirectToLogin();
    }
  }

  function request(path, options = {}) {
    const ajaxRequest = $.ajax({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      headers: {
        ...authHeaders(), 
        ...(options.headers || {}),
      },
      contentType: options.contentType === undefined ? 'application/json' : options.contentType,
      processData: options.processData === undefined ? true : options.processData,
      dataType: options.dataType || 'json',
      xhrFields: {
        withCredentials: true,
      },
    });

    ajaxRequest.fail((xhr) => handleUnauthorized(path, xhr));
    return ajaxRequest;
  }

  function jsonRequest(path, method, data = {}) {
    return request(path, {
      method,
      data: JSON.stringify(data),
      contentType: 'application/json',
      processData: false,
    });
  }

  function get(path, params) {
    return request(path, { method: 'GET', data: params });
  }

  function post(path, data) {
    return jsonRequest(path, 'POST', data);
  }

  function put(path, data) {
    return jsonRequest(path, 'PUT', data);
  }

  function patch(path, data) {
    return jsonRequest(path, 'PATCH', data);
  }

  function del(path) {
    return request(path, { method: 'DELETE', contentType: 'application/json', processData: false, data: '{}' });
  }

  function formToObject(form) {
    const formData = new FormData(form);
    const payload = {};
    for (const [key, value] of formData.entries()) {
      payload[key] = value;
    }
    return payload;
  }

  function debounce(callback, delay = 350) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback.apply(this, args), delay);
    };
  }

  function currency(value) {
    const number = Number(value || 0);
    return `₱${number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function itemImages(item) {
    const images = item && item.images;

    if (!images) {
      return [];
    }

    if (Array.isArray(images)) {
      return images.filter(Boolean);
    }

    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean);
        }
      } catch (_error) {
        return images.split(',').map((image) => image.trim()).filter(Boolean);
      }
    }

    return [];
  }

  function uploadUrl(folder, filename) {
    if (!filename) {
      return '';
    }

    if (/^https?:\/\//i.test(filename)) {
      return filename;
    }

    const cleanFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
    const cleanFilename = String(filename).replace(/^\/+/, '');

    return `${SERVER_BASE_URL}/uploads/${cleanFolder}/${cleanFilename}`;
  }

  function decodeToken(token) {
    if (!token || token.split('.').length !== 3) {
      return null;
    }

    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(payload).split('').map((character) => `%${(`00${character.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
      return JSON.parse(json);
    } catch (_error) {
      return null;
    }
  }

  function getSession() {
    const token = getToken();
    const user = decodeToken(token);
    return { token, user };
  }

  function isLoggedIn() {
    const session = getSession();
    return Boolean(session.token && session.user);
  }

  function redirectToLogin() {
    window.location.href = 'login.html';
  }

  function ensureAuth(roles = []) {
    const session = getSession();
    if (!session.token || !session.user) {
      redirectToLogin();
      return false;
    }

    if (roles.length > 0 && !roles.includes(session.user.role)) {
      window.location.href = 'home.html';
      return false;
    }

    return true;
  }

  function renderAuthNavigation() {
    const session = getSession();
    const loggedIn = Boolean(session.token && session.user);
    const role = session.user?.role;
    const $actions = $('.nav__actions');

    renderRoleNavigation();

    if ($actions.length) {
      if (loggedIn) {
        const dashboardLink = role === 'admin'
          ? '<a class="btn btn--primary" href="dashboard.html">Dashboard</a>'
          : '';

        $actions.html(`
          <a class="btn btn--ghost" href="profile.html">Profile</a>
          ${dashboardLink}
          <button class="btn btn--ghost js-logout" type="button">Logout</button>
        `);
      } else {
        $actions.html(`
          <a class="btn btn--ghost" href="login.html">Login</a>
          <a class="btn btn--primary" href="register.html">Create Account</a>
        `);
      }
    }

    $('.nav a[href="login.html"]').toggle(!loggedIn);
    $('.nav a[href="register.html"]').toggle(!loggedIn);
    $('.footer__links a[href="login.html"]').toggle(!loggedIn);
    $('.footer__links a[href="register.html"]').toggle(!loggedIn);
  }

  function renderRoleNavigation() {
    const session = getSession();
    const role = session.user?.role;
    const pathname = window.location.pathname;
    const page = pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';
    const $nav = $('.nav');

    if (!$nav.length || role !== 'admin') {
      return;
    }

    const adminPages = ['dashboard.html', 'orders.html', 'users.html', 'items.html', 'reports.html'];
    if (!adminPages.includes(page)) {
      return;
    }

    const links = [
      ['dashboard.html', 'Dashboard'],
      ['orders.html', 'Orders'],
      ['users.html', 'Users'],
      ['items.html', 'Items'],
      ['reports.html', 'Reports'],
    ];

    $nav.html(links.map(([href, label]) => {
      const active = page === href ? ' class="active"' : '';
      return `<a${active} href="${href}">${label}</a>`;
    }).join(''));
  }

  function initAuthUi() {
    renderAuthNavigation();

    $(document).on('click', '.js-logout', function () {
      const finishLogout = () => {
        setToken('');
        renderAuthNavigation();
        window.location.href = 'login.html';
      };

      if (!getToken()) {
        finishLogout();
        return;
      }

      post('/auth/logout', {})
        .always(finishLogout);
    });

    $(document).on('click', 'a[href="cart.html"], a[href="checkout.html"], a[href="orders.html"], a[href="profile.html"]', function (event) {
      if (!isLoggedIn()) {
        event.preventDefault();
        redirectToLogin();
      }
    });
  }

  function setMessage(selector, message, type = 'warning') {
    const $element = $(selector);
    if (!$element.length) {
      return;
    }

    $element.removeClass('badge--success badge--warning badge--danger').addClass(`badge--${type}`).text(message).show();
  }

  function clearMessage(selector) {
    const $element = $(selector);
    if (!$element.length) {
      return;
    }

    $element.hide().text('');
  }

  function download(path, fileName) {
    return $.ajax({
      url: `${API_BASE_URL}${path}`,
      method: 'GET',
      headers: authHeaders(),
      xhrFields: {
        responseType: 'blob',
        withCredentials: true,
      },
      processData: false,
      contentType: false,
    }).done((blob, _status, xhr) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'download.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  }

  function statusBadge(status) {
    const normalized = String(status || '').toLowerCase();
    if (['active', 'approved', 'delivered', 'paid', 'completed'].includes(normalized)) {
      return `<span class="badge badge--success">${status}</span>`;
    }
    if (['pending', 'low stock'].includes(normalized)) {
      return `<span class="badge badge--warning">${status}</span>`;
    }
    if (['inactive', 'cancelled', 'failed', 'refunded', 'out of stock'].includes(normalized)) {
      return `<span class="badge badge--danger">${status}</span>`;
    }
    return `<span class="badge badge--warning">${status}</span>`;
  }

  window.FurnitureShopAPI = {
    baseUrl: API_BASE_URL,
    getToken,
    setToken,
    isLoggedIn,
    authHeaders,
    request,
    get,
    post,
    put,
    patch,
    del,
    formToObject,
    debounce,
    currency,
    itemImages,
    uploadUrl,
    decodeToken,
    getSession,
    ensureAuth,
    renderAuthNavigation,
    renderRoleNavigation,
    setMessage,
    clearMessage,
    download,
    statusBadge,
  };

  $(initAuthUi);
})(window, jQuery);