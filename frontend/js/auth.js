(function ($) {
  function redirectAfterLogin(user) {
    if (user && user.role === 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }

    window.location.href = 'home.html';
  }

  $(function () {
    const session = FurnitureShopAPI.getSession();
    if (session.token && session.user && ($('#loginForm').length || $('#registerForm').length)) {
      redirectAfterLogin(session.user);
    }
  });

  $(document).on('submit', '#loginForm', function (event) {
    event.preventDefault();
    FurnitureShopAPI.clearMessage('#authMessage');

    const payload = FurnitureShopAPI.formToObject(this);
    if (!FurnitureShopValidation.isEmail(payload.email) || !FurnitureShopValidation.isFilled(payload.password)) {
      FurnitureShopAPI.setMessage('#authMessage', 'Enter a valid email and password.', 'warning');
      return;
    }

    FurnitureShopAPI.post('/auth/login', payload)
      .done((response) => {
        FurnitureShopAPI.setToken(response.token);
        FurnitureShopAPI.setMessage('#authMessage', response.message || 'Login successful.', 'success');
        setTimeout(() => redirectAfterLogin(response.data), 500);
      })
      .fail((xhr) => {
        FurnitureShopAPI.setMessage('#authMessage', xhr.responseJSON?.message || 'Login failed.', 'danger');
      });
  });

  $(document).on('submit', '#registerForm', function (event) {
    event.preventDefault();
    FurnitureShopAPI.clearMessage('#registerMessage');

    const payload = FurnitureShopAPI.formToObject(this);
    if (!FurnitureShopValidation.isFilled(payload.name) || !FurnitureShopValidation.isEmail(payload.email) || !FurnitureShopValidation.isFilled(payload.password)) {
      FurnitureShopAPI.setMessage('#registerMessage', 'Please complete the required fields correctly.', 'warning');
      return;
    }

    FurnitureShopAPI.post('/auth/register', payload)
      .done((response) => {
        FurnitureShopAPI.setMessage('#registerMessage', response.message || 'Registration successful.', 'success');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 900);
      })
      .fail((xhr) => {
        FurnitureShopAPI.setMessage('#registerMessage', xhr.responseJSON?.message || 'Registration failed.', 'danger');
      });
  });
})(jQuery);
