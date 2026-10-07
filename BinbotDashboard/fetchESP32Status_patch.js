// ============================================================
//  ADD THIS FUNCTION TO Binbot.js
//  (paste it anywhere near the other fetch functions, around line 80)
//  It replaces the missing fetchESP32Status() that your code calls
//  but was never defined.
// ============================================================

async function fetchESP32Status() {
  try {
    const response = await fetch(CONFIG.API_BASE + 'get-esp32-status.php');
    if (!response.ok) {
      _setAllStatusIndicators(false, null);
      return false;
    }

    const json = await response.json();
    if (!json.success) {
      _setAllStatusIndicators(false, null);
      return false;
    }

    realTimeData.esp32Status = json;
    _setAllStatusIndicators(json.online, json);
    return json.online;

  } catch (err) {
    console.warn('⚠️ fetchESP32Status error:', err.message);
    _setAllStatusIndicators(false, null);
    return false;
  }
}

// ── Also add this to startRealtimePolling() ──────────────────
// Your existing startRealtimePolling() already calls fetchESP32Status()
// once on startup, but doesn't set up a repeat interval.
// Add this line inside startRealtimePolling(), after the other setIntervals:
//
//   setInterval(fetchESP32Status, 5000);   // check every 5 s
