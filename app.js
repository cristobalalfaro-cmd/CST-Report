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
  const processed = processRows(filtered, allRows);
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

function processRows(rows, allData) {
  // Use allData for global counts, rows for filtered counts
  const sourceRows = allData || rows;
  
  // 1. Total Employees in Nobel Biocare Sales Teams: Active OR Active - No plan (column EMPLOYEE STATUS)
  // This counts from ALL data, not filtered
  const totalSalesTeam = sourceRows.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    return status === "active" || status === "active - no plan";
  }).length;

  // 2. Employees considered in CST: Only "Active" status (column EMPLOYEE STATUS)
  // This counts from ALL data, not filtered
  const employeesInCST = sourceRows.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    return status === "active";
  }).length;

  // 3. CST Completed: Has a date in ACTUAL column
  const cstCompleted = rows.filter((r) => {
    const actual = (r["ACTUAL"] || "").toString().trim();
    return actual !== "";
  }).length;

  // 4. CST Pending: Has PLAN date but ACTUAL is empty
  const cstPending = rows.filter((r) => {
    const plan = (r["PLAN"] || "").toString().trim();
    const actual = (r["ACTUAL"] || "").toString().trim();
    return plan !== "" && actual === "";
  }).length;

  const mscCompleted = rows.filter((r) => !!r["MSC"]).length;

  const cstPct = employeesInCST ? (cstCompleted / employeesInCST) * 100 : 0;
  const mscPct = employeesInCST ? (mscCompleted / employeesInCST) * 100 : 0;

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
    totalSalesTeam,
    employeesInCST,
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
  document.getElementById("totalSalesTeam").textContent =
    data.totalSalesTeam.toString();
  document.getElementById("employeesInCST").textContent =
    data.employeesInCST.toString();
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
    data.employeesInCST
  );
  renderGauge(
    "mscGauge",
    "mscGaugeLabel",
    data.mscPct,
    data.mscCompleted,
    data.employeesInCST
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

let leafletMap;
let geoJsonLayer;
let labelMarkers = [];

function renderMap(countries) {
  const mapDiv = document.getElementById("map");

  if (!leafletMap) {
    leafletMap = L.map(mapDiv, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([52.0, 10.0], 4);
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 8,
      minZoom: 3,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(leafletMap);
  }

  if (geoJsonLayer) {
    leafletMap.removeLayer(geoJsonLayer);
  }
  labelMarkers.forEach(marker => leafletMap.removeLayer(marker));
  labelMarkers = [];

  const countryDataMap = new Map();
  countries.forEach(c => {
    const name = c.country;
    countryDataMap.set(name, c);
    
    if (name === "Czechia") {
      countryDataMap.set("Czech Republic", c);
    }
    if (name === "Czech Republic") {
      countryDataMap.set("Czechia", c);
    }
    if (name === "United Kingdom" || name === "UK") {
      countryDataMap.set("UK", c);
      countryDataMap.set("United Kingdom", c);
    }
    
    const alias = COUNTRY_NAME_ALIASES[name];
    if (alias) {
      countryDataMap.set(alias, c);
    }
  });

  geoJsonLayer = L.geoJSON(EUROPE_GEOJSON, {
    style: function(feature) {
      const countryName = feature.properties.name;
      const data = countryDataMap.get(countryName);
      
      if (data) {
        const color = pctToColor(data.pct || 0);
        return {
          fillColor: color,
          fillOpacity: 0.75,
          color: "#1a1a2e",
          weight: 1.5
        };
      } else {
        return {
          fillColor: "#374151",
          fillOpacity: 0.5,
          color: "#1a1a2e",
          weight: 1
        };
      }
    },
    onEachFeature: function(feature, layer) {
      const countryName = feature.properties.name;
      const data = countryDataMap.get(countryName);
      
      if (data) {
        const pctLabel = data.pct ? data.pct.toFixed(1) : "0.0";
        layer.bindPopup(
          `<strong>${data.country}</strong><br/>
           Completion: ${pctLabel}%<br/>
           ${data.completed} of ${data.total}`
        );
      }
    }
  }).addTo(leafletMap);

  countries.forEach(c => {
    let countryName = c.country;
    if (COUNTRY_NAME_ALIASES[countryName]) {
      countryName = COUNTRY_NAME_ALIASES[countryName];
    }
    
    const coords = COUNTRY_LABEL_COORDS[countryName] || COUNTRY_LABEL_COORDS[c.country];
    if (!coords) return;

    const displayName = getDisplayName(c.country);
    
    const labelIcon = L.divIcon({
      className: 'country-label',
      html: `<span>${displayName}</span>`,
      iconSize: [100, 20],
      iconAnchor: [50, 10]
    });

    const marker = L.marker(coords, {
      icon: labelIcon,
      interactive: false
    }).addTo(leafletMap);
    
    labelMarkers.push(marker);
  });
}

function getDisplayName(name) {
  const spanishNames = {
    "France": "Francia",
    "Germany": "Alemania",
    "Spain": "España",
    "Italy": "Italia",
    "Belgium": "Bélgica",
    "United Kingdom": "Reino Unido",
    "UK": "Reino Unido",
    "Poland": "Polonia",
    "Portugal": "Portugal",
    "Austria": "Austria",
    "Switzerland": "Suiza",
    "Netherlands": "Países Bajos",
    "Sweden": "Suecia",
    "Norway": "Noruega",
    "Denmark": "Dinamarca",
    "Finland": "Finlandia",
    "Ireland": "Irlanda",
    "Lithuania": "Lituania",
    "Hungary": "Hungría",
    "Czech Republic": "Rep. Checa",
    "Czechia": "Rep. Checa",
    "Greece": "Grecia",
    "Romania": "Rumanía",
    "Bulgaria": "Bulgaria",
    "Croatia": "Croacia",
    "Slovakia": "Eslovaquia",
    "Slovenia": "Eslovenia",
    "Latvia": "Letonia",
    "Estonia": "Estonia",
    "Serbia": "Serbia",
    "Ukraine": "Ucrania",
    "Belarus": "Bielorrusia",
    "Turkey": "Turquía",
    "Iceland": "Islandia"
  };
  return spanishNames[name] || name;
}

// Simple color scale: red -> yellow -> green
function pctToColor(pct) {
  if (pct <= 40) return "#ef4444"; // red
  if (pct <= 70) return "#facc15"; // yellow
  return "#22c55e"; // green
}
