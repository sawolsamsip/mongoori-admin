$(document).ready(function () {
    const table = $('#vehicleTable').DataTable({
    responsive: false,
    autoWidth: false,
    scrollX: true,

    columnDefs: [
        {
            targets: 0, // Plate
            render: function (data, type, row) {
                const vin = row[1]; // VIN

                if (type === 'display') {
                    return `
                        <div>
                            <div class="fw-semibold">${data}</div>
                            <div class="text-muted small">${vin}</div>
                        </div>
                    `;
                }

                if (type === 'filter') {
                    // Plate + VIN for search
                    return `${data} ${vin}`;
                }

                return data;
            }
        },

        {
            targets: 5, // Operation Status
            render: function (data, type) {
                const v = (data || '').toString().trim().toUpperCase();

                if (type === 'display') {
                return v === 'ACTIVE'
                    ? '<span class="badge bg-success">Active</span>'
                    : '<span class="badge bg-secondary">Inactive</span>';
                }

                if (type === 'sort' || type === 'type') {
                // ACTIVE first
                return v === 'ACTIVE' ? 0 : 1;
                }

                if (type === 'filter') {
                // for search
                return v; // 'ACTIVE' or 'INACTIVE'
                }

                return v;
            }
        },

        {
            targets: 1, // VIN
            visible: false,
            searchable: true
        }

    ],

    order: [
        [5, 'asc'], // Operation Status
        [0, 'asc']  // Plate
        ],

    });

    let openedActionRow = null;

    $('#vehicleTable tbody').on('click', 'tr', function(){
        const vehicleId = $(this).data('id');
        const vin = $(this).data('vin');
        const plate = $(this).data('plate');

        if (!vehicleId) return;

        const row = table.row(this);

        //toggle
        if (openedActionRow && openedActionRow.index() === row.index()){
            row.child.hide();
            openedActionRow = null;
            return;
        }

        if(openedActionRow){
            openedActionRow.child.hide();
            openedActionRow = null;
        }

        // add action row

        const actionHtml = `
            <div class="d-flex gap-3 py-2">

            <button class="btn btn-sm btn-outline-secondary actManageFleet" data-id="${vehicleId}" data-vin="${vin}" data-plate="${plate}">
                Manage Fleet
            </button>

            <button class="btn btn-sm btn-outline-success actManageOperationFinance"
                data-id="${vehicleId}" data-vin="${vin}" data-plate="${plate}">
                Operation Finance
            </button>

        </div>
        `;

        row.child(actionHtml).show();

        openedActionRow = row;

    });

    // manage Fleet modal open
    $(document).on('click', '.actManageFleet', function () {
        const vehicleId = $(this).data('id');
        const vin = $(this).data('vin');
        const plate = $(this).data('plate');

        if (!vehicleId) return;

        const modalEl = document.getElementById('manageFleetModal');
        $(modalEl).data('vehicleId', vehicleId);

        $('#mfVin').text(vin || '-');
        $('#mfPlate').text(plate || '-');

        // initialize
        $('#activeFleetTable').html(`
            <tr class="text-muted">
            <td colspan="4" class="text-center">Loading...</td>
            </tr>
        `);
        $('#pastFleetTable').empty();
        $('#newFleetService').val('');
        $('#newFleetFrom').val('');

        const modal = new bootstrap.Modal(
            document.getElementById('manageFleetModal')
        );
        modal.show();
    });

    //
    // Operation Finance Manage modal
    $(document).on('click', '.actManageOperationFinance', function () {
        const vehicleId = $(this).data('id');
        const vin = $(this).data('vin');
        const plate = $(this).data('plate');

        if (!vehicleId) return;

        const modalEl = document.getElementById('manageOperationFinanceModal');
        $(modalEl).data('vehicleId', vehicleId);

        $('#opVin').text(vin || '-');
        $('#opPlate').text(plate || '-');

        // reset COST inputs
        $('#opCostCategory').val('');
        $('#opCostDate').val('');
        $('#opCostAmount').val('');
        $('#opCostNote').val('');

        // reset REVENUE inputs
        $('#opRevenueCategory').val('');
        $('#opRevenueDate').val('');
        $('#opRevenueAmount').val('');
        $('#opRevenueNote').val('');

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    });


    //
    $(window).on('resize', function () {
        table.columns.adjust();
    });

});

function onFleetChanged(vehicleId) {
    const table = $('#vehicleTable').DataTable();
    refreshVehicleRow(vehicleId, table);
}

// refresh vehicle row operation_status after fleet change
async function refreshVehicleRow(vehicleId, table) {
    const res = await fetch(`/api/vehicles/${vehicleId}`);
    const data = await res.json();
    if (!data.success) return;

    const tr = $(`#vehicleTable tr[data-id="${vehicleId}"]`);
    if (!tr.length) return;

    const row = table.row(tr);
    const rowData = row.data();

    rowData[5] = data.vehicle.operation_status; // Operation Status

    row.data(rowData);

    //redraw
    table.draw(false);
}
