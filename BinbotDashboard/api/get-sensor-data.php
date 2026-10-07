<?php
// ============================================================
//  get-sensor-data.php
//  Returns latest sensor data to the dashboard JavaScript
//  Your JS already calls:  CONFIG.API_BASE + 'get-sensor-data.php'
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$dataFile = __DIR__ . '/sensor_data.json';

if (!file_exists($dataFile)) {
    echo json_encode([
        'success' => false,
        'message' => 'No sensor data yet — waiting for ESP32-S3',
    ]);
    exit;
}

$raw  = file_get_contents($dataFile);
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Corrupt data file']);
    exit;
}

// ── Freshness check (warn if data is older than 10 s) ────────
$ageSeconds = time() - ($data['unix_time'] ?? 0);
$isFresh    = $ageSeconds < 10;

echo json_encode([
    'success'     => true,
    'fresh'       => $isFresh,
    'age_seconds' => $ageSeconds,
    'data'        => $data,
]);
?>
