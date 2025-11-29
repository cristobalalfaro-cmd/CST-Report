/**
 * Nobel CST Dashboard API
 *
 * Web App that exposes data from the Google Sheet as JSON.
 * Deploy as Web App and use the resulting URL in config.js (API_URL).
 */

const SHEET_NAME = "Hoja1"; // TODO: change to your sheet name if different

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Sheet not found: " + SHEET_NAME })
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
