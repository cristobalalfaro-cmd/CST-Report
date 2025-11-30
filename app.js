let barChart;
let cstGaugeChart;
let mscGaugeChart;
let allRows = [];
let coachingRows = [];
let bowlerComputed = false;
let feedbackComputed = false;

document.addEventListener("DOMContentLoaded", () => {
  if (!API_URL) {
    console.error("API_URL is not defined. Please set it in config.js");
    return;
  }
  setupViewTabs();
  loadData();
});


function setupViewTabs() {
  const buttons = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;

      // Toggle button active state
      buttons.forEach((b) => b.classList.remove("nav-btn-active"));
      btn.classList.add("nav-btn-active");

      // Toggle views
      views.forEach((v) => {
        if (v.id === `view-${target}`) {
          v.classList.add("view-active");
        } else {
          v.classList.remove("view-active");
        }
      });

      // Lazy init for extra views
      if (target === "feedback" && !feedbackComputed) {
        loadCoachingData();
      }
      if (target === "bowler" && !bowlerComputed && allRows.length) {
        buildBowler(allRows);
      }
    });
  });
}

async function loadData() {
  try {
    const response = await fetch(API_URL);
    const json = await response.json();
    const rows = json.data || [];
    allRows = rows;

    initFilters(rows);
    applyFiltersAndRender();

    // Precompute bowler data if user opens that view later
    // (actual DOM update happens on first visit)
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

  // Clear all filters button
  document.getElementById("clearFiltersBtn").addEventListener("click", clearAllFilters);
}

function clearAllFilters() {
  document.getElementById("filterCountry").selectedIndex = 0;
  document.getElementById("filterBusinessTitle").selectedIndex = 0;
  document.getElementById("filterIsManager").selectedIndex = 0;
  document.getElementById("filterZone").selectedIndex = 0;
  document.getElementById("filterRegion").selectedIndex = 0;
  document.getElementById("filterEmployeeStatus").selectedIndex = 0;
  applyFiltersAndRender();
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
  // Use filtered rows for all calculations so indicators reflect filter selections
  
  // 1. Total Employees in Nobel Biocare Sales Teams: Active OR Active - No plan (column EMPLOYEE STATUS)
  const totalSalesTeam = rows.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    return status === "active" || status === "active - no plan";
  }).length;

  // 2. Employees considered in CST: Only "Active" status (column EMPLOYEE STATUS)
  const employeesInCST = rows.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    return status === "active";
  }).length;

  // 3. CST Completed: "Active" employees with a date in ACTUAL column
  const cstCompleted = rows.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    const actual = (r["ACTUAL"] || "").toString().trim();
    return status === "active" && actual !== "";
  }).length;

  // 4. CST Pending: "Active" employees with ACTUAL empty
  const cstPending = rows.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    const actual = (r["ACTUAL"] || "").toString().trim();
    return status === "active" && actual === "";
  }).length;

  // MSC Completed: Is Manager = "Yes" AND MSC has a date
  const mscCompleted = rows.filter((r) => {
    const isManager = (r["Is Manager"] || "").toString().trim().toLowerCase();
    const msc = (r["MSC"] || "").toString().trim();
    return isManager === "yes" && msc !== "";
  }).length;
  
  // Total managers for MSC percentage
  const totalManagers = rows.filter((r) => {
    const isManager = (r["Is Manager"] || "").toString().trim().toLowerCase();
    return isManager === "yes";
  }).length;

  const cstPct = employeesInCST ? (cstCompleted / employeesInCST) * 100 : 0;
  const mscPct = totalManagers ? (mscCompleted / totalManagers) * 100 : 0;

  // Aggregate by country - using Employees in CST (Active) vs CST Completed
  const countryMap = new Map();

  rows.forEach((r) => {
    const country = (r["Country"] || "").toString().trim();
    if (!country) return;
    
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    const actual = (r["ACTUAL"] || "").toString().trim();
    
    // Only count Active employees (those considered in CST)
    if (status !== "active") return;

    if (!countryMap.has(country)) {
      countryMap.set(country, { country, total: 0, completed: 0 });
    }
    const entry = countryMap.get(country);
    entry.total += 1;
    if (actual !== "") {
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
    totalManagers,
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
    data.totalManagers
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
      labels: ["Red", "Orange", "Yellow", "Green"],
      datasets: [
        {
          data: [25, 25, 25, 25],
          borderWidth: 0,
          backgroundColor: ["#dc2626", "#f97316", "#facc15", "#22c55e"],
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
    plugins: [{
      id: 'gaugeNeedle',
      afterDatasetDraw(chart) {
        const { ctx, chartArea } = chart;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = chartArea.bottom;
        const outerRadius = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        
        const angle = Math.PI + (clamped / 100) * Math.PI;
        const needleLength = outerRadius * 0.28;
        const baseOffsetY = -65;
        
        ctx.save();
        ctx.translate(centerX, centerY + baseOffsetY);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(needleLength, 0);
        ctx.lineTo(0, 3);
        ctx.fillStyle = "#1f2937";
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#1f2937";
        ctx.fill();
        
        ctx.restore();
      }
    }]
  });

  if (canvasId === "cstGauge") {
    cstGaugeChart = chart;
  } else {
    mscGaugeChart = chart;
  }

  const labelEl = document.getElementById(labelId);
  labelEl.innerHTML = `<span class="gauge-number">${completed}</span><span class="gauge-percent">${clamped.toFixed(1)}%</span>`;
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


// ===== Managers Feedback View =====

async function loadCoachingData() {
  try {
    const url = API_URL.includes("?")
      ? API_URL + "&sheet=coaching"
      : API_URL + "?sheet=coaching";

    const response = await fetch(url);
    const json = await response.json();
    coachingRows = json.data || [];

    const kpis = computeFeedbackKpis(coachingRows);
    renderFeedbackKpis(kpis);
    feedbackComputed = true;
  } catch (err) {
    console.error("Error loading coaching data:", err);
  }
}

function computeFeedbackKpis(rows) {
  const countries = new Set();
  const managerEmails = new Set();
  const employeeEmails = new Set();

  rows.forEach((r) => {
    const country = (r["country"] || r["Country"] || "").toString().trim();
    if (country) countries.add(country);

    const managerEmail = (r["Managers email"] || r["Manager Email"] || "").toString().trim();
    if (managerEmail) managerEmails.add(managerEmail);

    const evalEmail = (r["Evaluated email"] || r["Evaluated Email"] || "").toString().trim();
    if (evalEmail) employeeEmails.add(evalEmail);
  });

  return {
    feedbackCountries: countries.size,
    managersUsingForms: managerEmails.size,
    employeesWithFeedback: employeeEmails.size,
  };
}

function renderFeedbackKpis(kpis) {
  document.getElementById("fbCountries").textContent =
    kpis.feedbackCountries.toString();
  document.getElementById("fbManagers").textContent =
    kpis.managersUsingForms.toString();
  document.getElementById("fbEmployees").textContent =
    kpis.employeesWithFeedback.toString();
}

// ===== Bowler View =====

const BOWLER_MONTH_KEYS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
];

// PY row: keep values as in existing reference (adjust these numbers as needed)
const BOWLER_PY_2025 = {
  Jan: 0,
  Feb: 0,
  Mar: 0,
  Apr: 1,
  May: 0,
  Jun: 0,
  Jul: 7,
  Aug: 0,
  Sep: 0,
  Oct: 1,
  Nov: 0,
  Dec: 8,
};

function buildBowler(rows) {
  const pdCounts = {};
  const actCounts = {};
  BOWLER_MONTH_KEYS.forEach((m) => {
    pdCounts[m] = 0;
    actCounts[m] = 0;
  });

  rows.forEach((r) => {
    const planRaw = r["PLAN"];
    const actualRaw = r["ACTUAL"];

    if (planRaw) {
      const d = new Date(planRaw);
      if (!isNaN(d.getTime()) && d.getFullYear() === 2025) {
        const key = BOWLER_MONTH_KEYS[d.getMonth()];
        if (key) pdCounts[key] += 1;
      }
    }

    if (actualRaw) {
      const d2 = new Date(actualRaw);
      if (!isNaN(d2.getTime()) && d2.getFullYear() === 2025) {
        const key2 = BOWLER_MONTH_KEYS[d2.getMonth()];
        if (key2) actCounts[key2] += 1;
      }
    }
  });

  // Write into table
  BOWLER_MONTH_KEYS.forEach((m) => {
    const pyCell = document.getElementById(`bowler-py-${m}`);
    const pdCell = document.getElementById(`bowler-pd-${m}`);
    const actCell = document.getElementById(`bowler-act-${m}`);

    if (pyCell) pyCell.textContent = BOWLER_PY_2025[m] || "";
    if (pdCell) pdCell.textContent = pdCounts[m] ? pdCounts[m].toString() : "";
    if (actCell) actCell.textContent = actCounts[m] ? actCounts[m].toString() : "";
  });

  bowlerComputed = true;
}

