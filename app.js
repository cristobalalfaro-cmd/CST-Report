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
  
  // Get current filter values (except Employee Status) to apply to allData for Total Employees
  const country = document.getElementById("filterCountry").value;
  const businessTitle = document.getElementById("filterBusinessTitle").value;
  const isManager = document.getElementById("filterIsManager").value;
  const zone = document.getElementById("filterZone").value;
  const region = document.getElementById("filterRegion").value;
  
  // 1. Total Employees in Nobel Biocare Sales Teams: Active OR Active - No plan
  // This KPI ignores Employee Status filter to always show both Active and Active - No Plan
  const totalSalesTeam = allData.filter((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    const isActiveOrNoPlan = status === "active" || status === "active - no plan";
    if (!isActiveOrNoPlan) return false;
    
    // Apply other filters
    const match = (fieldVal, filterVal) => {
      if (filterVal === "__ALL__") return true;
      return (fieldVal ?? "").toString().trim() === filterVal;
    };
    
    return (
      match(r["Country"], country) &&
      match(r["Business Title"], businessTitle) &&
      match(r["Is Manager"], isManager) &&
      match(r["Zone"], zone) &&
      match(r["Region"], region)
    );
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
          cutout: "60%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
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
        const { ctx, chartArea, width, height } = chart;
        const centerX = width / 2;
        const centerY = height - 10;
        const radius = Math.min(width, height * 2) / 2 - 10;
        
        const angle = Math.PI + (clamped / 100) * Math.PI;
        const needleLength = radius * 0.85;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(needleLength, 0);
        ctx.lineTo(0, 6);
        ctx.fillStyle = "#1f2937";
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
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

// Color scale for CST Report map: 25% intervals (red -> orange -> yellow -> green)
function pctToColor(pct) {
  if (pct <= 25) return "#dc2626"; // red
  if (pct <= 50) return "#f97316"; // orange
  if (pct <= 75) return "#facc15"; // yellow
  return "#22c55e"; // green
}

// Color scale for Managers Feedback map: custom intervals
function pctToColorFeedback(pct) {
  if (pct === 0) return "#dc2626"; // red (0%)
  if (pct <= 30) return "#f97316"; // orange (1-30%)
  if (pct <= 80) return "#facc15"; // yellow (31-80%)
  return "#22c55e"; // green (over 80%)
}


// ===== Managers Feedback View =====

let feedbackFilterInitialized = false;

async function loadCoachingData() {
  try {
    const url = API_URL.includes("?")
      ? API_URL + "&sheet=coaching"
      : API_URL + "?sheet=coaching";

    const response = await fetch(url);
    const json = await response.json();
    coachingRows = json.data || [];

    // Initialize feedback country filter from Hoja1 data (allRows)
    if (!feedbackFilterInitialized && allRows.length) {
      initFeedbackFilters();
      feedbackFilterInitialized = true;
    }

    applyFeedbackFiltersAndRender();
    feedbackComputed = true;
  } catch (err) {
    console.error("Error loading coaching data:", err);
  }
}

function initFeedbackFilters() {
  // Get unique countries from Hoja1 (column K = "Country")
  const countries = new Set();
  allRows.forEach((r) => {
    const country = (r["Country"] || "").toString().trim();
    if (country) countries.add(country);
  });
  
  const sortedCountries = Array.from(countries).sort((a, b) => a.localeCompare(b));
  populateSelect("filterFeedbackCountry", sortedCountries, "All countries");

  // Add change listener
  document.getElementById("filterFeedbackCountry").addEventListener("change", applyFeedbackFiltersAndRender);

  // Clear filter button
  document.getElementById("clearFeedbackFiltersBtn").addEventListener("click", () => {
    document.getElementById("filterFeedbackCountry").selectedIndex = 0;
    applyFeedbackFiltersAndRender();
  });
}

function applyFeedbackFiltersAndRender() {
  const selectedCountry = document.getElementById("filterFeedbackCountry").value;
  
  // Filter Hoja1 rows by selected country
  let filteredHoja1 = allRows;
  if (selectedCountry !== "__ALL__") {
    filteredHoja1 = allRows.filter((r) => {
      const country = (r["Country"] || "").toString().trim();
      return country === selectedCountry;
    });
  }

  const kpis = computeFeedbackKpis(coachingRows, filteredHoja1);
  renderFeedbackKpis(kpis);
}

function computeFeedbackKpis(coachingData, hoja1Data) {
  // N° Employees Considered in CST (same as CST Report - status === "active")
  let employeesInCST = 0;
  hoja1Data.forEach((r) => {
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    if (status === "active") employeesInCST++;
  });

  // N° Managers (count where "Is Manager" = "Yes" AND status === "active")
  let totalManagers = 0;
  hoja1Data.forEach((r) => {
    const isManager = (r["Is Manager"] || "").toString().trim().toLowerCase();
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    if (isManager === "yes" && status === "active") totalManagers++;
  });

  // Build a map of Hoja1 emails to their info (isManager, country, status)
  const hoja1EmailMap = new Map();
  hoja1Data.forEach((r) => {
    const workEmail = (r["Work Email Address"] || "").toString().trim().toLowerCase();
    const isManager = (r["Is Manager"] || "").toString().trim().toLowerCase();
    const country = (r["Country"] || "").toString().trim();
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    if (workEmail) {
      hoja1EmailMap.set(workEmail, { isManager: isManager === "yes", country, status });
    }
  });

  // Get ALL unique emails from Coaching Forms (both Manager email and Evaluated email)
  const allCoachingEmails = new Set();
  coachingData.forEach((r) => {
    const managerEmail = (r["Manager email"] || "").toString().trim().toLowerCase();
    const evaluatedEmail = (r["Evaluated email"] || "").toString().trim().toLowerCase();
    if (managerEmail) allCoachingEmails.add(managerEmail);
    if (evaluatedEmail) allCoachingEmails.add(evaluatedEmail);
  });

  // N° Feedbacks = Count all occurrences of emails in Coaching Forms
  // that exist in Hoja1 and do NOT have "Is Manager" = "Yes"
  let totalFeedbacks = 0;
  coachingData.forEach((r) => {
    const managerEmail = (r["Manager email"] || "").toString().trim().toLowerCase();
    const evaluatedEmail = (r["Evaluated email"] || "").toString().trim().toLowerCase();
    
    // Count Manager email if exists in Hoja1 and is NOT a manager
    if (managerEmail && hoja1EmailMap.has(managerEmail) && !hoja1EmailMap.get(managerEmail).isManager) {
      totalFeedbacks++;
    }
    // Count Evaluated email if exists in Hoja1 and is NOT a manager
    if (evaluatedEmail && hoja1EmailMap.has(evaluatedEmail) && !hoja1EmailMap.get(evaluatedEmail).isManager) {
      totalFeedbacks++;
    }
  });

  // N° of Managers doing CST Coaching
  // Check if each coaching email exists in Hoja1 and has "Is Manager" = "Yes"
  const managersDoingCoaching = new Set();
  allCoachingEmails.forEach((email) => {
    if (hoja1EmailMap.has(email) && hoja1EmailMap.get(email).isManager === true) {
      managersDoingCoaching.add(email);
    }
  });

  // N° of Employees w/CST Feedback (unique count)
  // Check if each coaching email exists in Hoja1 and does NOT have "Is Manager" = "Yes"
  const employeesWithFeedback = new Set();
  allCoachingEmails.forEach((email) => {
    if (hoja1EmailMap.has(email) && hoja1EmailMap.get(email).isManager === false) {
      employeesWithFeedback.add(email);
    }
  });

  // 4. Calculate by country for map
  // Get all non-manager active employees by country from Hoja1
  const countryTotalNonManagers = new Map();
  const countryEmployeesWithFeedback = new Map();
  
  hoja1Data.forEach((r) => {
    const workEmail = (r["Work Email Address"] || "").toString().trim().toLowerCase();
    const isManager = (r["Is Manager"] || "").toString().trim().toLowerCase();
    const country = (r["Country"] || "").toString().trim();
    const status = (r["EMPLOYEE STATUS"] || "").toString().trim().toLowerCase();
    
    // Only count non-managers with Active status
    if (isManager !== "yes" && status === "active" && country) {
      countryTotalNonManagers.set(country, (countryTotalNonManagers.get(country) || 0) + 1);
      
      // Check if this employee has feedback
      if (allCoachingEmails.has(workEmail)) {
        countryEmployeesWithFeedback.set(country, (countryEmployeesWithFeedback.get(country) || 0) + 1);
      }
    }
  });

  // Build countries array for map
  const countries = [];
  countryTotalNonManagers.forEach((total, country) => {
    const withFeedback = countryEmployeesWithFeedback.get(country) || 0;
    const pct = total > 0 ? (withFeedback / total) * 100 : 0;
    countries.push({
      country,
      total,
      completed: withFeedback,
      pct
    });
  });

  // Calculate overall percentage
  let totalNonManagers = 0;
  let totalWithFeedback = 0;
  countryTotalNonManagers.forEach((val) => totalNonManagers += val);
  countryEmployeesWithFeedback.forEach((val) => totalWithFeedback += val);
  const overallPct = totalNonManagers > 0 ? (totalWithFeedback / totalNonManagers) * 100 : 0;

  return {
    employeesInCST: employeesInCST,
    totalManagers: totalManagers,
    totalFeedbacks: totalFeedbacks,
    managersDoingCoaching: managersDoingCoaching.size,
    employeesWithFeedback: employeesWithFeedback.size,
    countries: countries,
    overallPct: overallPct,
    totalNonManagers: totalNonManagers,
    totalWithFeedback: totalWithFeedback
  };
}

let feedbackGaugeChart;
let feedbackMap;
let feedbackGeoJsonLayer;
let feedbackLabelMarkers = [];

function renderFeedbackKpis(kpis) {
  document.getElementById("fbEmployeesInCST").textContent =
    kpis.employeesInCST.toString();
  document.getElementById("fbTotalManagers").textContent =
    kpis.totalManagers.toString();
  document.getElementById("fbFeedbacks").textContent =
    kpis.totalFeedbacks.toString();
  document.getElementById("fbManagers").textContent =
    kpis.managersDoingCoaching.toString();
  document.getElementById("fbEmployees").textContent =
    kpis.employeesWithFeedback.toString();

  renderFeedbackGauge(kpis.overallPct);
  renderFeedbackMap(kpis.countries);
}

function renderFeedbackGauge(pct) {
  const canvas = document.getElementById("feedbackGauge");
  const ctx = canvas.getContext("2d");
  const labelEl = document.getElementById("feedbackGaugeLabel");
  
  const clamped = Math.max(0, Math.min(100, pct || 0));
  labelEl.textContent = clamped.toFixed(1) + "%";

  if (feedbackGaugeChart) {
    feedbackGaugeChart.destroy();
  }

  feedbackGaugeChart = new Chart(ctx, {
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
          cutout: "60%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [{
      id: 'feedbackGaugeNeedle',
      afterDatasetDraw(chart) {
        const { ctx, width, height } = chart;
        const centerX = width / 2;
        const centerY = height - 10;
        const radius = Math.min(width, height * 2) / 2 - 10;
        
        const angle = Math.PI + (clamped / 100) * Math.PI;
        const needleLength = radius * 0.85;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(needleLength, 0);
        ctx.lineTo(0, 6);
        ctx.fillStyle = "#1f2937";
        ctx.fill();
        
        ctx.restore();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#1f2937";
        ctx.fill();
      }
    }]
  });
}

