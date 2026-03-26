let financeChart;
let rentalAnalyticsData = null;

document.addEventListener("DOMContentLoaded", () => {

    loadFinanceSeries();
    loadRentalAnalytics();

    const switchEl = document.getElementById("dashboardModeSwitch");
    const windowSelect = document.getElementById("financeWindowSelect");

    if (switchEl) {
        switchEl.addEventListener("change", loadFinanceSeries);
    }

    if (windowSelect) {
        windowSelect.addEventListener("change", loadFinanceSeries);
    }

    document.addEventListener("click", e => {
        const btn = e.target.closest(".ra-period-btn");
        if (!btn) return;
        document.querySelectorAll(".ra-period-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderRentalAnalytics(parseInt(btn.dataset.period));
    });
});

async function loadFinanceSeries(){
    try {
        const switchEl = document.getElementById("dashboardModeSwitch");
        const mode = switchEl && switchEl.checked ? "full" : "operation";

        const windowSelect = document.getElementById("financeWindowSelect");
        const windowSize = windowSelect ? parseInt(windowSelect.value) : 12;

        const res = await fetch(
            `/api/finance/timeseries?window=${windowSize}&mode=${mode}`
        );

        let json;
        try {
            json = await res.json();
        } catch (_) {
            return; // chart stays empty on parse error
        }

        if(!json.success) return;

        const normalized = normalizeFinanceSeries(json.data, windowSize);

        renderFinanceBarChart(
            normalized.labels,
            normalized.revenue,
            normalized.expense,
            normalized.net
        );
    } catch (_) {
        // network error — chart stays empty
    }
}

// rendering
function renderFinanceBarChart(labels, revenue, expense, net){

    const canvas = document.getElementById("finance-bar-chart");
    if(!canvas) return;

    const ctx = canvas.getContext("2d");

    if(financeChart){
        financeChart.destroy();
    }

    financeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenue,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)'
                },
                {
                    label: 'Expense',
                    data: expense,
                    backgroundColor: 'rgba(220, 53, 69, 0.7)'
                },
                {
                    label: 'Net',
                    data: net,
                    backgroundColor: 'rgba(23, 162, 184, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            onClick: async function(evt, elements) {

                if (!elements.length) return;

                const index = elements[0].index;
                const datasetIndex = elements[0].datasetIndex;

                const month = labels[index];

                let type;
                if (datasetIndex === 0) type = "revenue";
                else if (datasetIndex === 1) type = "cost";
                else type = "net";

                await loadMonthlyDetails(month, type);
            },
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx){
                            const v = ctx.raw || 0;
                            const sign = v < 0 ? '-' : '';
                            return `${ctx.dataset.label}: ${sign}$${Math.abs(v).toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value){
                            const sign = value < 0 ? '-' : '';
                            return `${sign}$${Math.abs(value).toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
}


// ---- Helper: generate expected month labels ----
function generateLastMonths(window = 12){
    const months = [];
    const now = new Date();

    for(let i = window - 1; i >= 0; i--){
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
    }

    return months;
}


// ---- Normalize API data ----
function normalizeFinanceSeries(apiData, window = 12){

    const expectedMonths = generateLastMonths(window);

    const map = {};
    apiData.labels.forEach((label, i) => {
        map[label] = {
            revenue: apiData.revenue[i] || 0,
            expense: apiData.expense[i] || 0,
            net: apiData.net[i] || 0
        };
    });

    const labels = [];
    const revenue = [];
    const expense = [];
    const net = [];

    expectedMonths.forEach(month => {
        labels.push(month);

        if(map[month]){
            revenue.push(map[month].revenue);
            expense.push(map[month].expense);
            net.push(map[month].net);
        } else {
            revenue.push(0);
            expense.push(0);
            net.push(0);
        }
    });

    return { labels, revenue, expense, net };
}

// monthly detail

async function loadMonthlyDetails(month, type){

    const switchEl = document.getElementById("dashboardModeSwitch");
    const mode = switchEl && switchEl.checked ? "full" : "operation";

    const res = await fetch(
        `/api/finance/monthly-details?month=${month}&type=${type}&mode=${mode}`
    );

    const json = await res.json();
    if(!json.success) return;

    renderDetailModal(month, type, json.data);
}

function renderDetailModal(month, type, rows){

    const body = document.getElementById("financeDetailBody");
    body.innerHTML = "";

    rows.forEach(r => {
        body.innerHTML += `
            <tr>
                <td>${r.tx_date}</td>
                <td>${r.category_name}</td>
                <td>${r.source}</td>
                <td class="text-end">$${Number(r.amount).toLocaleString()}</td>
            </tr>
        `;
    });

    new bootstrap.Modal(
        document.getElementById("financeDetailModal")
    ).show();
}


// ============================================================
// Rental Analytics
// ============================================================

// ---- Model name normalization ----
function normalizeModelName(raw) {
    if (!raw) return "Unknown";
    const m = raw.trim();
    // Single letter shorthand: "Y" → "Model Y", "3" → "Model 3"
    if (/^[YyXx3Ss]$/.test(m)) return `Model ${m.toUpperCase()}`;
    // "Model 3 Long Range AWD" → "Model 3"
    const match = m.match(/^(Model\s+[YyXx3Ss])\b/i);
    if (match) return match[1].replace(/model\s+/i, "Model ");
    return m;
}

// ---- Formatting helpers ----
function fmtCurrency(v) {
    if (v == null || isNaN(v)) return "—";
    return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(ratio) {
    if (ratio == null || isNaN(ratio)) return "—";
    return (ratio * 100).toFixed(1) + "%";
}

function utilizationBadge(ratio) {
    const pct = ratio * 100;
    let cls = "text-danger";
    if (pct >= 70) cls = "text-success fw-semibold";
    else if (pct >= 40) cls = "text-warning fw-semibold";
    return `<span class="${cls}">${fmtPct(ratio)}</span>`;
}

// ---- Fetch (once) and render ----
async function loadRentalAnalytics() {
    const ERR_COLS_MODEL   = 5;
    const ERR_COLS_MONTHLY = 4;

    function setLoadingError(msg) {
        const modelTbody   = document.getElementById("ra-model-tbody");
        const monthlyTbody = document.getElementById("ra-monthly-tbody");
        const errRow = (cols, text) =>
            `<tr><td colspan="${cols}" class="text-center text-danger py-3">${text}</td></tr>`;
        if (modelTbody)   modelTbody.innerHTML   = errRow(ERR_COLS_MODEL,   msg);
        if (monthlyTbody) monthlyTbody.innerHTML = errRow(ERR_COLS_MONTHLY, msg);
    }

    try {
        const res  = await fetch(`/api/management/analytics/rental-usage?window=12`);
        let json;
        try {
            json = await res.json();
        } catch (_) {
            setLoadingError(`Server error (HTTP ${res.status})`);
            return;
        }

        if (!json.success) {
            setLoadingError(json.message || "Failed to load analytics");
            return;
        }

        rentalAnalyticsData = json;
        renderRentalAnalytics(1);

    } catch (err) {
        setLoadingError("Network error — could not reach analytics API");
    }
}

function renderRentalAnalytics(period) {
    if (!rentalAnalyticsData) return;

    const { monthly, by_model } = rentalAnalyticsData;

    // Slice to the last `period` months
    const slicedMonthly = (monthly || []).slice(-period);

    // ---- Summary totals ----
    const totalRentDays  = slicedMonthly.reduce((s, m) => s + m.rent_days,      0);
    const totalAvailDays = slicedMonthly.reduce((s, m) => s + m.available_days,  0);
    const totalRevenue   = slicedMonthly.reduce((s, m) => s + (m.revenue || 0),  0);

    const utilRatio   = totalAvailDays > 0 ? totalRentDays  / totalAvailDays : null;
    const revPerDay   = totalAvailDays > 0 ? totalRevenue   / totalAvailDays : null;

    document.getElementById("ra-rent-days").textContent    = totalRentDays;
    document.getElementById("ra-available-days").textContent = totalAvailDays;
    document.getElementById("ra-utilization").textContent  = utilRatio != null ? fmtPct(utilRatio) : "—";
    document.getElementById("ra-revenue").textContent      = fmtCurrency(totalRevenue);
    document.getElementById("ra-rev-per-day").textContent  = revPerDay != null ? fmtCurrency(revPerDay) : "—";

    // ---- Build set of included YYYY-MM keys ----
    const includedKeys = new Set(
        slicedMonthly.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`)
    );

    // ---- Aggregate by_model for selected period ----
    const modelTotals = {};
    (by_model || []).forEach(r => {
        const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
        if (!includedKeys.has(key)) return;
        const label = normalizeModelName(r.model);
        if (!modelTotals[label]) {
            modelTotals[label] = { rent_days: 0, available_days: 0, revenue: 0 };
        }
        modelTotals[label].rent_days      += r.rent_days;
        modelTotals[label].available_days += r.available_days;
        modelTotals[label].revenue        += (r.revenue || 0);
    });

    // ---- Model summary table (sorted by utilization desc) ----
    const modelTbody = document.getElementById("ra-model-tbody");
    const modelRows = Object.entries(modelTotals).sort((a, b) => {
        const uA = a[1].available_days > 0 ? a[1].rent_days / a[1].available_days : 0;
        const uB = b[1].available_days > 0 ? b[1].rent_days / b[1].available_days : 0;
        return uB - uA;
    });

    if (modelRows.length === 0) {
        modelTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No data</td></tr>`;
    } else {
        modelTbody.innerHTML = modelRows.map(([model, v]) => {
            const util   = v.available_days > 0 ? v.rent_days / v.available_days : null;
            const rpd    = v.available_days > 0 ? v.revenue   / v.available_days : null;
            return `<tr>
                <td>${model}</td>
                <td class="text-end">${v.rent_days}</td>
                <td class="text-end">${util != null ? utilizationBadge(util) : "—"}</td>
                <td class="text-end">${fmtCurrency(v.revenue)}</td>
                <td class="text-end">${rpd != null ? fmtCurrency(rpd) : "—"}</td>
            </tr>`;
        }).join("");
    }

    // ---- Monthly summary table (newest first) ----
    const monthlyTbody = document.getElementById("ra-monthly-tbody");
    if (slicedMonthly.length === 0) {
        monthlyTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No data</td></tr>`;
    } else {
        monthlyTbody.innerHTML = [...slicedMonthly].reverse().map(m => {
            const label = `${m.year}-${String(m.month).padStart(2, '0')}`;
            const util  = m.available_days > 0 ? m.rent_days / m.available_days : null;
            return `<tr>
                <td>${label}</td>
                <td class="text-end">${m.rent_days}</td>
                <td class="text-end">${util != null ? utilizationBadge(util) : "—"}</td>
                <td class="text-end">${fmtCurrency(m.revenue)}</td>
            </tr>`;
        }).join("");
    }
}