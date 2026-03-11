let vehicleTable = null;
let openedActionRow = null;

async function fetchCompanyCars() {
  const res = await fetch("/api/management/cars", {
    credentials: "same-origin"
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || "Failed to fetch cars");
  }

  return data.cars || [];
}

async function syncCompanyCars() {
  const res = await fetch("/api/management/cars/sync", {
    method: "POST",
    credentials: "same-origin"
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || "Failed to sync cars");
  }

  return data;
}

async function updatePlate(vehiclePlatformId, plateNumber) {
  const res = await fetch(`/api/management/cars/${vehiclePlatformId}/plate`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({
      plate_number: plateNumber
    })
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || "Failed to update plate");
  }

  return data;
}

function formatLastSync(iso) {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStatusBadge(status) {
  if (status === "Active") {
    return `<span class="badge bg-success">Active</span>`;
  }
  if (status === "Maintenance") {
    return `<span class="badge bg-warning text-dark">Maintenance</span>`;
  }
  if (status === "Archived") {
    return `<span class="badge bg-dark">Archived</span>`;
  }
  return escapeHtml(status || "");
}

function renderAvailableBadge(isAvailable) {
  return isAvailable
    ? `<span class="badge bg-success">Yes</span>`
    : `<span class="badge bg-secondary">No</span>`;
}

function buildSyncMessage(result) {
  const fetched = result.fetched ?? 0;
  const inserted = result.inserted ?? 0;
  const updated = result.updated ?? 0;
  const skipped = result.skipped ?? 0;

  return [
    `Fetched: ${fetched}`,
    `New: ${inserted}`,
    `Updated: ${updated}`,
    `Skipped: ${skipped}`
  ].join("\n");
}

function buildActionHtml(rowData) {
  const vehiclePlatformId = rowData.vehicle_platform_id;
  const vin = rowData.vin || "";
  const plate = rowData.plate_number || "";

  return `
    <div class="d-flex gap-3 py-2">
      <button
        class="btn btn-sm btn-outline-secondary actManageFinance"
        data-id="${escapeHtml(vehiclePlatformId)}"
        data-vin="${escapeHtml(vin)}"
        data-plate="${escapeHtml(plate)}"
      >
        Manage Finance
      </button>

      <button
        class="btn btn-sm btn-outline-primary actEditPlate"
        data-id="${escapeHtml(vehiclePlatformId)}"
        data-plate="${escapeHtml(plate)}"
      >
        Edit Plate
      </button>
    </div>
  `;
}

function closeOpenedActionRow() {
  if (openedActionRow) {
    openedActionRow.child.hide();
    $(openedActionRow.node()).removeClass("shown");
    openedActionRow = null;
  }
}

function initVehicleTable(cars) {
  vehicleTable = $("#vehicleTable").DataTable({
    data: cars,
    responsive: false,
    autoWidth: false,
    scrollX: true,
    destroy: true,

    columns: [
      { data: "plate_number" },
      { data: "model" },
      { data: "model_year" },
      { data: "trim" },
      { data: "vin" },
      { data: "vehicle_status" },
      { data: "is_available" },
      { data: "last_sync_at" }
    ],

    columnDefs: [
      {
        targets: 0,
        render: function (data, type, row) {
          const plate = data || "";
          const vin = row.vin || "";

          if (type === "display") {
            return `
              <div>
                <div class="fw-semibold">${escapeHtml(plate)}</div>
                <div class="text-muted small">${escapeHtml(vin)}</div>
              </div>
            `;
          }

          return `${plate} ${vin}`;
        }
      },
      {
        targets: 4,
        visible: false
      },
      {
        targets: 5,
        render: function (data, type) {
          if (type === "display") {
            return renderStatusBadge(data);
          }
          return data || "";
        }
      },
      {
        targets: 6,
        render: function (data, type) {
          if (type === "display") {
            return renderAvailableBadge(data);
          }
          return data ? "Yes" : "No";
        }
      },
      {
        targets: 7,
        render: function (data, type) {
          if (type === "display") {
            return escapeHtml(formatLastSync(data));
          }
          return data || "";
        }
      }
    ],

    order: [[0, "asc"]],

    createdRow: function (row, data) {
      row.dataset.vehiclePlatformId = data.vehicle_platform_id || "";
      row.dataset.vin = data.vin || "";
      row.dataset.plate = data.plate_number || "";
      row.style.cursor = "pointer";
    },

    language: {
      emptyTable: "No vehicles found."
    }
  });
}

async function reloadVehicleTable() {
  const cars = await fetchCompanyCars();

  closeOpenedActionRow();

  if (vehicleTable) {
    vehicleTable.clear();
    vehicleTable.rows.add(cars);
    vehicleTable.draw(false);
  } else {
    initVehicleTable(cars);
  }
}

async function pullAndRender() {
  const btn = document.getElementById("pullCarsBtn");
  if (btn) btn.disabled = true;

  try {
    const syncResult = await syncCompanyCars();
    await reloadVehicleTable();

    alert(`Sync complete\n\n${buildSyncMessage(syncResult)}`);
  } catch (e) {
    alert(e.message || "Failed to sync cars");
  } finally {
    if (btn) btn.disabled = false;
  }
}

$(document).ready(async function () {
  const btn = document.getElementById("pullCarsBtn");
  if (btn) btn.disabled = true;

  try {
    await reloadVehicleTable();
  } catch (e) {
    alert(e.message || "Failed to load cars");
  } finally {
    if (btn) btn.disabled = false;
  }

  $("#vehicleTable tbody").on("click", "tr", function (e) {
    if ($(e.target).closest("button").length) return;

    const row = vehicleTable.row(this);
    if (!row || !row.data()) return;

    if (openedActionRow && openedActionRow.index() === row.index()) {
      row.child.hide();
      $(row.node()).removeClass("shown");
      openedActionRow = null;
      return;
    }

    closeOpenedActionRow();

    row.child(buildActionHtml(row.data())).show();
    $(row.node()).addClass("shown");
    openedActionRow = row;
  });

  $(document).on("click", "#pullCarsBtn", function () {
    pullAndRender();
  });

  $(document).on("click", ".actManageFinance", function (e) {
    e.stopPropagation();

    const vehiclePlatformId = $(this).data("id");
    const vin = $(this).data("vin");
    const plate = $(this).data("plate");

    if (!vehiclePlatformId) return;

    const modalEl = document.getElementById("manageFinanceModal");
    if (!modalEl) return;

    $(modalEl).data("vehiclePlatformId", vehiclePlatformId);

    $("#mfVin").text(vin || "-");
    $("#mfPlate").text(plate || "-");

    $("#costDate").val("");
    $("#costCategory").val("");
    $("#costAmount").val("");
    $("#costNote").val("");

    $("#revenueDate").val("");
    $("#revenueCategory").val("");
    $("#revenueAmount").val("");
    $("#revenueNote").val("");

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  });

  $(document).on("click", ".actEditPlate", function (e) {
    e.stopPropagation();
    console.log("Edit Plate clicked");

    const vehiclePlatformId = $(this).data("id");
    const currentPlate = $(this).data("plate") || "";
    console.log("vehiclePlatformId:", vehiclePlatformId);
    console.log("currentPlate:", currentPlate);

    if (!vehiclePlatformId) {
      console.log("No vehiclePlatformId");
      return;
    }

    const modalEl = document.getElementById("editPlateModal");
    console.log("modalEl:", modalEl);

    if (!modalEl) {
      console.log("No modal element");
      return;
    }

    $("#editPlateVehiclePlatformId").val(vehiclePlatformId);
    $("#currentPlateNumber").val(currentPlate);
    $("#newPlateNumber").val(currentPlate);

    console.log("About to show modal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    console.log("Modal show called");
  });

  $(document).on("click", "#savePlateBtn", async function () {
    const vehiclePlatformId = $("#editPlateVehiclePlatformId").val();
    const newPlate = ($("#newPlateNumber").val() || "").trim();

    console.log("savePlate clicked");
    console.log("vehiclePlatformId:", vehiclePlatformId);
    console.log("newPlate:", newPlate);

    if (!vehiclePlatformId) return;

    try {
      await updatePlate(vehiclePlatformId, newPlate);
      await reloadVehicleTable();

      const modalEl = document.getElementById("editPlateModal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      alert("Plate updated successfully");
    } catch (err) {
      alert(err.message || "Failed to update plate");
    }
  });

  $(window).on("resize", function () {
    if (vehicleTable) {
      vehicleTable.columns.adjust();
    }
  });
});