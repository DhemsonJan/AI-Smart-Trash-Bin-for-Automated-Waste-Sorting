<?php
// ============================================================
//  get-chart-data.php
//  Returns last N days of fill-level readings for the trend chart
//  Your JS calls:  CONFIG.API_BASE + 'get-chart-data.php?days=30'
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$days      = intval($_GET['days'] ?? 30);
$chartFile = __DIR__ . '/chart_log.json';

if (!file_exists($chartFile)) {
    echo json_encode([
        'success' => false,
        'message' => 'No chart data yet — waiting for ESP32-S3',
    ]);
    exit;
}

$log = json_decode(file_get_contents($chartFile), true) ?? [];

// Take last N days
$log = array_slice($log, -$days);

if (empty($log)) {
    echo json_encode(['success' => false, 'message' => 'Empty chart log']);
    exit;
}

// ── Format for Chart.js ──────────────────────────────────────
$daily = [];
foreach ($log as $entry) {
    // Show short date label e.g. "Jun 10"
    $ts      = strtotime($entry['date']);
    $daily[] = [
        'day'          => date('M j', $ts),
        'bio_fill'     => intval($entry['bio_fill']),
        'nonbio_fill'  => intval($entry['nonbio_fill']),
        'hazard_fill'  => intval($entry['hazard_fill'] ?? 0),
    ];
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
    'success'        => true,
    'days_returned'  => count($daily),
    'data'           => ['daily_readings' => $daily],
    'stats'          => [
        'avg_fill'   => $avgFill,
        'peak_fill'  => $peakFill,
        'low_fill'   => $lowFill,
    ],
]);
?>
