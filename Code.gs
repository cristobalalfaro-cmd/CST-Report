/**
 * Nobel CST Dashboard API
 *
 * Web App that exposes data from the Google Sheet as JSON.
 * Deploy as Web App and use the resulting URL in config.js (API_URL).
 */

// Main CST data sheet and Coaching Forms sheet
const SHEETS = {
  cst: "Hoja1",            // main CST dataset
  coaching: "Coaching Forms", // managers feedback forms
};

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Default to CST sheet; allow ?sheet=coaching or ?sheet=<sheetName>
  let sheetName = SHEETS.cst;
  if (e && e.parameter && e.parameter.sheet) {
    const key = e.parameter.sheet;
    if (SHEETS[key]) {
      sheetName = SHEETS[key];
    } else {
      // If a direct sheet name is passed, try to use it
      sheetName = key;
    }
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Sheet not found: " + sheetName })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values || values.length < 2) {
    return ContentService.createTextOutput(
      JSON.stringify({ data: [] })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const headers = values[0];
  const data = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    // Skip completely empty rows
    if (row.join("").toString().trim() === "") continue;

    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx];
    });
    data.push(obj);
  }

  const output = JSON.stringify({ data: data });
  return ContentService.createTextOutput(output).setMimeType(
    ContentService.MimeType.JSON
  );
}
