$('#manageFinanceModal').on('shown.bs.modal', function () {
    const vehicleId = $(this).data('vehicleId');
    if (!vehicleId) return;

    loadOwnershipCategories();
    resetCostForm();
    resetRevenueForm();
});


/* category load */
async function loadOwnershipCategories() {
  const costSelect = $('#costCategory');
  const revenueSelect = $('#revenueCategory');

  costSelect.empty().append('<option value="" disabled selected>Choose...</option>');
  revenueSelect.empty().append('<option value="" disabled selected>Choose...</option>');

  try {
    const [costRes, revenueRes] = await Promise.all([
      fetch('/api/finance/management/categories?type=cost'),
      fetch('/api/finance/management/categories?type=revenue')
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
    alert('Failed to load finance categories.');
  }
}


/* Toggle */
$('input[name="costPaymentType"]').on('change', function () {
  const type = $(this).val();

  $('#costFieldsOneTime').toggleClass('d-none', type !== 'one_time');
  $('#costFieldsMonthly').toggleClass('d-none', type !== 'monthly');
  $('#costFieldsInstallment').toggleClass('d-none', type !== 'installment');
});


/* Installment */
$('#costInstallStartDate, #costInstallMonths').on('change', function () {
    const startDate = $('#costInstallStartDate').val();
    const months = parseInt($('#costInstallMonths').val(), 10);

    if (!startDate || !months) {
        $('#costInstallEndDate').val('');
        return;
    }

    const [y, m, d] = startDate.split('-').map(Number);
    const start = new Date(y, m - 1, d);

    const end = addMonthsKeepDay(start, months - 1);

    $('#costInstallEndDate').val(toDisplayDate(end));
    $('#costInstallEndDateValue').val(toISODateValue(end));
});

function addMonthsKeepDay(date, months) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  // last day of the target month
  const lastDayOfTargetMonth =
    new Date(y, m + months + 1, 0).getDate();

  return new Date(
    y,
    m + months,
    Math.min(d, lastDayOfTargetMonth)
  );
}

function toDisplayDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

function toISODateValue(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}


/* save cost */
$(document).on('click', '#saveCostBtn', async function () {
  const modal = $('#manageFinanceModal');
  const vehicleId = modal.data('vehicleId');
  if (!vehicleId) return alert('Vehicle context missing.');

  const paymentType = $('input[name="costPaymentType"]:checked').val();
  const cSelect = document.getElementById('costCategory');
  const categoryText = cSelect.options[cSelect.selectedIndex]?.text || '';

  const payload = {
    vehicle_id: vehicleId,
    category_id: $('#costCategory').val(),
    payment_type: paymentType,
    note: $('#costNote').val()
  };

  if (!payload.category_id) {
    return alert('Category is required.');
  }

  let endpoint = '';

  /* ---- one_time → finance_management_transaction ---- */
  if (paymentType === 'one_time') {
    payload.amount = $('#costOneTimeAmount').val();
    payload.transaction_date = $('#costEventDate').val();

    if (!payload.amount || !payload.transaction_date) {
      return alert('Amount and date are required.');
    }

    endpoint = `/api/finance/management/vehicles/${vehicleId}/transactions`;
  }

  /* ---- monthly / installment → finance_management_contract ---- */
  if (paymentType === 'monthly') {
    payload.start_date = $('#costMonthlyStartDate').val();
    payload.end_date = $('#costMonthlyEndDate').val() || null;
    payload.monthly_amount = $('#costMonthlyAmount').val();

    if (!payload.start_date || !payload.monthly_amount) {
      return alert('Monthly amount and start date are required.');
    }

    endpoint = `/api/finance/management/vehicles/${vehicleId}/contracts`;
  }

  if (paymentType === 'installment') {
    payload.start_date = $('#costInstallStartDate').val();
    payload.end_date = $('#costInstallEndDateValue').val();
    payload.monthly_amount = $('#costInstallMonthly').val();
    payload.total_amount = $('#costInstallTotal').val();
    payload.months = $('#costInstallMonths').val();

    if (!payload.start_date || !payload.monthly_amount || !payload.total_amount || !payload.months) {
      return alert('Installment fields are required.');
    }

    endpoint = `/api/finance/management/vehicles/${vehicleId}/contracts`;
  }

  if (categoryText === 'Other Cost' && !payload.note) {
    return alert('Note is required for Other Cost.');
  }

  const btn = $(this);
  btn.prop('disabled', true);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save cost.');
      return;
    }

    showToast?.('Saved successfully');
    resetCostForm();

  } catch (err) {
    console.error(err);
    alert('Network error while saving cost.');
  } finally {
    btn.prop('disabled', false);
  }
});

// save revenue
/* save revenue */
$(document).on('click', '#saveRevenueBtn', async function () {
  const modal = $('#manageFinanceModal');
  const vehicleId = modal.data('vehicleId');
  if (!vehicleId) return alert('Vehicle context missing.');

  const categoryText = $('#revenueCategory option:selected').text();

  const payload = {
    vehicle_id: vehicleId,
    category_id: $('#revenueCategory').val(),
    amount: $('#revenueAmount').val(),
    transaction_date: $('#revenueEventDate').val(),
    note: $('#revenueNote').val()
  };

  if (!payload.category_id || !payload.amount || !payload.transaction_date) {
    return alert('Category, date, and amount are required.');
  }

  if (categoryText === 'Other Revenue' && !payload.note) {
    return alert('Note is required for Other Revenue.');
  }

  try {
    const res = await fetch(
      `/api/finance/management/vehicles/${vehicleId}/transactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save revenue.');
      return;
    }

    showToast?.('Revenue saved');
    resetRevenueForm();

  } catch (err) {
    console.error(err);
    alert('Network error while saving revenue.');
  }
});

/* Form Reset Helpers */

function resetCostForm() {
  $('#costCategory').val('');
  $('#costEventDate').val('');
  $('#costNote').val('');

  $('#costOneTimeAmount').val('');

  $('#costMonthlyAmount').val('');
  $('#costMonthlyStartDate').val('');
  $('#costMonthlyEndDate').val('');

  $('#costInstallTotal').val('');
  $('#costInstallMonths').val('');
  $('#costInstallStartDate').val('');
  $('#costInstallEndDate').val('');

  $('#costPtOneTime').prop('checked', true).trigger('change');
}

function resetRevenueForm() {
  $('#revenueCategory').val('');
  $('#revenueEventDate').val('');
  $('#revenueAmount').val('');
  $('#revenueNote').val('');
}

function recalcMonthly() {
    const total = parseFloat($('#costInstallTotal').val());
    const months = parseInt($('#costInstallMonths').val(), 10);
    if (!total || !months) return;

    const auto = (total / months).toFixed(2);
    const monthlyInput = $('#costInstallMonthly');

    
    monthlyInput.val(auto);
}

$('#costInstallMonthly').on('input', function () {
  $(this).data('touched', true);
  $('#monthlyHint').text('');
});

$('#costInstallTotal, #costInstallMonths').on('input', recalcMonthly);