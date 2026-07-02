(function ($) {
  const userCache = new Map();

  function appendSearch(data) {
    const search = String($('#userSearch').val() || '').trim();
    if (search) {
      data.search = search;
    }
  }

  function loadUsersAjax(_data, callback) {
    const params = { limit: 1000 };
    appendSearch(params);

    FurnitureShopAPI.get('/users', params)
      .done((response) => {
        callback({ data: response.data || [] });
      })
      .fail(() => {
        callback({ data: [] });
        $('#userTable tbody').html('<tr><td colspan="5">Unable to load users. Please login again as admin.</td></tr>');
      });
  }

  function loadUsers() {
    if (!FurnitureShopAPI.ensureAuth(['admin'])) {
      return;
    }

    const table = $('#userTable').DataTable({
      ajax: loadUsersAjax,
      searching: false,
      paging: true,
      columns: [
        { data: 'name' },
        { data: 'email' },
        { data: 'role', render: (value) => FurnitureShopAPI.statusBadge(value) },
        { data: 'status', render: (value) => FurnitureShopAPI.statusBadge(value) },
        {
          data: null,
          orderable: false,
          render: (data) => `
            <button class="btn btn--light js-edit-role" data-user-id="${data.id}" type="button">Role</button>
            <button class="btn btn--ghost js-toggle-user" data-user-id="${data.id}" data-status="${data.status}" type="button">Toggle</button>
            <button class="btn btn--ghost js-delete-user" data-user-id="${data.id}" type="button">Delete</button>
          `,
        },
      ],
      drawCallback: function () {
        const api = this.api();
        userCache.clear();
        api.rows().every(function () {
          const row = this.data();
          userCache.set(Number(row.id), row);
        });
      },
    });

    $('#userSearch').on('input', FurnitureShopAPI.debounce(() => {
      table.ajax.reload();
    }));

    $(document).on('click', '.js-edit-role', function () {
      const user = userCache.get(Number($(this).data('user-id')));
      if (!user) {
        return;
      }

      const nextRole = prompt('Enter role (admin/customer):', user.role);
      if (!nextRole) {
        return;
      }

      FurnitureShopAPI.patch(`/users/${user.id}/role`, { role: nextRole })
        .done(() => table.ajax.reload(null, false))
        .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to update role.'));
    });

    $(document).on('click', '.js-toggle-user', function () {
      const userId = Number($(this).data('user-id'));
      const status = String($(this).data('status') || '').toLowerCase();
      const action = status === 'active' ? 'deactivate' : 'activate';

      FurnitureShopAPI.patch(`/users/${userId}/${action}`, {})
        .done(() => table.ajax.reload(null, false))
        .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to update status.'));
    });

    $(document).on('click', '.js-delete-user', function () {
      const userId = Number($(this).data('user-id'));
      const user = userCache.get(userId);
      const currentUser = FurnitureShopAPI.getSession().user;

      if (currentUser && Number(currentUser.id) === userId) {
        alert('You cannot delete your own account while logged in.');
        return;
      }

      const label = user ? `${user.name} (${user.email})` : 'this user';
      if (!confirm(`Delete ${label}? This action cannot be undone.`)) {
        return;
      }

      FurnitureShopAPI.del(`/users/${userId}`)
        .done(() => table.ajax.reload(null, false))
        .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to delete user.'));
    });
  }

  $(loadUsers);
})(jQuery);
