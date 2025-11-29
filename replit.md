# Nobel Biocare CST Dashboard

## Overview
This is a static web dashboard for tracking CST (Customer Service Training) completion data for Nobel Biocare employees. The dashboard provides:
- Employee CST completion statistics and metrics
- Interactive filters by country, business title, manager status, zone, region, and employee status
- Visual analytics including gauge charts, bar charts, and an interactive map
- Real-time data fetched from a Google Apps Script API endpoint

## Project Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Charts**: Chart.js for gauge and bar charts
- **Maps**: Leaflet.js for geographic visualization
- **Data Source**: Google Apps Script Web App (deployed separately)
- **Development Server**: Python HTTP server on port 5000
- **Deployment**: Static site (all files served directly)

### File Structure
- `index.html` - Main dashboard page with filters and visualization containers
- `app.js` - Core application logic for data fetching, filtering, and rendering
- `styles.css` - All styling with responsive design breakpoints
- `config.js` - Configuration file containing the Google Apps Script API URL
- `logo.png` - Nobel Biocare official logo image
- `countries-geo.js` - GeoJSON data for European country boundaries
- `server.py` - Development HTTP server with cache control headers
- `Code.gs` - Reference Google Apps Script backend (runs on Google, not Replit)

### Key Features
1. **Filters**: 6 filter dropdowns for data segmentation
2. **Summary Tiles**: Total employees, completed CST, and pending CST counts
3. **Gauge Charts**: Visual representation of CST and MSC completion percentages
4. **Bar Chart**: CST completion by country comparison
5. **Interactive Map**: Geographic visualization with color-coded completion rates

### Data Flow
1. On page load, `app.js` fetches employee data from the Google Apps Script API
2. Data is processed and filters are initialized with unique values
3. Default filter applied: "Active" employee status
4. User interactions with filters trigger re-rendering of all visualizations
5. All charts and map update dynamically based on filtered data

## Development

### Running Locally
The workflow "Nobel CST Dashboard" automatically runs:
```bash
python server.py
```

This starts a development server on `0.0.0.0:5000` with cache control headers to prevent browser caching issues.

### Configuration
The API endpoint is configured in `config.js`:
```javascript
const API_URL = "https://script.google.com/macros/s/.../exec";
```

### Google Apps Script Backend
The `Code.gs` file contains the Google Apps Script code that:
- Reads data from a Google Sheet named "Hoja1"
- Converts sheet data to JSON format
- Exposes it via a web endpoint

This script runs on Google's infrastructure, not on Replit.

## Deployment
Configured as a **static deployment** - all HTML, CSS, and JavaScript files are served directly. The site connects to the external Google Apps Script API for data.

## Recent Changes
- **2025-11-29**: Filter-responsive indicators and map improvements
  - Indicators now reflect filtered data (when filtering by country, all metrics update accordingly)
  - Gauge needle base repositioned above the numbers to prevent overlap
  - Updated GeoJSON to Natural Earth 50m resolution for accurate country boundaries
  - Tile styling: centered content, larger text (16px labels, 56px numbers), white labels, cyan numbers
  - Reduced tile height to 155px for more compact display

- **2025-11-29**: Header and layout updates
  - Updated logo to official Nobel Biocare logo image
  - Changed title to "Consultative Sales Training Dashboard" (centered)
  - Optimized layout to fit on one screen without scrolling
  - Reduced padding, margins, and heights for compact display
  - Used flexbox with 100vh for viewport-height layout

- **2025-11-29**: Map visualization upgrade
  - Changed map from circle markers to choropleth (filled country polygons)
  - Added country name labels in Spanish displayed on the map
  - Switched to CartoDB dark tile layer for better contrast
  - Added GeoJSON data for European countries in `countries-geo.js`
  - Colors based on CST completion: red (<=40%), yellow (<=70%), green (>70%)

- **2025-11-29**: Initial Replit setup
  - Added Python HTTP server for development
  - Configured workflow for port 5000 with webview output
  - Set up static deployment configuration
  - Created documentation

## User Preferences
None specified yet.
