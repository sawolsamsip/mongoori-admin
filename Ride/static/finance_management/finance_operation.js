$('#manageOperationFinanceModal').on('shown.bs.modal', function () {
    const vehicleId = $(this).data('vehicleId');
    if (!vehicleId) return;

    loadOperationCategories();
    loadFleetServices();
    resetOperationCostForm();
    resetOperationRevenueForm();
});


/* Category Load */
async function loadOperationCategories() {
  const costSelect = $('#opCostCategory');
  const revenueSelect = $('#opRevenueCategory');

  costSelect.empty().append('<option value="" disabled selected>Choose...</option>');
  revenueSelect.empty().append('<option value="" disabled selected>Choose...</option>');

  try {
    const [costRes, revenueRes] = await Promise.all([
      fetch('/api/finance/operation/categories?type=cost'),
      fetch('/api/finance/operation/categories?type=revenue')
    ]);

    const costData = await costRes.json();
    const revenueData = await revenueRes.json();

    if (!costRes.ok || !costData.success) {
      throw new Error(costData.message || 'Failed to load cost categories');
    }
    if (!revenueRes.ok || !revenueData.success) {
      throw new Error(revenueData.message || 'Failed to load revenue categories');
    }

    costData.categories.forEach(c => {
      costSelect.append(`<option value="${c.category_id}">${c.name}</option>`);
    });

    revenueData.categories.forEach(c => {
      revenueSelect.append(`<option value="${c.category_id}">${c.name}</option>`);
    });

  } catch (err) {
    console.error(err);
    alert('Failed to load operation categories.');
  }
}

/* Fleet Category Load For Revenue */
async function loadFleetServices() {
  const select = $('#opRevenueFleet');
  select.empty().append(
    '<option value="" disabled selected>Choose...</option>'
  );

  try {
    const res = await fetch('/api/finance/fleets');
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert('Failed to load fleet services.');
      return;
    }

    data.fleets.forEach(f => {
      select.append(
        `<option value="${f.fleet_service_id}">${f.name}</option>`
      );
    });

  } catch (err) {
    console.error(err);
    alert('Network error while loading fleets.');
  }
}



/* Save Operation Cost */
$(document).on('click', '#saveOpCostBtn', async function () {
  const modal = $('#manageOperationFinanceModal');
  const vehicleId = modal.data('vehicleId');
  if (!vehicleId) return alert('Vehicle context missing.');

  const categoryText =
    $('#opCostCategory option:selected').text() || '';

  const payload = {
    vehicle_id: vehicleId,
    category_id: $('#opCostCategory').val(),
    transaction_date: $('#opCostDate').val(),
    amount: $('#opCostAmount').val(),
    note: $('#opCostNote').val()
  };

  if (!payload.category_id || !payload.transaction_date || !payload.amount) {
    return alert('Category, date, and amount are required.');
  }

  // enforce note for Other Cost
  if (categoryText === 'Other Cost' && !payload.note) {
    return alert('Note is required for Other Cost.');
  }

  const btn = $(this);
  btn.prop('disabled', true);

  try {
    const res = await fetch(
      `/api/finance/operations/vehicles/${vehicleId}/transactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save operation cost.');
      return;
    }

    showToast?.('Operation cost saved');
    resetOperationCostForm();

  } catch (err) {
    console.error(err);
    alert('Network error while saving operation cost.');
  } finally {
    btn.prop('disabled', false);
  }
});


/* Save Operation Revenue */
$(document).on('click', '#saveOpRevenueBtn', async function () {
  const modal = $('#manageOperationFinanceModal');
  const vehicleId = modal.data('vehicleId');
  if (!vehicleId) return alert('Vehicle context missing.');

  const categoryText =
    $('#opRevenueCategory option:selected').text() || '';

  const fleetId = $('#opRevenueFleet').val();

  if (categoryText === 'Rental Revenue' && !fleetId) {
    return alert('Platform selection is required for Rental Revenue.');
  }


  const payload = {
    vehicle_id: vehicleId,
    category_id: $('#opRevenueCategory').val(),
    fleet_service_id: $('#opRevenueFleet').val(),
    transaction_date: $('#opRevenueDate').val(),
    amount: $('#opRevenueAmount').val(),
    note: $('#opRevenueNote').val()
  };

  if (!payload.category_id || !payload.transaction_date || !payload.amount) {
    return alert('Category, date, and amount are required.');
  }

  // enforce note for Other Revenue
  if (categoryText === 'Other Revenue' && !payload.note) {
    return alert('Note is required for Other Revenue.');
  }

  try {
    const res = await fetch(
      `/api/finance/operations/vehicles/${vehicleId}/transactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save operation revenue.');
      return;
    }

    showToast?.('Operation revenue saved');
    resetOperationRevenueForm();

  } catch (err) {
    console.error(err);
    alert('Network error while saving operation revenue.');
  }
});


