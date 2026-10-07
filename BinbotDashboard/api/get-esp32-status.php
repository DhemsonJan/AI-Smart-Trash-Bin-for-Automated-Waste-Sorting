<?php
// ============================================================
//  get-esp32-status.php
//  Returns ESP32-S3 online/offline status + system info.
//  Called by your dashboard JS for the connection badge.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$dataFile = __DIR__ . '/sensor_data.json';

if (!file_exists($dataFile)) {
    echo json_encode([
        'success'              => true,
        'online'               => false,
        'seconds_since_update' => 9999,
        'message'              => 'No data received yet',
    ]);
    exit;
}

$data = json_decode(file_get_contents($dataFile), true);
if (!$data) {
    echo json_encode(['success' => false, 'online' => false, 'message' => 'Corrupt data']);
    exit;
}

$age    = time() - ($data['unix_time'] ?? 0);
$online = $age < 8; // Consider offline if no update in 8 seconds

echo json_encode([
    'success'              => true,
    'online'               => $online,
    'seconds_since_update' => $age,
    'last_seen'            => $data['timestamp'] ?? '',
    'system'               => $data['system']    ?? [],
]);
?>
