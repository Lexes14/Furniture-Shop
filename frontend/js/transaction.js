(function ($) {
    const transactionCache = new Map();

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function appendFilters(data) {
        const search = String($('#transactionSearch').val() || '').trim();
        const status = String($('#transactionStatusFilter').val() || '').trim();
        if (search) data.search = search;
        if (status) data.status = status;
    }


    function loadTransactionsAjax(_data, callback) {
        const params = { limit: 1000 };
        appendFilters(params);

        FurnitureShopAPI.get('/transactions', params)
            .done((response) => {
                callback({ data: response.data || [] });
            })
            .fail(() => {
                callback({ data: [] });
                $('#transactionTable tbody').html('<tr><td colspan="7">Unable to load transactions. Please login again.</td></tr>');
            });
    }


    function renderCustomerCell(_value, _type, txn) {
        const user = txn.user || txn.order?.user;
        if (!user) {
            return '<span class="customer-cell">N/A</span>';
        }
        return `
      <div class="customer-cell">
        ${escapeHtml(user.name)}
        <small>${escapeHtml(user.email)}</small>
      </div>
    `;
    }

    function renderStatusCell(_value, _type, txn) {
        const statuses = ['pending', 'paid', 'failed', 'refunded'];
        const options = statuses.map((status) => (
            `<option value="${status}" ${status === txn.status ? 'selected' : ''}>${status.charAt(0).toUpperCase() + status.slice(1)}</option>`
        )).join('');

        return `<select class="status-select js-transaction-status" data-transaction-id="${txn.id}">${options}</select>`;
    }

    function renderActionsCell(_value, _type, txn) {
        return `
      <button class="btn btn--light js-edit-transaction" data-transaction-id="${txn.id}" type="button">Edit</button>
      <button class="btn btn--light js-download-receipt" data-transaction-id="${txn.id}" data-transaction-number="${escapeHtml(txn.transactionNumber)}" type="button">Download</button>
      <button class="btn btn--ghost js-delete-transaction" data-transaction-id="${txn.id}" type="button">Delete</button>
    `;
    }

    function resetForm() {
        $('#transactionForm')[0].reset();
        $('#txnId').val('');
        $('#txnOrderId').prop('disabled', false);
        $('#txnSubmitBtn').text('Record Transaction');
        $('#txnCancelEditBtn').hide();
    }

    function populateFormForEdit(txn) {
        $('#txnId').val(txn.id);
        $('#txnOrderId').val(txn.orderId).prop('disabled', true); // orderId cannot change once created
        $('#txnPaymentMethod').val(txn.paymentMethod);
        $('#txnAmount').val(txn.amount);
        $('#txnStatus').val(txn.status);
        $('#txnRemarks').val(txn.remarks || '');
        $('#txnSubmitBtn').text('Update Transaction');
        $('#txnCancelEditBtn').show();
        $('html, body').animate({ scrollTop: $('#transactionForm').offset().top - 20 }, 300);
    }

    //ginagawa ang mga actions sa transaction table
    function attachTransactionActions(table) {
        //kapag clinick na ni user ang submit button sa transaction form, mag eexecute ang code na ito
        $(document).on('submit', '#transactionForm', function (event) {
            event.preventDefault();
            FurnitureShopAPI.clearMessage('#transactionMessage');

            //ang ginagawa nito ay kinukuha ang value ng transaction id na nasa hidden input field na may id na txnId
            const txnId = $('#txnId').val();
            const payload = FurnitureShopAPI.formToObject(this);
            delete payload.txnId;

            //kapag walang transaction id at walang order id o payment method, magpapakita ng warning message
            if (!txnId && (!payload.orderId || !payload.paymentMethod)) {
                FurnitureShopAPI.setMessage('#transactionMessage', 'Order ID and Payment Method are required.', 'warning');
                return;
            }

            //kapag walang amount, ide-delete ang amount property sa payload object
            if (!payload.amount) {
                delete payload.amount;
            }

        //ito na ay nagse-send ng request sa backend para i-save ang transaction, kung may transaction id, magse-send ng PUT request para i-update ang existing transaction, kung wala namang transaction id, magse-send ng POST request para gumawa ng bagong transaction
            const request = txnId
                ? FurnitureShopAPI.put(`/transactions/${txnId}`, payload)//ito ay nagse-send ng PUT request sa backend para i-update ang existing transaction
                : FurnitureShopAPI.post('/transactions', payload);//ito ay nagse-send ng POST request sa backend para gumawa ng bagong transaction

            //kapag successful ang request, magpapakita ng success message at ire-reset ang form at ire-refresh ang transaction table
            request
                .done((response) => {
                    FurnitureShopAPI.setMessage('#transactionMessage', response.message || (txnId ? 'Transaction updated successfully.' : 'Transaction recorded successfully.'), 'success');
                    resetForm();
                    table.ajax.reload(null, false);
                })
                .fail((xhr) => {
                    FurnitureShopAPI.setMessage('#transactionMessage', xhr.responseJSON?.message || 'Failed to save transaction.', 'danger');
                });
        });

        $(document).on('click', '#txnCancelEditBtn', function () {
            resetForm();
        });

        $(document).on('click', '.js-edit-transaction', function () {
            const txn = transactionCache.get(Number($(this).data('transaction-id')));
            if (!txn) {
                return;
            }
            populateFormForEdit(txn);
        });

        $(document).on('click', '.js-delete-transaction', function () {
            const transactionId = Number($(this).data('transaction-id'));
            if (!confirm('Delete this transaction? This cannot be undone.')) {
                return;
            }

            FurnitureShopAPI.del(`/transactions/${transactionId}`)
                .done(() => {
                    if (Number($('#txnId').val()) === transactionId) {
                        resetForm();
                    }
                    table.ajax.reload(null, false);
                })
                .fail((xhr) => alert(xhr.responseJSON?.message || 'Failed to delete transaction.'));
        });

        $(document).on('change', '.js-transaction-status', function () {
            const $select = $(this);
            const transactionId = $select.data('transaction-id');
            const nextStatus = $select.val();

            $select.prop('disabled', true);

            FurnitureShopAPI.patch(`/transactions/${transactionId}/status`, { status: nextStatus })
                .done(() => {
                    table.ajax.reload(null, false);
                })
                .fail((xhr) => {
                    alert(xhr.responseJSON?.message || 'Failed to update transaction status.');
                    table.ajax.reload(null, false);
                })
                .always(() => {
                    $select.prop('disabled', false);
                });
        });

        $(document).on('click', '.js-download-receipt', function () {
            const transactionId = $(this).data('transaction-id');
            const transactionNumber = $(this).data('transaction-number') || transactionId;
            const $button = $(this);

            $button.prop('disabled', true).text('Downloading...');

            FurnitureShopAPI.download(`/pdf/transactions/${transactionId}`, `transaction-${transactionNumber}.pdf`)
                .fail(() => {
                    alert('Failed to download receipt.');
                })
                .always(() => {
                    $button.prop('disabled', false).text('Download');
                });
        });

        $('#transactionStatusFilter').on('change', () => table.ajax.reload());
        $('#transactionSearch').on('input', FurnitureShopAPI.debounce(() => table.ajax.reload()));
    }

    $(function () {
        if (!$('#transactionTable').length) {
            return;
        }

        if (!FurnitureShopAPI.ensureAuth(['admin'])) {
            return;
        }

        const table = $('#transactionTable').DataTable({
            ajax: loadTransactionsAjax,
            paging: true,
            searching: false,
            columns: [
                { data: 'transactionNumber' },
                { data: null, render: (txn) => escapeHtml(txn.order?.orderNumber || txn.orderId) },
                { data: null, render: renderCustomerCell },
                { data: 'amount', render: (value) => FurnitureShopAPI.currency(value) },
                { data: 'paymentMethod' },
                { data: null, render: renderStatusCell },
                { data: null, orderable: false, render: renderActionsCell },
            ],
            drawCallback: function () {
                const api = this.api();
                transactionCache.clear();
                api.rows().every(function () {
                    const row = this.data();
                    transactionCache.set(Number(row.id), row);
                });
            },
        });

        attachTransactionActions(table);
    });
})(jQuery);