/* ==================== PURCHASE INVOICE MODAL ==================== */

let _piVehicleList = [];

function _piParseDollar(val) {
  if (val == null || val === '') return '';
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return isNaN(n) ? '' : n;
}

function _piParseDate(val) {
  if (!val) return '';
  // MM/DD/YYYY
  const m = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return '';
}


/* Load vehicle list into dropdown when modal opens */
$('#purchaseInvoiceModal').on('shown.bs.modal', function () {
  _piLoadVehicles();
});

function _piLoadVehicles() {
  const select = $('#piVehicle');
  // Only fetch once per page load
  if (_piVehicleList.length) return;

  select.empty().append('<option value="" disabled selected>Loading vehicles…</option>');

  fetch('/api/management/cars', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(data => {
      if (!data.success) {
        select.empty().append('<option value="" disabled selected>Failed to load</option>');
        return;
      }
      _piVehicleList = data.cars || [];
      select.empty().append('<option value="" disabled selected>Select vehicle…</option>');
      _piVehicleList.forEach(v => {
        const label = [
          v.plate_number || '—',
          v.model ? `${v.model} ${v.model_year || ''}`.trim() : '',
          v.vin || ''
        ].filter(Boolean).join(' · ');
        select.append(
          `<option value="${v.vehicle_id}" data-vin="${v.vin || ''}">${label}</option>`
        );
      });
    })
    .catch(err => {
      console.error('[purchase invoice] vehicle load failed', err);
      select.empty().append('<option value="" disabled selected>Error loading vehicles</option>');
    });
}


/* --- Parse: optional autofill from contract PDF --- */
$(document).on('click', '#piParseBtn', async function () {
  const fileInput = document.getElementById('piFile');
  if (!fileInput || !fileInput.files.length) {
    return alert('Please select a contract file.');
  }

  const btn    = $(this);
  const status = $('#piParseStatus');
  btn.prop('disabled', true);
  $('#piVinMatch').addClass('d-none');
  status.html('<span class="text-muted">Parsing contract, please wait...</span>');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  try {
    const res  = await fetch('/api/contract/parse', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || !data.success) {
      status.html(`<span class="text-danger">${data.message || 'Parse failed.'}</span>`);
      return;
    }

    const d = data.data;

    /* VIN matching */
    const extractedVin = (d.vin || '').trim().toUpperCase();
    if (extractedVin) {
      const match = _piVehicleList.find(v =>
        (v.vin || '').trim().toUpperCase() === extractedVin
      );
      $('#piExtractedVin').text(extractedVin);
      if (match) {
        $('#piVehicle').val(match.vehicle_id);
        $('#piVinMatchText')
          .text('✓ Matched to selected vehicle')
          .removeClass('text-warning').addClass('text-success');
      } else {
        $('#piVinMatchText')
          .text('⚠ No vehicle matched this VIN — please select manually.')
          .removeClass('text-success').addClass('text-warning');
      }
      $('#piVinMatch').removeClass('d-none');
    }

    /* Autofill purchase fields */
    const firstPayDate = _piParseDate(d.first_payment_date);
    if (firstPayDate) {
      /* Use first payment date as a proxy for purchase date if purchase date unavailable */
      if (!$('#piPurchaseDate').val()) $('#piPurchaseDate').val(firstPayDate);
      $('#piFirstPaymentDate').val(firstPayDate);
    }

    const price = _piParseDollar(d.total_sale_price);
    if (price !== '') $('#piVehiclePrice').val(price);

    const outTheDoor = _piParseDollar(d.total_of_payments || d.total_sale_price);
    if (outTheDoor !== '') $('#piOutTheDoor').val(outTheDoor);

    const downPayment = _piParseDollar(d.down_payment);
    if (downPayment !== '') $('#piDownPayment').val(downPayment);

    const financed = _piParseDollar(d.amount_financed);
    if (financed !== '') $('#piFinancedAmount').val(financed);

    if (d.annual_percentage_rate) $('#piApr').val(d.annual_percentage_rate);
    if (d.num_payments)           $('#piLoanTerm').val(d.num_payments);

    const monthly = _piParseDollar(d.monthly_payment);
    if (monthly !== '') $('#piMonthlyPayment').val(monthly);

    status.html('<span class="text-success">Fields filled from contract. Review and edit, then save.</span>');

  } catch (err) {
    console.error(err);
    status.html('<span class="text-danger">Network error during parsing.</span>');
  } finally {
    btn.prop('disabled', false);
  }
});


/* --- Save --- */
$(document).on('click', '#piSaveBtn', async function () {
  const vehicleId   = $('#piVehicle').val();
  const purchaseDate = $('#piPurchaseDate').val();
  const vehiclePrice = $('#piVehiclePrice').val();

  if (!vehicleId)    return alert('Please select a vehicle.');
  if (!purchaseDate) return alert('Purchase date is required.');
  if (!vehiclePrice) return alert('Vehicle price is required.');

  const payload = {
    purchase_date:       purchaseDate,
    vehicle_price:       vehiclePrice,
    dealer:              $('#piDealer').val()           || null,
    sales_tax:           $('#piSalesTax').val()         || null,
    out_the_door:        $('#piOutTheDoor').val()       || null,
    down_payment:        $('#piDownPayment').val()      || null,
    financed_amount:     $('#piFinancedAmount').val()   || null,
    apr:                 $('#piApr').val()              || null,
    loan_term:           $('#piLoanTerm').val()         || null,
    monthly_payment:     $('#piMonthlyPayment').val()   || null,
    first_payment_date:  $('#piFirstPaymentDate').val() || null,
    notes:               $('#piNotes').val()            || null,
  };

  const btn = $(this);
  btn.prop('disabled', true);

  try {
    const res  = await fetch(`/api/purchase-invoice/vehicles/${vehicleId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save purchase invoice.');
      return;
    }

    showToast?.('Purchase invoice saved');
    bootstrap.Modal.getInstance(document.getElementById('purchaseInvoiceModal'))?.hide();

  } catch (err) {
    console.error(err);
    alert('Network error while saving.');
  } finally {
    btn.prop('disabled', false);
  }
});


/* Reset form fields when modal closes */
$('#purchaseInvoiceModal').on('hidden.bs.modal', function () {
  $('#piFile').val('');
  $('#piParseStatus').html('');
  $('#piVinMatch').addClass('d-none');
  $('#piVehicle').val('');
  $('#piPurchaseDate').val('');
  $('#piVehiclePrice').val('');
  $('#piSalesTax').val('');
  $('#piOutTheDoor').val('');
  $('#piDownPayment').val('');
  $('#piFinancedAmount').val('');
  $('#piApr').val('');
  $('#piLoanTerm').val('');
  $('#piMonthlyPayment').val('');
  $('#piFirstPaymentDate').val('');
  $('#piNotes').val('');
});