function renderFeedbackMap(countries) {
  const mapDiv = document.getElementById("feedbackMap");

  if (!feedbackMap) {
    feedbackMap = L.map(mapDiv, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([52.0, 10.0], 4);
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 8,
      minZoom: 3,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(feedbackMap);
  }

  if (feedbackGeoJsonLayer) {
    feedbackMap.removeLayer(feedbackGeoJsonLayer);
  }
  feedbackLabelMarkers.forEach(marker => feedbackMap.removeLayer(marker));
  feedbackLabelMarkers = [];

  const countryDataMap = new Map();
  countries.forEach(c => {
    const name = c.country;
    countryDataMap.set(name, c);
    
    if (name === "Czechia") countryDataMap.set("Czech Republic", c);
    if (name === "Czech Republic") countryDataMap.set("Czechia", c);
    if (name === "United Kingdom" || name === "UK") {
      countryDataMap.set("UK", c);
      countryDataMap.set("United Kingdom", c);
    }
    
    const alias = COUNTRY_NAME_ALIASES[name];
    if (alias) countryDataMap.set(alias, c);
  });

  feedbackGeoJsonLayer = L.geoJSON(EUROPE_GEOJSON, {
    style: function(feature) {
      const countryName = feature.properties.name;
      const data = countryDataMap.get(countryName);
      
      if (data) {
        const color = pctToColorFeedback(data.pct || 0);
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
           % w/Feedback: ${pctLabel}%<br/>
           ${data.completed} of ${data.total} employees`
        );
      }
    }
  }).addTo(feedbackMap);

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
    }).addTo(feedbackMap);
    
    feedbackLabelMarkers.push(marker);
  });

  setTimeout(() => {
    feedbackMap.invalidateSize();
  }, 100);
}

// ===== Bowler View =====

const BOWLER_MONTH_KEYS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
];

let bowlerFilterInitialized = false;

function initBowlerFilters() {
  const countries = new Set();
  allRows.forEach((r) => {
    const country = (r["Country"] || "").toString().trim();
    if (country) countries.add(country);
  });
  
  const sortedCountries = Array.from(countries).sort((a, b) => a.localeCompare(b));
  populateSelect("filterBowlerCountry", sortedCountries, "All countries");

  document.getElementById("filterBowlerCountry").addEventListener("change", applyBowlerFiltersAndRender);

  document.getElementById("clearBowlerFiltersBtn").addEventListener("click", () => {
    document.getElementById("filterBowlerCountry").selectedIndex = 0;
    applyBowlerFiltersAndRender();
  });
}

function applyBowlerFiltersAndRender() {
  const selectedCountry = document.getElementById("filterBowlerCountry").value;
  
  let filteredRows = allRows;
  if (selectedCountry !== "__ALL__") {
    filteredRows = allRows.filter((r) => {
      const country = (r["Country"] || "").toString().trim();
      return country === selectedCountry;
    });
  }

  buildBowler(filteredRows);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  if (!str) return null;
  
  // Try ISO format (2025-11-11T00:00:00.000Z)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1]),
      month: parseInt(isoMatch[2]) - 1 // 0-indexed
    };
  }
  
  // Fallback to Date object
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  
  return null;
}

function buildBowler(rows) {
  if (!bowlerFilterInitialized && allRows.length) {
    initBowlerFilters();
    bowlerFilterInitialized = true;
  }

  const pyCounts = {};
  const pdCounts = {};
  const actCounts = {};
  BOWLER_MONTH_KEYS.forEach((m) => {
    pyCounts[m] = 0;
    pdCounts[m] = 0;
    actCounts[m] = 0;
  });

  rows.forEach((r) => {
    const planRaw = r["PLAN"];
    const actualRaw = r["ACTUAL"];

    const planDate = parseDate(planRaw);
    if (planDate) {
      if (planDate.year === 2024) {
        const key = BOWLER_MONTH_KEYS[planDate.month];
        if (key) pyCounts[key] += 1;
      } else if (planDate.year === 2025) {
        const key = BOWLER_MONTH_KEYS[planDate.month];
        if (key) pdCounts[key] += 1;
      }
    }

    const actualDate = parseDate(actualRaw);
    if (actualDate && actualDate.year === 2025) {
      const key2 = BOWLER_MONTH_KEYS[actualDate.month];
      if (key2) actCounts[key2] += 1;
    }
  });

  // Write into table
  BOWLER_MONTH_KEYS.forEach((m) => {
    const pyCell = document.getElementById(`bowler-py-${m}`);
    if (pyCell) pyCell.textContent = pyCounts[m] || "-";
    
    const pdCell = document.getElementById(`bowler-pd-${m}`);
    const actCell = document.getElementById(`bowler-act-${m}`);
    const pctCell = document.getElementById(`bowler-pct-${m}`);

    const pd = pdCounts[m] || 0;
    const act = actCounts[m] || 0;
    const pct = pd > 0 ? ((act / pd) * 100).toFixed(0) : "-";

    if (pdCell) pdCell.textContent = pd > 0 ? pd.toString() : "";
    if (actCell) actCell.textContent = act > 0 ? act.toString() : "";
    if (pctCell) pctCell.textContent = pd > 0 ? pct + "%" : "";
  });

  bowlerComputed = true;
}

