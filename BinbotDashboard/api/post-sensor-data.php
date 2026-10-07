<?php
// ============================================================
//  post-sensor-data.php
//  Receives sensor data POST and saves it to Firebase
//  URL: https://YOUR-VERCEL-APP.vercel.app/BinbotDashboard/api/post-sensor-data.php
//
//  Normally the ESP32-S3 writes binbot/sensors directly (Firebase
//  SDK), so this endpoint is kept for bridges/legacy callers.
//  It writes the SAME flat fields the firmware writes, plus keeps
//  the daily chart history in binbot/chart/YYYY-MM-DD.
// ============================================================

require __DIR__ . '/firebase.php';

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

// ── Read raw POST body ────────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

// ── Flat record — exact same field names the firmware uses ────
$flat = [
    'ultra_bio_cm'    => floatval($data['ultra_bio_cm']    ?? 0),
    'ultra_nonbio_cm' => floatval($data['ultra_nonbio_cm'] ?? 0),
    'fill_bio'        => intval($data['fill_bio']          ?? 0),
    'fill_nonbio'     => intval($data['fill_nonbio']       ?? 0),
    'gas_bio_raw'     => intval($data['gas_bio_raw']       ?? 0),
    'gas_nonbio_raw'  => intval($data['gas_nonbio_raw']    ?? 0),
    'gas_bio_pct'     => intval($data['gas_bio_pct']       ?? 0),
    'gas_nonbio_pct'  => intval($data['gas_nonbio_pct']    ?? 0),
    'lid_bio_open'    => boolval($data['lid_bio_open']     ?? false),
    'lid_nonbio_open' => boolval($data['lid_nonbio_open']  ?? false),
    'rssi'            => intval($data['rssi']              ?? 0),
    'ip'              => strval($data['ip']                ?? ''),
    'uptime_ms'       => intval($data['uptime_ms']         ?? 0),
    'firmware'        => strval($data['firmware']          ?? 'v2.1.0'),
    'free_heap'       => intval($data['free_heap']         ?? 0),
    'last_seen'       => ['.sv' => 'timestamp'], // server-side timestamp — no clock sync needed
];

// ── Save latest sensor snapshot ───────────────────────────────
if (!fb_patch('binbot/sensors', $flat)) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to write sensor data — Firebase unreachable'
                     . (isset($GLOBALS['fb_last_error']) ? ' (' . $GLOBALS['fb_last_error'] . ')' : ''),
    ]);
    exit;
}

// ── Also update the daily chart entry (keep highest of the day) ─
$today   = date('Y-m-d');
$entry   = fb_get('binbot/chart/' . $today);
$entry   = is_array($entry) ? $entry : [];
$updated = [
    'date'         => $today,
    'bio_fill'     => max(intval($entry['bio_fill']    ?? 0), intval($data['fill_bio']    ?? 0)),
    'nonbio_fill'  => max(intval($entry['nonbio_fill'] ?? 0), intval($data['fill_nonbio'] ?? 0)),
    'hazard_fill'  => intval($entry['hazard_fill'] ?? 0), // No hazard sensor in current hardware
    'updated'      => date('Y-m-d H:i:s'),
];
fb_put('binbot/chart/' . $today, $updated);

// ── Keep only last 30 days ────────────────────────────────────
$chart = fb_get('binbot/chart');
if (is_array($chart) && count($chart) > 30) {
    ksort($chart);
    foreach (array_slice($chart, 0, count($chart) - 30, true) as $oldDate => $_) {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $oldDate)) {
            fb_delete('binbot/chart/' . $oldDate);
        }
    }
}

echo json_encode([
    'success'   => true,
    'message'   => 'Data saved',
    'timestamp' => date('Y-m-d H:i:s'),
]);
?>
