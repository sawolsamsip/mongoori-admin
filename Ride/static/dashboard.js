let financeChart;

document.addEventListener("DOMContentLoaded", () => {

    loadFinanceSeries();

    const switchEl = document.getElementById("dashboardModeSwitch");
    const windowSelect = document.getElementById("financeWindowSelect");

    if (switchEl) {
        switchEl.addEventListener("change", loadFinanceSeries);
    }

    if (windowSelect) {
        windowSelect.addEventListener("change", loadFinanceSeries);
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