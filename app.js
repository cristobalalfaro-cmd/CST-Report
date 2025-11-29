let barChart;
let cstGaugeChart;
let mscGaugeChart;
let allRows = [];

document.addEventListener("DOMContentLoaded", () => {
  if (!API_URL) {
    console.error("API_URL is not defined. Please set it in config.js");
    return;
  }
  loadData();
});

async function loadData() {
  try {
    const response = await fetch(API_URL);
    const json = await response.json();
    const rows = json.data || [];
    allRows = rows;

    initFilters(rows);
    applyFiltersAndRender();
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

// Initialize filter dropdowns with unique values
function initFilters(rows) {
  const getUniqueSorted = (field) => {
    const set = new Set();
    rows.forEach((r) => {
      const val = (r[field] ?? "").toString().trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  populateSelect("filterCountry", getUniqueSorted("Country"), "All countries");
  populateSelect(
    "filterBusinessTitle",
    getUniqueSorted("Business Title"),
    "All titles"
  );
  populateSelect("filterIsManager", getUniqueSorted("Is Manager"), "All");
  populateSelect("filterZone", getUniqueSorted("Zone"), "All zones");
  populateSelect("filterRegion", getUniqueSorted("Region"), "All regions");

  // Employee Status: include even if empty & set default to "Active" if exists
  const employeeStatuses = getUniqueSorted("EMPLOYEE STATUS");
  populateSelect("filterEmployeeStatus", employeeStatuses, "All statuses");

  const statusSelect = document.getElementById("filterEmployeeStatus");
  const activeIndex = Array.from(statusSelect.options).findIndex(
    (opt) => opt.value.toLowerCase() === "active"
  );
  if (activeIndex > 0) {
    statusSelect.selectedIndex = activeIndex;
  }

  // Add change listeners
  [
    "filterCountry",
    "filterBusinessTitle",
    "filterIsManager",
    "filterZone",
    "filterRegion",
    "filterEmployeeStatus",
  ].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("change", applyFiltersAndRender);
  });
}

function populateSelect(id, values, allLabel) {
  const select = document.getElementById(id);
  select.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "__ALL__";
  optAll.textContent = allLabel;
  select.appendChild(optAll);

  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function applyFiltersAndRender() {
  const filtered = filterRows(allRows);
  const processed = processRows(filtered);
  renderDashboard(processed);
}

function filterRows(rows) {
  const country = document.getElementById("filterCountry").value;
  const businessTitle = document.getElementById("filterBusinessTitle").value;
  const isManager = document.getElementById("filterIsManager").value;
  const zone = document.getElementById("filterZone").value;
  const region = document.getElementById("filterRegion").value;
  const employeeStatus =
    document.getElementById("filterEmployeeStatus").value;

  return rows.filter((r) => {
    const match = (fieldVal, filterVal) => {
      if (filterVal === "__ALL__") return true;
      return (fieldVal ?? "").toString().trim() === filterVal;
    };

    return (
      match(r["Country"], country) &&
      match(r["Business Title"], businessTitle) &&
      match(r["Is Manager"], isManager) &&
      match(r["Zone"], zone) &&
      match(r["Region"], region) &&
      match(r["EMPLOYEE STATUS"], employeeStatus)
    );
  });
}

function processRows(rows) {
  const totalEmployees = rows.length;

  const cstCompleted = rows.filter((r) => !!r["ACTUAL"]).length;
  const cstPending = totalEmployees - cstCompleted;
  const mscCompleted = rows.filter((r) => !!r["MSC"]).length;

  const cstPct = totalEmployees ? (cstCompleted / totalEmployees) * 100 : 0;
  const mscPct = totalEmployees ? (mscCompleted / totalEmployees) * 100 : 0;

  // Aggregate by country
  const countryMap = new Map();

  rows.forEach((r) => {
    const country = (r["Country"] || "").toString().trim();
    if (!country) return;

    if (!countryMap.has(country)) {
      countryMap.set(country, { country, total: 0, completed: 0 });
    }
    const entry = countryMap.get(country);
    entry.total += 1;
    if (r["ACTUAL"]) {
      entry.completed += 1;
    }
  });

  const countries = Array.from(countryMap.values()).sort(
    (a, b) => b.total - a.total
  );

  countries.forEach((c) => {
    c.pct = c.total ? (c.completed / c.total) * 100 : 0;
  });

  return {
    totalEmployees,
    cstCompleted,
    cstPending,
    mscCompleted,
    cstPct,
    mscPct,
    countries,
  };
}

function renderDashboard(data) {
  // Update tiles
  document.getElementById("employeesTotal").textContent =
    data.totalEmployees.toString();
  document.getElementById("cstCompleted").textContent =
    data.cstCompleted.toString();
  document.getElementById("cstPending").textContent =
    data.cstPending.toString();

  // Gauges
  renderGauge(
    "cstGauge",
    "cstGaugeLabel",
    data.cstPct,
    data.cstCompleted,
    data.totalEmployees
  );
  renderGauge(
    "mscGauge",
    "mscGaugeLabel",
    data.mscPct,
    data.mscCompleted,
    data.totalEmployees
  );

  // Bar chart
  renderBarChart(data.countries);

  // Map
  renderMap(data.countries);
}

function renderGauge(canvasId, labelId, pct, completed, total) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  if (canvasId === "cstGauge" && cstGaugeChart) {
    cstGaugeChart.destroy();
  }
  if (canvasId === "mscGauge" && mscGaugeChart) {
    mscGaugeChart.destroy();
  }

  const clamped = Math.max(0, Math.min(100, pct || 0));

  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Remaining"],
      datasets: [
        {
          data: [clamped, 100 - clamped],
          borderWidth: 0,
          backgroundColor: ["#b91c1c", "#e5e7eb"],
          circumference: 180,
          rotation: 270,
          cutout: "70%",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
    },
  });

  if (canvasId === "cstGauge") {
    cstGaugeChart = chart;
  } else {
    mscGaugeChart = chart;
  }

  const labelEl = document.getElementById(labelId);
  const pctText =
    total > 0 ? `${completed} | ${clamped.toFixed(1)}%` : "0 | 0.0%";
  labelEl.textContent = pctText;
}

// Bar chart
function renderBarChart(countries) {
  const ctx = document
    .getElementById("countryBarChart")
    .getContext("2d");

  if (barChart) {
    barChart.destroy();
  }

  const labels = countries.map((c) => c.country);
  const totals = countries.map((c) => c.total);
  const completed = countries.map((c) => c.completed);

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Employees",
          data: totals,
          backgroundColor: "#06b6d4",
        },
        {
          label: "Completed CST",
          data: completed,
          backgroundColor: "#4b5563",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            font: {
              size: 10,
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  });
}

// Simple coordinates for European countries (center approx)
const COUNTRY_COORDS = {
  France: [46.2276, 2.2137],
  Germany: [51.1657, 10.4515],
  Spain: [40.4637, -3.7492],
  Italy: [41.8719, 12.5674],
  Belgium: [50.8503, 4.3517],
  "United Kingdom": [55.3781, -3.436],
  UK: [55.3781, -3.436],
  Poland: [51.9194, 19.1451],
  Portugal: [39.3999, -8.2245],
  Austria: [47.5162, 14.5501],
  Switzerland: [46.8182, 8.2275],
  Netherlands: [52.1326, 5.2913],
  Sweden: [60.1282, 18.6435],
  Norway: [60.472, 8.4689],
  Denmark: [56.2639, 9.5018],
  Finland: [61.9241, 25.7482],
  Ireland: [53.1424, -7.6921],
  Lithuania: [55.1694, 23.8813],
  Hungary: [47.1625, 19.5033],
};

let leafletMap;

function renderMap(countries) {
  const mapDiv = document.getElementById("map");

  if (!leafletMap) {
    leafletMap = L.map(mapDiv).setView([54.526, 15.2551], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 8,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(leafletMap);
  }

  // Clear existing layers except base
  leafletMap.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) {
      leafletMap.removeLayer(layer);
    }
  });

  countries.forEach((c) => {
    const coords = COUNTRY_COORDS[c.country];
    if (!coords) return;

    const color = pctToColor(c.pct || 0);

    const marker = L.circleMarker(coords, {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1,
    });

    const pctLabel = c.pct ? c.pct.toFixed(1) : "0.0";

    marker.bindPopup(
      `<strong>${c.country}</strong><br/>
       Completion: ${pctLabel}%<br/>
       ${c.completed} of ${c.total}`
    );

    marker.addTo(leafletMap);
  });
}

// Simple color scale: red -> yellow -> green
function pctToColor(pct) {
  if (pct <= 40) return "#ef4444"; // red
  if (pct <= 70) return "#facc15"; // yellow
  return "#22c55e"; // green
}
