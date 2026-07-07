//utility functions ay ginagamit para sa pag-handle ng API requests, authentication, 
// at iba pang common tasks sa frontend ng FurnitureShop application.

(function (window, $) {
  const API_BASE_URL = window.FURNITURE_SHOP_API_BASE_URL || 'http://localhost:5000/api';
  const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');



//function para kunin ang token mula sa localStorage  
  function getToken() {
    return localStorage.getItem('furniture_shop_token') || '';
  }

  //function para i-set ang token sa localStorage
  function setToken(token) {
    //kung may token, ise-save ito sa localStorage, kung wala, tatanggalin ang token sa localStorage
    if (token) {
      localStorage.setItem('furniture_shop_token', token);
    } else {
      localStorage.removeItem('furniture_shop_token');
    }
  }

  //function para gumawa ng authorization headers para sa mga API requests
  //ang function na ito ay kumukuha ng data sa localStorage at nagbabalik ng object na may Authorization header kung may token
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

  // AJAX request sa API
  //dito nangyayari ang pag-send ng request sa backend, at pag-receive ng response mula sa backend
  //ito ang ginagamit ng mga ibang function tulad ng get, post, put, patch, del para gumawa ng specific na request sa API papuntang backend
  function request(path, options = {}) {
    //ang ajaxRequest ay isang jQuery AJAX request na nagse-send ng HTTP request sa backend API, gamit ang path at options na ibinigay
    const ajaxRequest = $.ajax({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      headers: {
        //galing ito sa authHeaders function na kumukuha ng token mula sa localStorage at nagbabalik ng Authorization header kung may token
        ...authHeaders(), 
        ...(options.headers || {}),
      },
      contentType: options.contentType === undefined ? 'application/json' : options.contentType,
      processData: options.processData === undefined ? true : options.processData,//ito ay para sa pag-handle ng data na galing sa frontend, kung ito ay dapat i-process o hindi bago ipadala sa backend
      dataType: options.dataType || 'json',//ito ay para sa pag-handle ng response na galing sa backend, kung ito ay dapat i-parse bilang JSON o hindi
      xhrFields: {
        withCredentials: true,
      },
    });

  
    ajaxRequest.fail((xhr) => handleUnauthorized(path, xhr));
    return ajaxRequest;
  }

  //ITO YUNG FUNCTION NA GUMAGAWA NG JSON REQUEST SA API
  //pangunahing ginagamit ito para sa pag-send ng POST, PUT, at PATCH requests sa backend, kung saan ang data ay naka-JSON format
  function jsonRequest(path, method, data = {}) {
    return request(path, {
      method,
      data: JSON.stringify(data),//ang stringify ay ginagamit para i-convert ang JavaScript object na galing sa frontend sa JSON string bago ipadala sa backend
      contentType: 'application/json',
      processData: false,
    });
  }

  function get(path, params) {
    return request(path, { method: 'GET', data: params });
  }

  //ginagamit ito para sa pag-send ng POST request sa API
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

  //ginagawa nito ang pag-convert ng form data sa isang JavaScript object sa pamamagitan ng FormData API. 
  // Ang function na ito ay ginagamit para sa pagkuha ng data mula sa isang HTML form at i-convert ito sa 
  // isang object na maaaring ipadala sa backend bilang JSON.
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

  //ginagawa nito ang pag-render ng navigation bar depende kung naka-login o hindi ang user
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

    const adminPages = ['dashboard.html', 'orders.html', 'users.html', 'items.html', 'transactions.html', 'reports.html'];
    if (!adminPages.includes(page)) {
      return;
    }

    const links = [
      ['dashboard.html', 'Dashboard'],
      ['orders.html', 'Orders'],
      ['users.html', 'Users'],
      ['items.html', 'Items'],
      ['transactions.html', 'Transactions'],
      ['reports.html', 'Reports'],
    ];

    $nav.html(links.map(([href, label]) => {
      const active = page === href ? ' class="active"' : '';
      return `<a${active} href="${href}">${label}</a>`;
    }).join(''));
}

  
  function initAuthUi() {
    //ito yung function na nagre-render ng navigation bar depende kung naka-login o hindi ang user
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

  //ang ginagawa nito ay para i-clear ang message sa isang element na may specific selector
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