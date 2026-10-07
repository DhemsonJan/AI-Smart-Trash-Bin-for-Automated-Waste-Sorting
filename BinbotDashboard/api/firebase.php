<?php
// ============================================================================
//  firebase.php — shared Firebase Realtime Database REST helper
// ----------------------------------------------------------------------------
//  Every API endpoint in this folder talks to Firebase instead of writing
//  local JSON files, because the Vercel serverless filesystem is ephemeral
//  (writes would disappear within minutes). The ESP32-S3, ESP32-CAM and the
//  public dashboard already use this same Realtime Database.
//
//  Paths (must match the firmware + Binbot.js FB_PATHS):
//    binbot/sensors     flat sensor + lid + system record (last_seen = ms)
//    binbot/command     { id, action, compartment, source, pending, ... }
//    binbot/chart/YYYY-MM-DD   { date, bio_fill, nonbio_fill, ... }
// ============================================================================

const FB_DATABASE_URL = 'https://aitrashbin-afce1-default-rtdb.asia-southeast1.firebasedatabase.app';
const FB_WEB_API_KEY  = 'AIzaSyB3sEQ3WE3Dt2yRkhhdza_0foaTnbP3p0s';
// Note: anonymous sign-in uses the accounts:signUp endpoint (per the
// Firebase Auth REST docs) — there is no working signInWithAnonymous.
const FB_AUTH_URL     = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';

// Raw HTTP call via cURL. Returns ['ok', 'status', 'body', 'error'].
function fb_http($url, $method = 'GET', $body = null) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $resp   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        return ['ok' => false, 'status' => 0, 'body' => null, 'error' => $err];
    }
    return [
        'ok'    => $status >= 200 && $status < 300,
        'status'=> $status,
        'body'  => json_decode($resp, true),
        'error' => null,
    ];
}

// Anonymous ID token so the helper works even when the database rules
// require auth != null. Cached on disk so warm instances reuse it
// (tokens last ~1 h). Returns null if anonymous sign-in is disabled —
// callers then simply rely on open database rules.
function fb_id_token() {
    static $token = false;
    if ($token !== false) {
        return $token;
    }

    $cacheFile = sys_get_temp_dir() . '/.fb_id_token.json';
    if (is_file($cacheFile)) {
        $cached = json_decode((string) file_get_contents($cacheFile), true);
        if (!empty($cached['token']) && (int)($cached['expires_at'] ?? 0) > time() + 60) {
            $token = $cached['token'];
            return $token;
        }
    }

    $r = fb_http(
        FB_AUTH_URL . '?key=' . FB_WEB_API_KEY,
        'POST',
        json_encode(['returnSecureToken' => true])
    );
    if ($r['ok'] && !empty($r['body']['idToken'])) {
        $token = $r['body']['idToken'];
        @file_put_contents($cacheFile, json_encode([
            'token'      => $token,
            'expires_at' => time() + (int)($r['body']['expiresIn'] ?? 3600),
        ]));
        return $token;
    }

    $token = null;
    return null;
}

function fb_url($path) {
    $url  = FB_DATABASE_URL . '/' . ltrim($path, '/') . '.json';
    $idToken = fb_id_token();
    if ($idToken) {
        $url .= '?auth=' . urlencode($idToken);
    }
    return $url;
}

// GET — returns decoded JSON body, or null on error / missing path.
function fb_get($path) {
    $r = fb_http(fb_url($path));
    if (!$r['ok']) {
        $GLOBALS['fb_last_error'] = $r['error'] ?: ('HTTP ' . $r['status']);
        return null;
    }
    return $r['body'];
}

// PUT / PATCH / DELETE — returns true on success.
function fb_put($path, $data)  { return fb_write('PUT', $path, $data); }
function fb_patch($path, $data) { return fb_write('PATCH', $path, $data); }
function fb_delete($path)       { return fb_write('DELETE', $path, null); }

function fb_write($method, $path, $data) {
    $body = ($method === 'DELETE' || $data === null) ? null : json_encode($data);
    $r = fb_http(fb_url($path), $method, $body);
    if (!$r['ok']) {
        $GLOBALS['fb_last_error'] = $r['error'] ?: ('HTTP ' . $r['status']);
        return false;
    }
    return true;
}
