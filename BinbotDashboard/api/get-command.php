<?php
// ============================================================
//  get-command.php
//  ESP32-S3 polls this endpoint every ~1 second.
//  Returns any pending command, then marks it as executed.
//  Method: GET
//  URL: http://YOUR_PC_IP/BinbotDashboard/api/get-command.php
//
//  UPDATED v2.3.0:
//  - Added 'source' field → 'manual' or 'auto'
//    manual = dashboard button → hold open until explicit close
//    auto   = programmatic     → open 0.5s, hold 5s, auto-close
//  - Added field validation before returning command
//  - Safe fallback: missing 'source' defaults to 'manual'
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$cmdFile = __DIR__ . '/pending_command.json';

// ── No pending command file ───────────────────────────────────
if (!file_exists($cmdFile)) {
    echo json_encode(['success' => true, 'has_command' => false]);
    exit;
}

$raw = file_get_contents($cmdFile);
$cmd = json_decode($raw, true);

// ── File is empty, malformed, or already executed ─────────────
if (!$cmd || ($cmd['executed'] ?? false) === true) {
    echo json_encode(['success' => true, 'has_command' => false]);
    exit;
}

// ── Commands expire after 10 seconds ──────────────────────────
//    Prevents stale commands firing if ESP32 was offline
if ((time() - ($cmd['unix_time'] ?? 0)) > 10) {
    $cmd['executed'] = true;
    $cmd['expired']  = true;
    file_put_contents($cmdFile, json_encode($cmd, JSON_PRETTY_PRINT));
    echo json_encode([
        'success'     => true,
        'has_command' => false,
        'note'        => 'Command expired'
    ]);
    exit;
}

// ── Validate fields before sending to ESP32 ───────────────────
$validActions      = ['open_lid', 'close_lid', 'set_threshold'];
$validCompartments = ['bio', 'nonbio'];
$validSources      = ['manual', 'auto'];

$action      = $cmd['action']      ?? '';
$compartment = $cmd['compartment'] ?? '';
$source      = $cmd['source']      ?? 'manual'; // default to manual if not set by sender

if (!in_array($action, $validActions)) {
    $cmd['executed'] = true;
    $cmd['error']    = 'Invalid action: ' . $action;
    file_put_contents($cmdFile, json_encode($cmd, JSON_PRETTY_PRINT));
    echo json_encode([
        'success'     => false,
        'has_command' => false,
        'error'       => 'Invalid action'
    ]);
    exit;
}

if ($action !== 'set_threshold' && !in_array($compartment, $validCompartments)) {
    $cmd['executed'] = true;
    $cmd['error']    = 'Invalid compartment: ' . $compartment;
    file_put_contents($cmdFile, json_encode($cmd, JSON_PRETTY_PRINT));
    echo json_encode([
        'success'     => false,
        'has_command' => false,
        'error'       => 'Invalid compartment'
    ]);
    exit;
}

// If source is unrecognized, fall back to manual for safety
if (!in_array($source, $validSources)) {
    $source = 'manual';
}

// ── Return the command to ESP32-S3 ────────────────────────────
echo json_encode([
    'success'     => true,
    'has_command' => true,
    'command'     => [
        'id'          => $cmd['id']    ?? null,
        'action'      => $action,
        'compartment' => $compartment,
        'source'      => $source,       // 'manual' → hold open until close command
                                        // 'auto'   → open 0.5s, hold 5s, auto-close
        'value'       => $cmd['value'] ?? null,  // for set_threshold only
    ],
]);

// ── Mark as executed so it's only sent once ───────────────────
$cmd['executed']    = true;
$cmd['executed_at'] = date('Y-m-d H:i:s');
file_put_contents($cmdFile, json_encode($cmd, JSON_PRETTY_PRINT));
?>