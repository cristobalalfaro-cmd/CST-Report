<?php
// api/cst.php
// Secure PHP proxy that forwards requests to the private Apps Script Web App.
// This hides the real Apps Script URL and adds a shared secret.

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// CORS: only allow your own domain in browser calls
if (isset($_SERVER['HTTP_ORIGIN'])) {
    if ($_SERVER['HTTP_ORIGIN'] === CST_ALLOWED_ORIGIN) {
        header('Access-Control-Allow-Origin: ' . CST_ALLOWED_ORIGIN);
        header('Vary: Origin');
    } else {
        // If you prefer, you can echo an error here.
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['error' => 'Origin not allowed']);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Preflight for CORS
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    exit;
}

// Optional client API key check (basic abuse protection)
$clientKey = isset($_GET['apiKey']) ? $_GET['apiKey'] : null;
// If you decide to use CLIENT_API_KEY in the frontend, you can enforce it here.
// Example:
// if ($clientKey !== 'cst_front_001') {
//     http_response_code(403);
//     echo json_encode(['error' => 'Invalid client API key']);
//     exit;
// }

// Build query string to forward to Apps Script, preserving parameters like ?sheet=coaching
$params = $_GET;
unset($params['apiKey']); // remove client key if used
$params['token'] = CST_SHARED_SECRET;

$query = http_build_query($params);
$url = CST_APPSCRIPT_URL . '?' . $query;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($result === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Error calling Apps Script', 'details' => $err]);
    exit;
}

// Pass-through status code if you want; for now we just return 200 with body.
echo $result;
