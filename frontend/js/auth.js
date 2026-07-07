(function ($) {
  function redirectAfterLogin(user) {
    if (user && user.role === 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }

    window.location.href = 'home.html';
  }

  //gimagawa ang function na ito para sa pag-load ng users sa admin panel, at para ma-display ang users sa table
  $(function () {
    const session = FurnitureShopAPI.getSession();
    if (session.token && session.user && ($('#loginForm').length || $('#registerForm').length)) {
      redirectAfterLogin(session.user);
    }
  });

  // ----- Login form -----
  const loginValidator = FurnitureShopValidation.attachFormValidation('#loginForm', {
    '#loginEmail': [
      { test: FurnitureShopValidation.isFilled, message: 'Email is required.' },
      { test: FurnitureShopValidation.isEmail, message: 'Enter a valid email address.' },
    ],
    '#loginPassword': [
      { test: FurnitureShopValidation.isFilled, message: 'Password is required.' },
    ],
  });

  //login form submission handler, kung saan kino-collect ang data mula sa login form, at pinapadala ito sa backend para sa authentication
  $(document).on('submit', '#loginForm', function (event) {
    event.preventDefault();
    FurnitureShopAPI.clearMessage('#authMessage');//ginagawa nito ay nililinis ang message area sa login form bago magpakita ng bagong message

    if (!loginValidator.validate()) {
      FurnitureShopAPI.setMessage('#authMessage', 'Please fix the highlighted fields.', 'warning');
      return;
    }
    //ito ay para sa pagkuha ng data mula sa login form, at pag-convert nito sa isang object na ipapadala sa backend para sa authentication
    const payload = FurnitureShopAPI.formToObject(this);

    //ginagawa ang POST request sa backend /auth/login endpoint, at pinapadala ang login credentials (email at password) para sa authentication
    FurnitureShopAPI.post('/auth/login', payload)
      .done((response) => {
        FurnitureShopAPI.setToken(response.token);
        FurnitureShopAPI.setMessage('#authMessage', response.message || 'Login successful.', 'success');
        setTimeout(() => redirectAfterLogin(response.data), 500);
      })
      .fail((xhr) => {
        // eslint-disable-next-line no-console
        console.error('[login] Server response:', xhr.status, xhr.responseJSON);
        FurnitureShopAPI.setMessage('#authMessage', xhr.responseJSON?.message || 'Login failed.', 'danger');
      });
  });

  // ----- Register form -----
  const registerValidator = FurnitureShopValidation.attachFormValidation('#registerForm', {
    '#regName': [
      { test: FurnitureShopValidation.isFilled, message: 'Full name is required.' },
      { test: (value) => FurnitureShopValidation.minLength(value, 2), message: 'Name must be at least 2 characters.' },
    ],
    '#regEmail': [
      { test: FurnitureShopValidation.isFilled, message: 'Email is required.' },
      { test: FurnitureShopValidation.isEmail, message: 'Enter a valid email address.' },
    ],
    '#regPhone': [
      { test: FurnitureShopValidation.isFilled, message: 'Phone number is required.' },
      { test: FurnitureShopValidation.isPhone, message: 'Enter a valid PH mobile number (e.g. 09171234567).' },
    ],
    '#regAddress': [
      { test: FurnitureShopValidation.isFilled, message: 'Address is required.' },
      { test: (value) => FurnitureShopValidation.minLength(value, 5), message: 'Address is too short.' },
    ],
    '#regPassword': [
      { test: FurnitureShopValidation.isFilled, message: 'Password is required.' },
      { test: (value) => FurnitureShopValidation.minLength(value, 6), message: 'Password must be at least 6 characters.' },
    ],
  });

  //ginagawa ang function na ito para sa pag-register ng user, kung saan kino-collect ang data mula sa registration form,
  //  at pinapadala ito sa backend para sa paglikha ng bagong user account
  $(document).on('submit', '#registerForm', function (event) {
    event.preventDefault();
    FurnitureShopAPI.clearMessage('#registerMessage');

    //kung may mali sa validation ng form, magpapakita ng warning message at hindi ipapadala ang request sa backend
    if (!registerValidator.validate()) {
      FurnitureShopAPI.setMessage('#registerMessage', 'Please fix the highlighted fields.', 'warning');
      return;
    }

    const payload = FurnitureShopAPI.formToObject(this);//ito ay para sa pagkuha ng data mula sa registration form, at pag-convert nito sa isang object na ipapadala sa backend para sa pag-register ng user

    //after makuha pinapadala ang POST request sa backend /auth/register endpoint, at pinapadala ang registration data (name, email, phone, address, password) para sa paglikha ng bagong user account
    FurnitureShopAPI.post('/auth/register', payload)
      .done((response) => {
        FurnitureShopAPI.setMessage('#registerMessage', response.message || 'Registration successful.', 'success');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 900);
      })
      .fail((xhr) => {
        // eslint-disable-next-line no-console
        console.error('[register] Server response:', xhr.status, xhr.responseJSON);
        FurnitureShopAPI.setMessage('#registerMessage', xhr.responseJSON?.message || 'Registration failed.', 'danger');
      });
  });
})(jQuery);