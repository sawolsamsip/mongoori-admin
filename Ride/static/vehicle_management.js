$(document).ready(function () {
    const table = $('#vehicleTable').DataTable({
    responsive: false,
    autoWidth: false,
    scrollX: true,
    
    columnDefs: [
        // Plate column: show plate + small vin
        {
            targets: 0,
            render: function (data, type, row) {
                const vin = row[1]; // VIN column

                if (type === 'display') {
                    return `
                        <div>
                            <div class="fw-semibold">${data}</div>
                            <div class="text-muted small">${vin}</div>
                        </div>
                    `;
                }
                // for search / sort → include both
                return `${data} ${vin}`;
            }
        },
        // Hide VIN column itself
        {
            targets: 1,
            visible: false
        }
    ],
    
    // order by plate
    order: [[0, 'asc']]
    });

    let openedActionRow = null;

    $('#vehicleTable tbody').on('click', 'tr', function(){
        if ($(this).hasClass('group-row')) return;

        const vehicleId = $(this).data('id');
        const vin = $(this).data('vin');
        const plate = $(this).data('plate');
        
        if (!vehicleId) return;
        
        const row = table.row(this);

        //toggle same row
        if (openedActionRow && openedActionRow.index() === row.index()){
            row.child.hide();
            openedActionRow = null;
            return;
        }

        // close
        if(openedActionRow){
            openedActionRow.child.hide();
            openedActionRow = null;
        }
        
        // add action row
        
        const actionHtml = `
            <div class="d-flex gap-3 py-2 flex-wrap">
            <button class="btn btn-sm btn-outline-secondary actManageFinance" data-id="${vehicleId}" data-vin="${vin}"
            data-plate="${plate}">
                Manage Finance
            </button>

            <button class="btn btn-sm btn-outline-primary actAddPurchaseDoc"
                data-id="${vehicleId}" data-vin="${vin}" data-plate="${plate}">
                Add Purchase Document
            </button>

            <button class="btn btn-sm btn-outline-warning actAddServiceInvoice"
                data-id="${vehicleId}" data-vin="${vin}" data-plate="${plate}">
                Add Service Invoice
            </button>

            <button class="btn btn-sm btn-outline-info actManageWarranty" data-id="${vehicleId}">
                Manage Warranty
            </button>

            <button class="btn btn-sm btn-outline-secondary actEditVehicle" data-id="${vehicleId}">
                Detail
            </button>

            <button class="btn btn-sm btn-outline-danger actDeleteVehicle" data-id="${vehicleId}">
                Delete
            </button>

        </div>
        `;
        
        row.child(actionHtml).show();

        openedActionRow = row;

    });

    // Edit
    $(document).on('click', '.actEditVehicle', function(){
        const id = $(this).data('id');
        if (!id) return;
        window.location.href = `/admin/vehicles/${id}`;
    });

    // Delete
    $(document).on('click', '.actDeleteVehicle', async function(){
        const id = $(this).data('id');
        if (!id) return;

        if (!confirm("Are you sure you want to delete this vehicle?")) return;

        try {
            const res = await fetch(`/api/vehicles/${id}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (data.success) {
                if (openedActionRow){
                    openedActionRow.child.hide();
                    openedActionRow = null;
                }
                const row = $(`#vehicleTable tr[data-id="${id}"]`);
                row.fadeOut(300, function(){ $(this).remove(); });
                showToast(data.message);
            } else {
                alert(data.message || "Delete failed");
            }
        } catch (err) {
            console.error(err);
            alert("Network error while deleting vehicle");
        }
    });

    // manage Finance modal open
    $(document).on('click', '.actManageFinance', function () {
        const vehicleId = $(this).data('id');
        const vin = $(this).data('vin');
        const plate = $(this).data('plate');

        if (!vehicleId) return;

        const modalEl = document.getElementById('manageFinanceModal');
        $(modalEl).data('vehicleId', vehicleId);

        $('#mfVin').text(vin || '-');
        $('#mfPlate').text(plate || '-');

        // reset inputs
        $('#costDate').val('');
        $('#costCategory').val('');
        $('#costAmount').val('');
        $('#costNote').val('');

        $('#revenueDate').val('');
        $('#revenueCategory').val('');
        $('#revenueAmount').val('');
        $('#revenueNote').val('');

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    });

    // Add Purchase Document modal
    $(document).on('click', '.actAddPurchaseDoc', function () {
        const vehicleId = $(this).data('id');
        const vin       = $(this).data('vin');
        const plate     = $(this).data('plate');
        if (!vehicleId) return;

        const modalEl = document.getElementById('purchaseUploadModal');
        $(modalEl).data({ vehicleId, vin, plate });

        $('#puVin').text(vin || '-');
        $('#puPlate').text(plate || '-');
        $('#puFile').val('');
        $('#puStatus').html('');
        $('#puPreview').addClass('d-none');
        $('#puPreviewContent').text('');

        new bootstrap.Modal(modalEl).show();
    });

    // Add Service Invoice modal
    $(document).on('click', '.actAddServiceInvoice', function () {
        const vehicleId = $(this).data('id');
        const vin       = $(this).data('vin');
        const plate     = $(this).data('plate');
        if (!vehicleId) return;

        const modalEl = document.getElementById('invoiceUploadModal');
        $(modalEl).data({ vehicleId, vin, plate });

        $('#iuVin').text(vin || '-');
        $('#iuPlate').text(plate || '-');
        $('#iuFile').val('');
        $('#iuStatus').html('');
        $('#iuReview').addClass('d-none');

        new bootstrap.Modal(modalEl).show();
    });

    //manage warranty
    $(document).on('click', '.actManageWarranty', function(){
        const vehicleId = $(this).data('id');

        // redirection to warranty purchase
        window.location.href = `/admin/warranties/purchase?vehicle_id=${vehicleId}`;
    });


    $(window).on('resize', function () {
        table.columns.adjust();
    });

});

