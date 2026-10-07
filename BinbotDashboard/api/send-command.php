<?php
// ============================================================
//  send-command.php
//  Dashboard JS POSTs a command here (open/close lid, threshold)
//  ESP32-S3 polls get-command.php to pick it up
//  Your JS already calls:  CONFIG.API_BASE + 'send-command.php'
//
//  UPDATED v2.3.0:
//  - Added 'source' field support → 'manual' (default) or 'auto'
//    manual = dashboard button → ESP32 holds open until close command
//    auto   = programmatic     → ESP32 does open + 5s standby + auto-close
//  - Compartment validation (only 'bio' or 'nonbio' accepted)
//  - Rejects requests while a command is still pending/unexecuted
// ============================================================

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

$action      = $body['action']      ?? '';
$compartment = $body['compartment'] ?? '';
$source      = $body['source']      ?? 'manual'; // default to manual if JS doesn't send it

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
$cmdFile = __DIR__ . '/pending_command.json';

if (file_exists($cmdFile)) {
    $existing = json_decode(file_get_contents($cmdFile), true);
    if ($existing && ($existing['executed'] ?? false) === false) {
        $age = time() - ($existing['unix_time'] ?? 0);
        if ($age <= 10) {
            // Still within the 10s window — previous command not yet picked up
            echo json_encode([
                'success' => false,
                'message' => 'A command is already pending. Wait for ESP32 to pick it up (within 1s).',
                'pending_command_id' => $existing['id'] ?? null,
            ]);
            exit;
        }
        // Older than 10s — safe to overwrite (ESP32 was offline, command stale)
    }
}

// ── Build command record ──────────────────────────────────────
$command = [
    'id'          => uniqid('cmd_', true),
    'action'      => $action,
    'compartment' => $compartment,
    'source'      => $source,        // 'manual' → ESP32 holds open until close command
                                     // 'auto'   → ESP32 opens, waits 5s, auto-closes
    'value'       => $body['value'] ?? null,  // for set_threshold only
    'created_at'  => date('Y-m-d H:i:s'),
    'unix_time'   => time(),
    'executed'    => false,
];

// ── Write to command queue (one pending command at a time) ────
file_put_contents($cmdFile, json_encode($command, JSON_PRETTY_PRINT));

echo json_encode([
    'success'    => true,
    'message'    => 'Command queued — ESP32-S3 will pick it up within 1 second',
    'command_id' => $command['id'],
    'source'     => $source,
]);
?>