/* Platform Finance Sync */
async function syncPlatformFinance() {
  const res = await fetch('/api/management/finance/sync', {
    method: 'POST',
    credentials: 'same-origin'
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to sync finance');
  }

  return data;
}

function buildFinanceSyncMessage(result) {
  const fetched = result.fetched ?? 0;
  const synced = result.synced ?? 0;
  const skippedNoVehicle = result.skipped_no_vehicle ?? 0;
  const skippedDuplicate = result.skipped_duplicate ?? 0;

  return [
    `Fetched: ${fetched}`,
    `Synced: ${synced}`,
    `Skipped (no vehicle): ${skippedNoVehicle}`,
    `Skipped (duplicate): ${skippedDuplicate}`
  ].join('\n');
}

$(document).on('click', '#pullFinanceBtn', async function () {
  const btn = document.getElementById('pullFinanceBtn');
  if (btn) btn.disabled = true;

  try {
    const result = await syncPlatformFinance();
    alert(`Finance sync complete\n\n${buildFinanceSyncMessage(result)}`);
  } catch (e) {
    alert(e.message || 'Failed to sync finance');
  } finally {
    if (btn) btn.disabled = false;
  }
});


/* Reset */
function resetOperationCostForm() {
  $('#opCostCategory').val('');
  $('#opCostDate').val('');
  $('#opCostAmount').val('');
  $('#opCostNote').val('');
}


/* ===================== SERVICE INVOICE PARSER ===================== */

function _loadInvoiceCostCategories() {
  const select = $('#iuCostCategory');
  if (select.find('option[value!=""]').length) return; // already loaded
  fetch('/api/finance/operation/categories?type=cost')
    .then(r => r.json())
    .then(data => {
      if (!data.success) return;
      data.categories.forEach(c => {
        select.append(`<option value="${c.category_id}">${c.name}</option>`);
      });
    })
    .catch(err => console.error('[invoice] failed to load cost categories', err));
}

/* Load categories as soon as the modal opens */
$('#invoiceUploadModal').on('shown.bs.modal', function () {
  _loadInvoiceCostCategories();
});


/* --- Parse: autofills the visible form fields --- */
$(document).on('click', '#iuParseBtn', async function () {
  const fileInput = document.getElementById('iuFile');
  if (!fileInput || !fileInput.files.length) {
    return alert('Please select a Tesla service invoice PDF.');
  }

  const btn    = $(this);
  const status = $('#iuStatus');
  btn.prop('disabled', true);
  $('#iuVinWarning').addClass('d-none');
  status.html('<span class="text-muted">Parsing invoice, please wait...</span>');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  try {
    const res  = await fetch('/api/invoice/parse', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || !data.success) {
      status.html(`<span class="text-danger">${data.message || 'Parse failed.'}</span>`);
      return;
    }

    const d          = data.data;
    const vehicleVin = ($('#invoiceUploadModal').data('vin') || '').trim().toUpperCase();
    const invoiceVin = (d.vin || '').trim().toUpperCase();

    /* VIN mismatch warning */
    if (invoiceVin && vehicleVin && invoiceVin !== vehicleVin) {
      $('#iuInvoiceVin').text(invoiceVin);
      $('#iuVinWarning').removeClass('d-none');
    }

    /* Autofill editable fields */
    if (d.invoice_date)      $('#iuDate').val(d.invoice_date);
    if (d.total_amount != null) $('#iuAmount').val(d.total_amount);

    const notes = (d.jobs || [])
      .map(j => `${j.concern}: $${Number(j.amount).toFixed(2)}`)
      .join('\n');
    if (notes) $('#iuNotes').val(notes);

    status.html('<span class="text-success">Fields filled from invoice. Review and edit, then save.</span>');

  } catch (err) {
    console.error(err);
    status.html('<span class="text-danger">Network error during parsing.</span>');
  } finally {
    btn.prop('disabled', false);
  }
});


/* --- Save step --- */
$(document).on('click', '#iuSaveBtn', async function () {
  const modal     = $('#invoiceUploadModal');
  const vehicleId = modal.data('vehicleId');
  if (!vehicleId) return alert('Vehicle context missing.');

  const payload = {
    vehicle_id:       vehicleId,
    category_id:      $('#iuCostCategory').val(),
    transaction_date: $('#iuDate').val(),
    amount:           $('#iuAmount').val(),
    note:             $('#iuNotes').val()
  };

  if (!payload.category_id || !payload.transaction_date || !payload.amount) {
    return alert('Category, date, and amount are required.');
  }

  const btn = $(this);
  btn.prop('disabled', true);

  try {
    const res  = await fetch(
      `/api/finance/operations/vehicles/${vehicleId}/transactions`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      }
    );
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save.');
      return;
    }

    showToast?.('Service invoice cost saved');
    bootstrap.Modal.getInstance(document.getElementById('invoiceUploadModal'))?.hide();

  } catch (err) {
    console.error(err);
    alert('Network error while saving.');
  } finally {
    btn.prop('disabled', false);
  }
});

function resetOperationRevenueForm() {
  $('#opRevenueCategory').val('');
  $('#opRevenueDate').val('');
  $('#opRevenueAmount').val('');
  $('#opRevenueNote').val('');
  $('#opRevenueFleet').val('');
}