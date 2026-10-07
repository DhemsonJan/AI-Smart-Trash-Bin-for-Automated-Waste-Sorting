<?php
// ============================================================
//  send-command.php
//  Dashboard/Admin JS POSTs a command here (open/close lid, threshold)
//  ESP32-S3 polls binbot/command in Firebase to pick it up
//  Your JS already calls:  CONFIG.API_BASE + 'send-command.php'
//
//  UPDATED for Vercel:
//  - Writes to Firebase RTDB binbot/command (same node the
//    dashboard's sendCommandToESP32() writes and the ESP32 reads)
//  - Same validation + pending-command protection as before
//
//  - Added 'source' field support → 'manual' (default) or 'auto'
//    manual = dashboard button → ESP32 holds open until close command
//    auto   = programmatic     → ESP32 does open + 5s standby + auto-close
//  - Compartment validation (only 'bio' or 'nonbio' accepted)
//  - Rejects requests while a command is still pending/unexecuted
// ============================================================

require __DIR__ . '/firebase.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'POST required']);
    exit;
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || empty($body['action'])) {
    echo json_encode(['success' => false, 'message' => 'Missing action field']);
    exit;
}

// ── Allowed values ────────────────────────────────────────────
$validActions      = ['open_lid', 'close_lid', 'set_threshold'];
$validCompartments = ['bio', 'nonbio'];
$validSources      = ['manual', 'auto'];

$action      = $body['action']       ?? '';
$compartment = $body['compartment']  ?? '';
$source      = $body['source']       ?? 'manual'; // default to manual if JS doesn't send it

if (!in_array($action, $validActions)) {
    echo json_encode(['success' => false, 'message' => 'Unknown action: ' . $action]);
    exit;
}

// Compartment required for lid actions
if ($action !== 'set_threshold' && !in_array($compartment, $validCompartments)) {
    echo json_encode(['success' => false, 'message' => 'Invalid compartment — must be bio or nonbio']);
    exit;
}

// Sanitize source — unknown value falls back to manual for safety
if (!in_array($source, $validSources)) {
    $source = 'manual';
}

// ── Prevent overwriting a command the ESP32 hasn't picked up yet ──
$existing = fb_get('binbot/command');

if (is_array($existing) && ($existing['pending'] ?? false) === true) {
    // Age: prefer unix_time (seconds), fall back to created_at (ms)
    $createdUnix = is_numeric($existing['unix_time'] ?? null)
        ? (int) $existing['unix_time']
        : (is_numeric($existing['created_at'] ?? null)
            ? (int) floor($existing['created_at'] / 1000)
            : 0);
    $age = $createdUnix > 0 ? time() - $createdUnix : 9999;

    if ($age <= 10) {
        // Still within the 10s window — previous command not yet picked up
        echo json_encode([
            'success'            => false,
            'message'            => 'A command is already pending. Wait for ESP32 to pick it up (within 1s).',
            'pending_command_id' => $existing['id'] ?? null,
        ]);
        exit;
    }
    // Older than 10s — safe to overwrite (ESP32 was offline, command stale)
}

// ── Build command record (same shape Binbot.js writes) ────────
$command = [
    'id'          => uniqid('cmd_', true),
    'action'      => $action,
    'compartment' => $compartment,
    'source'      => $source,        // 'manual' → ESP32 holds open until close command
                                     // 'auto'   → ESP32 opens, waits 5s, auto-closes
    'value'       => $body['value'] ?? null,  // for set_threshold only
    'pending'     => true,
    'created_at'  => (int) round(microtime(true) * 1000), // ms, same as Date.now() in JS
    'unix_time'   => time(),
];

// ── Write to Firebase command queue (one pending at a time) ───
if (!fb_put('binbot/command', $command)) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to queue command — Firebase unreachable'
                     . (isset($GLOBALS['fb_last_error']) ? ' (' . $GLOBALS['fb_last_error'] . ')' : ''),
    ]);
    exit;
}

echo json_encode([
    'success'    => true,
    'message'    => 'Command queued — ESP32-S3 will pick it up within 1 second',
    'command_id' => $command['id'],
    'source'     => $source,
]);
?>
