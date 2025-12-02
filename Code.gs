/**
 * Nobel CST Dashboard API (secured with shared secret).
 *
 * This Web App is called ONLY from your PHP proxy on csp-nobel.com.
 * It requires a 'token' parameter that must match SHARED_SECRET.
 */

const SHEETS = {
  cst: "Hoja1",             // main CST dataset
  coaching: "Coaching Forms", // managers feedback forms
};

// MUST match CST_SHARED_SECRET in api/config.php
const SHARED_SECRET = "115829439ca22b990e1efd181c0cb99f758880c900bacd4c";

function doGet(e) {
  // Basic auth via shared secret
  if (!e || !e.parameter || e.parameter.token !== SHARED_SECRET) {
    const out = JSON.stringify({ error: "Unauthorized" });
    return ContentService.createTextOutput(out).setMimeType(
      ContentService.MimeType.JSON
    );
  }

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
    const errOut = JSON.stringify({ error: "Sheet not found: " + sheetName });
    return ContentService.createTextOutput(errOut).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values || values.length < 2) {
    const emptyOut = JSON.stringify({ data: [] });
    return ContentService.createTextOutput(emptyOut).setMimeType(
      ContentService.MimeType.JSON
    );
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
