async function fetchCompanyCars() {
  const res = await fetch("/api/management/cars", { credentials: "same-origin" });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to fetch cars");
  }
  return data.cars || [];
}

function formatLastSync(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function renderCarsTable(cars) {
  const tbody = document.querySelector("#vehicleTableV2 tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  for (const c of cars) {
    const statusText = c.isAvaliable ? "Active" : "Unavailable";
    const availableText = c.isAvaliable ? "Yes" : "No";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.location || ""}</td>
      <td>${statusText}</td>
      <td>${c.model || ""}</td>
      <td>${c.year ?? ""}</td>
      <td>${c.trim || ""}</td>
      <td>${c.vin || ""}</td>
      <td>${availableText}</td>
      <td>${formatLastSync(c.updatedAt)}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function pullAndRender() {
  const btn = document.getElementById("pullCarsBtn");
  if (btn) btn.disabled = true;

  try {
    const cars = await fetchCompanyCars();
    renderCarsTable(cars);
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  pullAndRender();
});

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "pullCarsBtn") {
    pullAndRender();
  }
});