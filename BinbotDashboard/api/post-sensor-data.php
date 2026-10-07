<?php
// ============================================================
//  post-sensor-data.php
//  Receives sensor data POST from ESP32-S3 and saves to JSON
//  URL: http://YOUR_PC_IP/BinbotDashboard/api/post-sensor-data.php
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'POST required']);
    exit;
}

// ── Data file path (same folder as API) ─────────────────────
$dataFile = __DIR__ . '/sensor_data.json';

// ── Read raw POST body ────────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

// ── Build the record ─────────────────────────────────────────
$record = [
    'timestamp'         => date('Y-m-d H:i:s'),
    'unix_time'         => time(),
    'sensors'           => [
        'ultrasonic'    => [
            'bio'       => [
                'distance_cm'  => floatval($data['ultra_bio_cm']   ?? 0),
                'fill_level'   => intval($data['fill_bio']         ?? 0),
            ],
            'nonbio'    => [
                'distance_cm'  => floatval($data['ultra_nonbio_cm'] ?? 0),
                'fill_level'   => intval($data['fill_nonbio']       ?? 0),
            ],
        ],
        'gas'           => [
            'bio'       => [
                'raw'           => intval($data['gas_bio_raw']     ?? 0),
                'level_percent' => intval($data['gas_bio_pct']     ?? 0),
            ],
            'nonbio'    => [
                'raw'           => intval($data['gas_nonbio_raw']  ?? 0),
                'level_percent' => intval($data['gas_nonbio_pct']  ?? 0),
            ],
        ],
    ],
    'lids'              => [
        'bio_open'      => boolval($data['lid_bio_open']    ?? false),
        'nonbio_open'   => boolval($data['lid_nonbio_open'] ?? false),
    ],
    'system'            => [
        'wifi_rssi'     => intval($data['rssi']         ?? 0),
        'ip_address'    => strval($data['ip']            ?? ''),
        'uptime_ms'     => intval($data['uptime_ms']    ?? 0),
        'firmware'      => strval($data['firmware']      ?? 'v2.1.0'),
        'free_heap'     => intval($data['free_heap']    ?? 0),
    ],
];

// ── Save to JSON file ────────────────────────────────────────
if (file_put_contents($dataFile, json_encode($record, JSON_PRETTY_PRINT)) === false) {
    echo json_encode(['success' => false, 'message' => 'Failed to write data file']);
    exit;
}

// ── Also append to daily chart log ───────────────────────────
$chartFile = __DIR__ . '/chart_log.json';
$chartLog  = [];
if (file_exists($chartFile)) {
    $chartLog = json_decode(file_get_contents($chartFile), true) ?? [];
}

$today = date('Y-m-d');
// Update or insert today's entry with latest fill values
$found = false;
foreach ($chartLog as &$entry) {
    if ($entry['date'] === $today) {
        // Keep highest fill reading of the day
        $entry['bio_fill']    = max($entry['bio_fill'],    $record['sensors']['ultrasonic']['bio']['fill_level']);
        $entry['nonbio_fill'] = max($entry['nonbio_fill'], $record['sensors']['ultrasonic']['nonbio']['fill_level']);
        $entry['hazard_fill'] = 0; // No hazard sensor in current hardware
        $entry['updated']     = $record['timestamp'];
        $found = true;
        break;
    }
}
unset($entry);

if (!$found) {
    $chartLog[] = [
        'date'         => $today,
        'bio_fill'     => $record['sensors']['ultrasonic']['bio']['fill_level'],
        'nonbio_fill'  => $record['sensors']['ultrasonic']['nonbio']['fill_level'],
        'hazard_fill'  => 0,
        'updated'      => $record['timestamp'],
    ];
}

// Keep only last 30 days
if (count($chartLog) > 30) {
    $chartLog = array_slice($chartLog, -30);
}
file_put_contents($chartFile, json_encode($chartLog, JSON_PRETTY_PRINT));

echo json_encode([
    'success'   => true,
    'message'   => 'Data saved',
    'timestamp' => $record['timestamp'],
]);
?>
