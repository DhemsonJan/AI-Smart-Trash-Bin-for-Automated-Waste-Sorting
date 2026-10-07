<?php
// ============================================================
//  get-chart-data.php
//  Returns last N days of fill-level readings for the trend chart
//  Your JS calls:  CONFIG.API_BASE + 'get-chart-data.php?days=30'
//
//  Source: Firebase RTDB binbot/chart (daily entries written by
//  the ESP32-S3, keyed by YYYY-MM-DD). Response shape unchanged.
// ============================================================

require __DIR__ . '/firebase.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$days = intval($_GET['days'] ?? 30);
if ($days < 1) {
    $days = 30;
}

$chart = fb_get('binbot/chart');

if (!is_array($chart) || empty($chart)) {
    echo json_encode(isset($GLOBALS['fb_last_error'])
        ? ['success' => false, 'message' => 'Firebase error: ' . $GLOBALS['fb_last_error']]
        : ['success' => false, 'message' => 'No chart data yet — waiting for ESP32-S3']);
    exit;
}

// Entries are keyed by date — sort ascending, take last N days
ksort($chart);
$entries = array_slice(array_values($chart), -$days);

// ── Format for Chart.js ──────────────────────────────────────
$daily = [];
foreach ($entries as $entry) {
    if (empty($entry['date'])) {
        continue;
    }
    $ts = strtotime($entry['date']);
    if ($ts === false) {
        continue;
    }
    $daily[] = [
        'day'         => date('M j', $ts),
        'bio_fill'    => intval($entry['bio_fill']    ?? 0),
        'nonbio_fill' => intval($entry['nonbio_fill'] ?? 0),
        'hazard_fill' => intval($entry['hazard_fill'] ?? 0),
    ];
}

if (empty($daily)) {
    echo json_encode(['success' => false, 'message' => 'Empty chart log']);
    exit;
}

// ── Stats ────────────────────────────────────────────────────
$allFills = array_merge(
    array_column($daily, 'bio_fill'),
    array_column($daily, 'nonbio_fill')
);
$avgFill  = count($allFills) ? round(array_sum($allFills) / count($allFills)) : 0;
$peakFill = count($allFills) ? max($allFills) : 0;
$lowFill  = count($allFills) ? min($allFills) : 0;

echo json_encode([
    'success'       => true,
    'days_returned' => count($daily),
    'data'          => ['daily_readings' => $daily],
    'stats'         => [
        'avg_fill'  => $avgFill,
        'peak_fill' => $peakFill,
        'low_fill'  => $lowFill,
    ],
]);
?>
