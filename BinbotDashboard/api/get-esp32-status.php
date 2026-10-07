<?php
// ============================================================
//  get-esp32-status.php
//  Returns ESP32-S3 online/offline status + system info.
//  Called by the dashboard/admin JS for the connection badge.
//
//  Source: Firebase RTDB binbot/sensors (last_seen freshness).
// ============================================================

require __DIR__ . '/firebase.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$sensors = fb_get('binbot/sensors');

if (!is_array($sensors) || empty($sensors)) {
    echo json_encode([
        'success'              => true,
        'online'               => false,
        'seconds_since_update' => 9999,
        'message'              => isset($GLOBALS['fb_last_error'])
            ? 'Firebase error: ' . $GLOBALS['fb_last_error']
            : 'No data received yet',
    ]);
    exit;
}

$lastSeenMs = is_numeric($sensors['last_seen'] ?? null) ? (int) $sensors['last_seen'] : 0;
$age        = $lastSeenMs > 0 ? max(0, time() - intdiv($lastSeenMs, 1000)) : 9999;
$online     = $age < 8; // Consider offline if no update in 8 seconds

echo json_encode([
    'success'              => true,
    'online'               => $online,
    'seconds_since_update' => $age,
    'last_seen'            => $lastSeenMs > 0 ? date('Y-m-d H:i:s', intdiv($lastSeenMs, 1000)) : '',
    'system'               => [
        'wifi_rssi'  => intval($sensors['rssi']      ?? 0),
        'ip_address' => strval($sensors['ip']        ?? ''),
        'uptime_ms'  => intval($sensors['uptime_ms'] ?? 0),
        'firmware'   => strval($sensors['firmware']  ?? 'v2.1.0'),
        'free_heap'  => intval($sensors['free_heap'] ?? 0),
    ],
]);
?>
