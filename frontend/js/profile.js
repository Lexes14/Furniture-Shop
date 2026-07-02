(function ($) {
  function loadProfile() {
    if (!FurnitureShopAPI.ensureAuth()) {
      return;
    }

    FurnitureShopAPI.get('/auth/me')
      .done((response) => {
        const user = response.data || {};
        $('#profileName').val(user.name || '');
        $('#profileEmail').val(user.email || '');
        $('#profilePhone').val(user.phone || '');
        $('#profileAddress').val(user.address || '');
      });
  }

  $(document).on('submit', '#profileForm', function (event) {
    event.preventDefault();
    FurnitureShopAPI.clearMessage('#profileMessage');

    FurnitureShopAPI.put('/auth/me', FurnitureShopAPI.formToObject(this))
      .done((response) => {
        FurnitureShopAPI.setMessage('#profileMessage', response.message || 'Profile saved successfully.', 'success');
      })
      .fail((xhr) => {
        FurnitureShopAPI.setMessage('#profileMessage', xhr.responseJSON?.message || 'Failed to save profile.', 'danger');
      });
  });

  $(loadProfile);
})(jQuery);