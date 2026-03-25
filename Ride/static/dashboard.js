let financeChart;
let rentalUtilizationChart;
let rentalRentDaysChart;
let rentalModelChart;

document.addEventListener("DOMContentLoaded", () => {

    loadFinanceSeries();
    loadRentalAnalytics();

    const switchEl = document.getElementById("dashboardModeSwitch");
    const windowSelect = document.getElementById("financeWindowSelect");
    const rentalWindowSelect = document.getElementById("rentalWindowSelect");

    if (switchEl) {
        switchEl.addEventListener("change", loadFinanceSeries);
    }

    if (windowSelect) {
        windowSelect.addEventListener("change", loadFinanceSeries);
    }

    if (rentalWindowSelect) {
        rentalWindowSelect.addEventListener("change", loadRentalAnalytics);
    }
});

async function loadFinanceSeries(){

    const switchEl = document.getElementById("dashboardModeSwitch");
    const mode = switchEl && switchEl.checked ? "full" : "operation";

    const windowSelect = document.getElementById("financeWindowSelect");
    const windowSize = windowSelect ? parseInt(windowSelect.value) : 12;

    const res = await fetch(
        `/api/finance/timeseries?window=${windowSize}&mode=${mode}`
    );

    const json = await res.json();
    if(!json.success) return;

    const normalized = normalizeFinanceSeries(json.data, windowSize);

    renderFinanceBarChart(
        normalized.labels,
        normalized.revenue,
        normalized.expense,
        normalized.net
    );
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

// ---- Fetch and dispatch ----
async function loadRentalAnalytics() {
    const windowSelect = document.getElementById("rentalWindowSelect");
    const windowSize = windowSelect ? parseInt(windowSelect.value) : 12;

    const res = await fetch(`/api/management/analytics/rental-usage?window=${windowSize}`);
    const json = await res.json();
    if (!json.success) return;

    const labels = generateLastMonths(windowSize); // reuse existing helper

    const monthlyNorm = normalizeRentalMonthly(json.monthly, labels);
    const utilization = monthlyNorm.map(m => parseFloat((m.utilization * 100).toFixed(2)));
    const rentDays    = monthlyNorm.map(m => m.rent_days);

    renderRentalUtilizationChart(labels, utilization);
    renderRentalRentDaysChart(labels, rentDays);
    renderRentalModelChart(labels, json.by_model);
}

// ---- Normalize monthly array: fill missing months with 0 ----
function normalizeRentalMonthly(monthly, labels) {
    // Build a map from "YYYY-MM" to the monthly entry
    const map = {};
    (monthly || []).forEach(m => {
        const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
        map[key] = m;
    });

    return labels.map(label => {
        const entry = map[label];
        return {
            rent_days:      entry ? entry.rent_days      : 0,
            available_days: entry ? entry.available_days : 0,
            utilization:    entry ? entry.utilization    : 0,
        };
    });
}

// ---- Chart 1: Monthly Utilization (line) ----
function renderRentalUtilizationChart(labels, utilization) {
    const canvas = document.getElementById("rental-utilization-chart");
    if (!canvas) return;

    if (rentalUtilizationChart) rentalUtilizationChart.destroy();

    rentalUtilizationChart = new Chart(canvas.getContext("2d"), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Utilization %',
                data: utilization,
                borderColor: 'rgba(23, 162, 184, 1)',
                backgroundColor: 'rgba(23, 162, 184, 0.15)',
                borderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: v => `${v}%`
                    }
                }
            }
        }
    });
}

// ---- Chart 2: Monthly Rent Days (bar) ----
function renderRentalRentDaysChart(labels, rentDays) {
    const canvas = document.getElementById("rental-rent-days-chart");
    if (!canvas) return;

    if (rentalRentDaysChart) rentalRentDaysChart.destroy();

    rentalRentDaysChart = new Chart(canvas.getContext("2d"), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Rent Days',
                data: rentDays,
                backgroundColor: 'rgba(40, 167, 69, 0.7)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: ctx => `Rent Days: ${ctx.raw}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => `${v}d`
                    }
                }
            }
        }
    });
}

// ---- Chart 3: Monthly Rent Days by Model (stacked bar) ----
// Rent days are additive per model, so stacking is correct and meaningful.
function renderRentalModelChart(labels, byModel) {
    const canvas = document.getElementById("rental-model-chart");
    if (!canvas) return;

    if (rentalModelChart) rentalModelChart.destroy();

    // Extract unique models, sorted for stable output
    const models = [...new Set((byModel || []).map(r => r.model))].sort();

    // Build a lookup: "YYYY-MM|model" → rent_days
    const lookup = {};
    (byModel || []).forEach(r => {
        const key = `${r.year}-${String(r.month).padStart(2, '0')}|${r.model}`;
        lookup[key] = r.rent_days;
    });

    const palette = [
        'rgba(54,  162, 235, 0.75)',
        'rgba(255, 159,  64, 0.75)',
        'rgba(153, 102, 255, 0.75)',
        'rgba(255, 205,  86, 0.75)',
        'rgba(75,  192, 192, 0.75)',
        'rgba(255,  99, 132, 0.75)',
        'rgba(201, 203, 207, 0.75)',
    ];

    const datasets = models.map((model, i) => ({
        label: model,
        data: labels.map(label => lookup[`${label}|${model}`] ?? 0),
        backgroundColor: palette[i % palette.length],
        stack: 'models'   // stacks all models into one bar per month
    }));

    rentalModelChart = new Chart(canvas.getContext("2d"), {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw}d`
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: v => `${v}d`
                    }
                }
            }
        }
    });
}