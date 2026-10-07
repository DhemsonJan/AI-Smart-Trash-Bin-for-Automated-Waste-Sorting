<?php
// ============================================================
//  get-sensor-data.php
//  Returns latest sensor data to the dashboard/admin JavaScript
//  Your JS already calls:  CONFIG.API_BASE + 'get-sensor-data.php'
//
//  Source: Firebase RTDB binbot/sensors (written by ESP32-S3).
//  Response shape unchanged so admin-enhanced.js keeps working.
// ============================================================

require __DIR__ . '/firebase.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$sensors = fb_get('binbot/sensors');

if (!is_array($sensors) || empty($sensors)) {
    echo json_encode(isset($GLOBALS['fb_last_error'])
        ? ['success' => false, 'message' => 'Firebase error: ' . $GLOBALS['fb_last_error']]
        : ['success' => false, 'message' => 'No sensor data yet — waiting for ESP32-S3']);
    exit;
}

// ── Freshness (last_seen is a server timestamp in milliseconds) ──
$lastSeenMs = is_numeric($sensors['last_seen'] ?? null) ? (int) $sensors['last_seen'] : 0;
$unixTime   = $lastSeenMs > 0 ? intdiv($lastSeenMs, 1000) : 0;
$ageSeconds = $unixTime > 0 ? max(0, time() - $unixTime) : 99999;
$isFresh    = $ageSeconds < 10;

// ── Reshape the flat Firebase record into the nested shape ──────
$record = [
    'timestamp' => $unixTime > 0 ? date('Y-m-d H:i:s', $unixTime) : '',
    'unix_time' => $unixTime,
    'sensors'   => [
        'ultrasonic' => [
            'bio' => [
                'distance_cm' => floatval($sensors['ultra_bio_cm']    ?? 0),
                'fill_level'  => intval($sensors['fill_bio']          ?? 0),
            ],
            'nonbio' => [
                'distance_cm' => floatval($sensors['ultra_nonbio_cm'] ?? 0),
                'fill_level'  => intval($sensors['fill_nonbio']       ?? 0),
            ],
        ],
        'gas' => [
            'bio' => [
                'raw'           => intval($sensors['gas_bio_raw']     ?? 0),
                'level_percent' => intval($sensors['gas_bio_pct']     ?? 0),
            ],
            'nonbio' => [
                'raw'           => intval($sensors['gas_nonbio_raw']  ?? 0),
                'level_percent' => intval($sensors['gas_nonbio_pct']  ?? 0),
            ],
        ],
    ],
    'lids' => [
        'bio_open'    => boolval($sensors['lid_bio_open']    ?? false),
        'nonbio_open' => boolval($sensors['lid_nonbio_open'] ?? false),
    ],
    'system' => [
        'wifi_rssi'  => intval($sensors['rssi']      ?? 0),
        'ip_address' => strval($sensors['ip']        ?? ''),
        'uptime_ms'  => intval($sensors['uptime_ms'] ?? 0),
        'firmware'   => strval($sensors['firmware']  ?? 'v2.1.0'),
        'free_heap'  => intval($sensors['free_heap'] ?? 0),
    ],
];

echo json_encode([
    'success'     => true,
    'fresh'       => $isFresh,
    'age_seconds' => $ageSeconds,
    'data'        => $record,
]);
?>
