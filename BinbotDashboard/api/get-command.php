<?php
// ============================================================
//  get-command.php
//  ESP32-S3 polls this endpoint every ~1 second (optional — the
//  firmware also reads binbot/command directly from Firebase).
//  Returns any pending command, then marks it as executed.
//  Method: GET
//
//  Source: Firebase RTDB binbot/command — same pending-flag flow
//  the firmware implements (it clears by writing pending=false).
//
//  UPDATED:
//  - Added 'source' field → 'manual' or 'auto'
//  - Added field validation before returning command
//  - Safe fallback: missing 'source' defaults to 'manual'
// ============================================================

require __DIR__ . '/firebase.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$cmd = fb_get('binbot/command');

// ── No command, or already picked up ──────────────────────────
if (!is_array($cmd) || ($cmd['pending'] ?? false) !== true) {
    echo json_encode(['success' => true, 'has_command' => false]);
    exit;
}

// ── Commands expire after 10 seconds ──────────────────────────
//    Prevents stale commands firing if ESP32 was offline
$createdUnix = is_numeric($cmd['unix_time'] ?? null)
    ? (int) $cmd['unix_time']
    : (is_numeric($cmd['created_at'] ?? null)
        ? (int) floor($cmd['created_at'] / 1000)
        : 0);

if ($createdUnix > 0 && (time() - $createdUnix) > 10) {
    $cmd['pending']  = false;
    $cmd['executed'] = true;
    $cmd['expired']  = true;
    fb_put('binbot/command', $cmd);
    echo json_encode([
        'success'     => true,
        'has_command' => false,
        'note'        => 'Command expired',
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
    $cmd['pending']  = false;
    $cmd['executed'] = true;
    $cmd['error']    = 'Invalid action: ' . $action;
    fb_put('binbot/command', $cmd);
    echo json_encode([
        'success'     => false,
        'has_command' => false,
        'error'       => 'Invalid action',
    ]);
    exit;
}

if ($action !== 'set_threshold' && !in_array($compartment, $validCompartments)) {
    $cmd['pending']  = false;
    $cmd['executed'] = true;
    $cmd['error']    = 'Invalid compartment: ' . $compartment;
    fb_put('binbot/command', $cmd);
    echo json_encode([
        'success'     => false,
        'has_command' => false,
        'error'       => 'Invalid compartment',
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
        'id'          => $cmd['id']       ?? null,
        'action'      => $action,
        'compartment' => $compartment,
        'source'      => $source,        // 'manual' → hold open until explicit close
                                         // 'auto'   → open 0.5s, hold 5s, auto-close
        'value'       => $cmd['value']   ?? null,  // for set_threshold only
    ],
]);

// ── Mark as executed so it's only sent once ───────────────────
$cmd['pending']     = false;
$cmd['executed']    = true;
$cmd['executed_at'] = date('Y-m-d H:i:s');
fb_put('binbot/command', $cmd);
?>
