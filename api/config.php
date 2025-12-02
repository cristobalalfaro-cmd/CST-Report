<?php
// api/config.php
// Configuration for CST secure proxy.

define('CST_APPSCRIPT_URL', 'https://script.google.com/macros/s/REEMPLAZA_AQUI_TU_WEBAPP/exec');

// Shared secret used between this PHP proxy and your Apps Script.
// You MUST copy this same value into SHARED_SECRET in Code.gs.
define('CST_SHARED_SECRET', '115829439ca22b990e1efd181c0cb99f758880c900bacd4c');

// Allowed Origin for browser requests (your production domain).
define('CST_ALLOWED_ORIGIN', 'https://csp-nobel.com');
?>
