// ============================================================================
// Binbot.js - TrashSmart Dashboard JavaScript (2026 Premium)
// UPDATED: Manual-Only Lid Control | Hazardous REMOVED
// UPDATED: Parenthesis-aware category detection (e.g. "Cup(Recyclable)")
//   ✅ Real sensor data from ESP32 via get-sensor-data.php
//   ✅ Real chart data from get-chart-data.php
//   ✅ send-command.php for lid open/close (MANUAL ONLY)
//   ✅ get-esp32-status.php for connection badge
//   ✅ ESP32-CAM detection is INFORMATIONAL ONLY
//   ✅ Detection display shows waste type + confidence for user awareness only
//   ✅ Hazardous category fully removed
// ============================================================================

// ── Configuration ─────────────────────────────────────────────────────────────
// NOTE: Sensor data, commands, status, and camera detections now flow through
// Firebase Realtime Database (see firebase-config.js) instead of the old PHP
// API_BASE / Flask AI_SERVER_URL endpoints. That removes the local-IP problem —
// this dashboard, the ESP32-S3, and the ESP32-CAM no longer need to be on the
// same WiFi network or know each other's IP addresses.
const CONFIG = {
  PARTICLE_COUNT:     25,
  ANIMATION_DURATION: 600,
  FULL_BIN_THRESHOLD: 100,
  DETECTION_ENABLED:  true,
  MIN_CONFIDENCE:     0.45,
  OFFLINE_AFTER_MS:   8000,   // consider a device offline if Firebase hasn't heard from it in this long
  // Waste Type Images
  WASTE_IMAGES: {
    'Biodegradable':     './images/waste-types/Biodegradable.jpg',
    'Non-Biodegradable': './images/waste-types/Non-Biodegradable.jpg',
    'Recyclable':        './images/waste-types/Non-Biodegradable.jpg'
  }
};

// ── Firebase Realtime Database paths ──────────────────────────────────────────
const FB_PATHS = {
  sensors:   'binbot/sensors',
  command:   'binbot/command',
  detection: 'binbot/detection',
  camStatus: 'binbot/camStatus',
  chart:     'binbot/chart'
};

// ── Bin Lock State ────────────────────────────────────────────────────────────
const binLockState = {
  bio:    false,
  nonbio: false
};

// ── Real-Time Data Store ──────────────────────────────────────────────────────
const realTimeData = {
  sensors:      null,
  chartData:    null,
  esp32Status:  null,
  lastUpdate:   null,
  isLoading:    false,
  lastDetection:   null,
  detectionActive: false,
  cameraStream:    null
};

// ── Detection State ───────────────────────────────────────────────────────────
const detectionState = {
  isRunning:        false,
  lastDetectedType: null,
  lastConfidence:   0,
  detectionTimer:   null,
  videoElement:     null,
  canvas:           null,
  ctx:              null
};

// ── Polling Timers ────────────────────────────────────────────────────────────
let sensorPollingTimer  = null;
let chartPollingTimer   = null;

// ── Pending Lid Action (for modal confirmation) ───────────────────────────────
let pendingLidAction = null;

// =============================================================================
// FIREBASE REALTIME LISTENERS
//   These replace the old PHP polling functions. `db` comes from
//   firebase-config.js, which must be loaded before this file.
// =============================================================================

function setupSensorListener() {
  db.ref(FB_PATHS.sensors).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    realTimeData.sensors    = data;
    realTimeData.lastUpdate = new Date();

    // Reshape the flat Firebase record into the nested shape the existing
    // UI functions (updateUIFromSensorData, etc.) already expect.
    const shaped = {
      sensors: {
        ultrasonic: {
          bio:    { distance_cm: data.ultra_bio_cm    || 0, fill_level: data.fill_bio    || 0 },
          nonbio: { distance_cm: data.ultra_nonbio_cm || 0, fill_level: data.fill_nonbio || 0 }
        },
        gas: {
          bio:    { raw: data.gas_bio_raw    || 0, level_percent: data.gas_bio_pct    || 0 },
          nonbio: { raw: data.gas_nonbio_raw || 0, level_percent: data.gas_nonbio_pct || 0 }
        }
      },
      lids: {
        bio_open:    !!data.lid_bio_open,
        nonbio_open: !!data.lid_nonbio_open
      },
      system: {
        wifi_rssi:  data.rssi      || 0,
        ip_address: data.ip        || '',
        uptime_ms:  data.uptime_ms || 0,
        firmware:   data.firmware  || '—',
        free_heap:  data.free_heap || 0
      }
    };

    updateUIFromSensorData(shaped);

    const lastSeen = data.last_seen || 0;
    const age       = Date.now() - lastSeen;
    const online    = lastSeen > 0 && age < CONFIG.OFFLINE_AFTER_MS;

    _setAllStatusIndicators(online, {
      seconds_since_update: Math.round(age / 1000),
      last_seen: lastSeen ? new Date(lastSeen).toLocaleString() : '',
      system: shaped.system
    });
  }, (err) => {
    console.error('❌ Sensor listener error:', err.message);
    _setAllStatusIndicators(false, null);
  });
}

function setupCamStatusListener() {
  db.ref(FB_PATHS.camStatus).on('value', (snapshot) => {
    const data     = snapshot.val();
    const lastSeen = data?.last_seen || 0;
    const online   = lastSeen > 0 && (Date.now() - lastSeen) < CONFIG.OFFLINE_AFTER_MS;
    updateESP32CamConnectionStatus(online);
  }, (err) => {
    console.warn('⚠️ Cam status listener error:', err.message);
    updateESP32CamConnectionStatus(false);
  });
}

function setupChartListener() {
  db.ref(FB_PATHS.chart).on('value', (snapshot) => {
    const raw = snapshot.val();
    if (!raw) return;

    const entries = Object.keys(raw)
      .sort()
      .map((date) => ({
        date,
        bio_fill:    raw[date].bio_fill    || 0,
        nonbio_fill: raw[date].nonbio_fill || 0
      }));

    const last30 = entries.slice(-30);
    const daily  = last30.map((e) => ({
      day:         new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bio_fill:    e.bio_fill,
      nonbio_fill: e.nonbio_fill,
      hazard_fill: 0
    }));

    realTimeData.chartData = { daily_readings: daily };
    updateChartFromData({ daily_readings: daily });

    const allFills = [...daily.map(d => d.bio_fill), ...daily.map(d => d.nonbio_fill)];
    if (allFills.length) {
      updateChartStats({
        avg_fill:  Math.round(allFills.reduce((a, b) => a + b, 0) / allFills.length),
        peak_fill: Math.max(...allFills),
        low_fill:  Math.min(...allFills)
      });
    }
  }, (err) => {
    console.error('❌ Chart listener error:', err.message);
  });
}

function setupDetectionListener() {
  let lastSeenDetectionId = null;

  db.ref(FB_PATHS.detection).on('value', (snapshot) => {
    const detection = snapshot.val();
    if (!detection || !detection.id || detection.id === lastSeenDetectionId) return;
    lastSeenDetectionId = detection.id;

    const result = {
      waste_type: detection.label,
      confidence: detection.confidence,
      source:     'esp32cam',
      timestamp:  detection.timestamp
    };

    console.log(`📱 ESP32-CAM Detection (Firebase): ${detection.label} (${Math.round((detection.confidence || 0) * 100)}%)`);
    updateDetectionDisplay(result);

    const waiting = document.getElementById('waitingDetection');
    if (waiting) waiting.style.display = 'none';
  }, (err) => {
    console.warn('⚠️ Detection listener error:', err.message);
  });
}

async function sendCommandToESP32(action, compartment) {
  try {
    const command = {
      id:         Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7),
      action,
      compartment,
      source:     'manual',
      pending:    true,
      created_at: Date.now()
    };
    console.log(`📤 Sending command via Firebase: ${action} → ${compartment}`);
    await db.ref(FB_PATHS.command).set(command);
    console.log('✅ Command written to Firebase');
    return true;
  } catch (err) {
    console.error('❌ sendCommandToESP32 error:', err.message);
    return false;
  }
}

// =============================================================================
// AI WASTE DETECTION — INFORMATIONAL ONLY
//   Detections now arrive in real time via setupDetectionListener() (above),
//   which is started from startRealtimePolling(). updateDetectionDisplay()
//   below is what actually paints the result on screen.
// =============================================================================

/**
 * Resolve a raw detection label (e.g. "Cup(Recyclable)", "Paper(Biodegradable)",
 * or a plain legacy sub-label like "Cup") into one of the two display
 * categories the dashboard actually has images for: "Biodegradable" or
 * "Non-Biodegradable".
 *
 * Priority:
 *   1. If the label has a parenthesized category — e.g. "Cup(Recyclable)" —
 *      read the word(s) inside the parentheses and classify off THAT, since
 *      it's the most explicit signal from the model.
 *        - contains "non-biodegradable"      -> Non-Biodegradable
 *        - contains "recyclable"             -> Non-Biodegradable
 *        - contains "biodegradable"          -> Biodegradable
 *   2. Otherwise, fall back to legacy exact sub-label matching so older
 *      label formats (no parentheses) keep working unchanged.
 */
function resolveWasteCategory(rawLabel) {
  const label = String(rawLabel || '').trim();

  const parenMatch    = label.match(/\(([^)]+)\)/);
  const parenCategory = parenMatch ? parenMatch[1].trim() : null;

  if (parenCategory) {
    if (/non-?biodegradable/i.test(parenCategory)) return 'Non-Biodegradable';
    if (/recyclable/i.test(parenCategory))         return 'Non-Biodegradable';
    if (/biodegradable/i.test(parenCategory))      return 'Biodegradable';
    // Unrecognized text inside parentheses — fall through to legacy check
    // using the outer label (text before the parenthesis) just in case.
  }

  // ── Legacy fallback: exact sub-label matching (no parentheses present) ────
  if (['Recyclable', 'Bottle', 'Can', 'Glass', 'Plastic'].includes(label)) {
    return 'Non-Biodegradable';
  }
  if (['Cartoon', 'Cup', 'Eggshell', 'Leaves', 'Paper', 'Styro'].includes(label)) {
    return 'Biodegradable';
  }

  // Already a top-level category name — pass through untouched.
  if (label === 'Biodegradable' || label === 'Non-Biodegradable') return label;

  // Unknown — let the caller fall back to the "unknown" image.
  return label;
}

/**
 * Update the detection display — INFORMATIONAL ONLY.
 * Shows what the camera sees. Does NOT trigger lid opening.
 */
function updateDetectionDisplay(result) {
  try {
    const resultBox       = document.getElementById('detectionResult');
    const waitingBox      = document.getElementById('waitingDetection');
    const detectionImage  = document.getElementById('detectionImage');
    const detectionText   = document.getElementById('detectionText');
    const confidenceBadge = document.getElementById('detectionConfidence');

    if (!resultBox || !detectionImage || !detectionText) return;

    let { waste_type, confidence } = result;
    const rawLabel = waste_type; // keep the original label around for logging

    if (confidence < CONFIG.MIN_CONFIDENCE) {
      resultBox.classList.remove('show');
      if (waitingBox) waitingBox.classList.remove('hidden');
      return;
    }

    // ── Map raw label (with or without "(Category)") to a display category ──
    waste_type = resolveWasteCategory(waste_type);

    let imagePath = result.image || CONFIG.WASTE_IMAGES[waste_type] || './images/waste-types/unknown.jpg';

    if (!imagePath.startsWith('data:') && !imagePath.startsWith('http')) {
      imagePath = CONFIG.WASTE_IMAGES[waste_type] || './images/waste-types/unknown.jpg';
    }

    let iconEmoji = '❓';
    if      (waste_type === 'Biodegradable')     iconEmoji = '🟢';
    else if (waste_type === 'Non-Biodegradable') iconEmoji = '🔵';

    detectionImage.src = imagePath;
    detectionImage.onerror = () => {
      detectionImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23ccc" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23666" font-size="24"%3EImage Not Found%3C/text%3E%3C/svg%3E';
    };

    const confidencePercent = Math.round(confidence * 100);
    detectionText.innerHTML = `${iconEmoji} <strong>${waste_type}</strong>`;
    if (confidenceBadge) confidenceBadge.textContent = `${confidencePercent}%`;

    if (waitingBox) { waitingBox.classList.add("hidden"); waitingBox.style.display = "none"; }
    resultBox.style.display = "flex"; resultBox.classList.add("show");

    console.log(`✅ Detection displayed (info only): "${rawLabel}" → ${waste_type} (${confidencePercent}%) [${result.source}]`);

  } catch (err) {
    console.error('❌ Display update error:', err.message);
  }
}

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================

function updateUIFromSensorData(data) {
  if (!data || !data.sensors) return;

  const { ultrasonic, gas } = data.sensors;

  if (ultrasonic) {
    const bioFill    = ultrasonic.bio?.fill_level    || 0;
    const nonbioFill = ultrasonic.nonbio?.fill_level || 0;

    animateCircle('biodegradable',    bioFill,    '#4CAF50');
    animateCircle('nonBiodegradable', nonbioFill, '#3b82f6');

    // ── Bin lock/unlock based on ULTRASONIC fill level (not gas) ──────────
    // Bio bin
    if (bioFill >= CONFIG.FULL_BIN_THRESHOLD && !binLockState.bio) {
      binLockState.bio = true;
      showFullBinNotification('bio', 'Biodegradable');
      updateLidButtonState('bio', true);
    } else if (bioFill < CONFIG.FULL_BIN_THRESHOLD && binLockState.bio) {
      binLockState.bio = false;
      updateLidButtonState('bio', false);
    }
    // Non-Bio bin
    if (nonbioFill >= CONFIG.FULL_BIN_THRESHOLD && !binLockState.nonbio) {
      binLockState.nonbio = true;
      showFullBinNotification('nonbio', 'Non-Biodegradable');
      updateLidButtonState('nonbio', true);
    } else if (nonbioFill < CONFIG.FULL_BIN_THRESHOLD && binLockState.nonbio) {
      binLockState.nonbio = false;
      updateLidButtonState('nonbio', false);
    }
  }

  if (gas) {
    // Gas sensor is informational only — shows air quality, does NOT affect bin locking
    updateGasBox(
      false,
      gas.bio?.level_percent    || 0,
      gas.nonbio?.level_percent || 0
    );
  }

  updateGasLastUpdated();

  if (data.lids) {
    updateLidIndicators(data.lids);
  }
}

function updateLidIndicators(lids) {
  const map = {
    bio:    { indicator: 'bioLidIndicator',    isOpen: lids.bio_open    },
    nonbio: { indicator: 'nonbioLidIndicator', isOpen: lids.nonbio_open },
  };

  Object.values(map).forEach(({ indicator, isOpen }) => {
    const el = document.getElementById(indicator);
    if (!el) return;
    el.textContent = isOpen ? '🔓 Open' : '🔒 Closed';
    el.className   = 'lid-indicator' + (isOpen ? ' open' : '');
  });
}

function updateChartFromData(data) {
  if (!data.daily_readings || data.daily_readings.length === 0) return;

  const readings  = data.daily_readings;
  const chartData = {
    labels: readings.map(r => r.day),
    bio:    readings.map(r => r.bio_fill),
    nonBio: readings.map(r => r.nonbio_fill)
  };

  updateTrendChart(chartData);
}

function updateChartStats(stats) {
  const avgEl  = document.getElementById('statAvg');
  const peakEl = document.getElementById('statPeak');
  const lowEl  = document.getElementById('statLow');

  if (avgEl  && stats.avg_fill  != null) avgEl.textContent  = stats.avg_fill + '%';
  if (peakEl && stats.peak_fill != null) peakEl.textContent = stats.peak_fill + '%';
  if (lowEl  && stats.low_fill  != null) lowEl.textContent  = stats.low_fill + '%';

  const insight = document.getElementById('trendInsight');
  if (insight && stats.avg_fill != null) {
    const trend = stats.peak_fill > stats.avg_fill * 1.3
      ? 'spikes detected on peak days'
      : 'stable fill levels observed';
    insight.innerHTML = `📈 <strong>Trend:</strong> Average fill is <strong>${stats.avg_fill}%</strong>/day. Peak hit <strong>${stats.peak_fill}%</strong> — ${trend}.`;
  }
}

function updateGasLastUpdated() {
  const el = document.getElementById('gasLastUpdated');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

// =============================================================================
// STATUS INDICATOR
// =============================================================================

function _setAllStatusIndicators(isOnline, status) {

  const dot   = document.getElementById('esp32Dot');
  const label = document.getElementById('esp32Label');
  if (dot) {
    dot.classList.toggle('online',  isOnline);
    dot.classList.toggle('offline', !isOnline);
  }
  if (label) {
    if (isOnline && status) {
      const rssi   = status.system?.wifi_rssi ?? status.wifi_rssi ?? 0;
      const signal = rssi >= -60 ? '📶 Strong' : rssi >= -75 ? '📶 Fair' : '📶 Weak';
      label.textContent = 'ESP32 Online · ' + signal;
    } else {
      label.textContent = 'ESP32 Offline';
    }
  }

  const indicator  = document.getElementById('esp32Indicator');
  const statusText = document.getElementById('esp32StatusText');
  if (indicator) indicator.classList.toggle('online', isOnline);
  if (statusText) {
    statusText.textContent = isOnline ? 'Online' : 'Offline';
    statusText.style.color = isOnline ? '#10b981' : '#ef4444';
  }

  const box4Badge = document.getElementById('esp32StatusBadge');
  if (box4Badge) {
    const badgeStatus = box4Badge.querySelector('.badge-status');
    if (badgeStatus) {
      badgeStatus.textContent = isOnline ? 'Connected'    : 'Disconnected';
      badgeStatus.style.color = isOnline ? '#4CAF50'      : '#ef4444';
    }
    box4Badge.classList.toggle('disconnected', !isOnline);
  }

  const settingsStatus = document.getElementById('settingsESP32Status');
  const settingsDetail = document.getElementById('settingsESP32Detail');
  const settingsAge    = document.getElementById('settingsDataAge');
  const settingsUpdate = document.getElementById('settingsLastUpdate');
  const sysIP          = document.getElementById('sysInfoIP');
  const sysRSSI        = document.getElementById('sysInfoRSSI');
  const sysUptime      = document.getElementById('sysInfoUptime');
  const sysFirmware    = document.getElementById('sysInfoFirmware');

  if (isOnline && status) {
    const age      = status.seconds_since_update ?? 0;
    const rssi     = status.system?.wifi_rssi  ?? status.wifi_rssi  ?? '—';
    const uptime   = status.system?.uptime_ms  ?? status.uptime_ms  ?? null;
    const firmware = status.system?.firmware   ?? status.firmware   ?? 'v2.1.0';
    const ip       = status.system?.ip_address ?? status.ip_address ?? '—';

    if (settingsStatus) {
      settingsStatus.textContent = 'Online ✅';
      settingsStatus.className   = 'metric-value online';
    }
    if (settingsDetail) settingsDetail.textContent = `Last seen ${age}s ago`;
    if (settingsAge)    settingsAge.textContent    = age + 's ago';
    if (settingsUpdate && status.last_seen) settingsUpdate.textContent = status.last_seen;
    if (sysIP)       sysIP.textContent       = ip;
    if (sysRSSI)     sysRSSI.textContent     = rssi + ' dBm';
    if (sysUptime)   sysUptime.textContent   = uptime ? formatUptime(uptime) : '—';
    if (sysFirmware) sysFirmware.textContent = firmware;
  } else {
    if (settingsStatus) {
      settingsStatus.textContent = 'Offline ❌';
      settingsStatus.className   = 'metric-value offline';
    }
    if (settingsDetail) settingsDetail.textContent = 'ESP32 not responding';
    if (settingsAge)    settingsAge.textContent    = '—';
    if (sysIP)          sysIP.textContent          = '—';
    if (sysRSSI)        sysRSSI.textContent        = '—';
    if (sysUptime)      sysUptime.textContent      = '—';
    if (sysFirmware)    sysFirmware.textContent    = '—';
  }
}

function formatUptime(ms) {
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function updateLidStatusDisplay(status) {
  if (!status) return;
  ['bio', 'nonbio'].forEach(comp => {
    const isOpen   = status[comp]?.is_open ?? false;
    const openBtn  = document.querySelector(`.manual-controls-${comp} .btn-open`);
    const closeBtn = document.querySelector(`.manual-controls-${comp} .btn-close`);
    if (isOpen) {
      openBtn?.classList.add('active');
      closeBtn?.classList.remove('active');
    } else {
      openBtn?.classList.remove('active');
      closeBtn?.classList.add('active');
    }
  });
}

// =============================================================================
// ESP32-CAM STATUS
// =============================================================================

function updateESP32CamConnectionStatus(isOnline) {
  const indicator  = document.getElementById('esp32CamIndicator');
  const statusText = document.getElementById('esp32CamStatusText');
  if (!indicator || !statusText) return;
  if (isOnline) {
    indicator.classList.add('online');
    statusText.textContent = 'Online';
    statusText.style.color = '#10b981';
  } else {
    indicator.classList.remove('online');
    statusText.textContent = 'Offline';
    statusText.style.color = '#ef4444';
  }
}

// =============================================================================
// REALTIME LISTENERS — START / STOP
//   No more setInterval polling — Firebase pushes updates to us the moment
//   the ESP32-S3 or ESP32-CAM writes new data, from any WiFi network.
// =============================================================================

function startRealtimePolling() {
  console.log('🚀 Attaching Firebase realtime listeners...');

  setupSensorListener();
  setupCamStatusListener();
  setupChartListener();
  if (CONFIG.DETECTION_ENABLED) setupDetectionListener();

  console.log('✅ Firebase listeners attached');
}

function stopRealtimePolling() {
  db.ref(FB_PATHS.sensors).off();
  db.ref(FB_PATHS.camStatus).off();
  db.ref(FB_PATHS.chart).off();
  db.ref(FB_PATHS.detection).off();
  console.log('✓ Firebase listeners detached');
}

// =============================================================================
// MANUAL LID CONTROL
// =============================================================================

function openLid(category) {
  showLidModal('open', category);
}

function closeLid(category) {
  showLidModal('close', category);
}

function showLidModal(type, category) {
  const categoryNames = {
    bio:    'Biodegradable',
    nonbio: 'Non-Biodegradable'
  };

  const name    = categoryNames[category] || category;
  const overlay = document.getElementById('lidModalOverlay');

  if (type === 'open') {
    if (binLockState[category]) {
      const lockedModal = document.getElementById('lockedBinModal');
      const lockedText  = document.getElementById('lockedBinText');
      if (lockedText) {
        lockedText.textContent = `The ${name} bin is FULL and automatically locked. Please empty the bin first before opening.`;
      }
      if (overlay)     overlay.classList.add('show');
      if (lockedModal) lockedModal.classList.add('show');
      logSecurityEvent('locked_lid_open_attempt', {
        category, categoryName: name, success: false, reason: 'Bin full - locked'
      });
      return;
    }

    pendingLidAction = { type: 'open', category, name };
    const openModal  = document.getElementById('openLidModal');
    const openText   = document.getElementById('openLidText');
    if (openText)  openText.textContent = `Open ${name} compartment lid?`;
    if (overlay)   overlay.classList.add('show');
    if (openModal) openModal.classList.add('show');

  } else if (type === 'close') {
    pendingLidAction = { type: 'close', category, name };
    const closeModal = document.getElementById('closeLidModal');
    const closeText  = document.getElementById('closeLidText');
    if (closeText)  closeText.textContent = `Close ${name} compartment lid?`;
    if (overlay)    overlay.classList.add('show');
    if (closeModal) closeModal.classList.add('show');
  }
}

function closeLidModal() {
  const overlay      = document.getElementById('lidModalOverlay');
  const openModal    = document.getElementById('openLidModal');
  const closeModal   = document.getElementById('closeLidModal');
  const lockedModal  = document.getElementById('lockedBinModal');
  const successModal = document.getElementById('successModal');

  [overlay, openModal, closeModal, lockedModal, successModal].forEach(el => {
    el?.classList.remove('show');
  });

  pendingLidAction = null;
}

function showSuccessModal(message) {
  const overlay      = document.getElementById('lidModalOverlay');
  const successModal = document.getElementById('successModal');
  const successText  = document.getElementById('successText');

  if (successText) successText.textContent = message;
  overlay?.classList.add('show');
  successModal?.classList.add('show');
}

async function confirmOpenLid() {
  if (!pendingLidAction || pendingLidAction.type !== 'open') return;

  const { category, name } = pendingLidAction;
  closeLidModal();

  showToast(`⏳ Opening ${name} lid...`, 'info');

  const success = await sendCommandToESP32('open_lid', category);

  if (success) {
    showSuccessModal(`✅ ${name} lid is now opening!\n\nIt will auto-close in 5 seconds.`);
    showToast(`${name} lid opened`, 'success');
    logSecurityEvent('lid_opened', { category, categoryName: name, success: true });
    saveLidHistory('open_lid', category, name);
  } else {
    showSuccessModal(`❌ Failed to open ${name} lid.\n\nCheck that the ESP32 is connected to WiFi.`);
    showToast(`Failed to open ${name} lid`, 'error');
    logSecurityEvent('lid_opened', { category, categoryName: name, success: false, reason: 'API error' });
  }
}

async function confirmCloseLid() {
  if (!pendingLidAction || pendingLidAction.type !== 'close') return;

  const { category, name } = pendingLidAction;
  closeLidModal();

  showToast(`⏳ Closing ${name} lid...`, 'info');

  const success = await sendCommandToESP32('close_lid', category);

  if (success) {
    showSuccessModal(`✅ ${name} lid is now closing securely!`);
    showToast(`${name} lid closed`, 'success');
    logSecurityEvent('lid_closed', { category, categoryName: name, success: true });
    saveLidHistory('close_lid', category, name);
  } else {
    showSuccessModal(`❌ Failed to close ${name} lid.\n\nCheck that the ESP32 is connected to WiFi.`);
    showToast(`Failed to close ${name} lid`, 'error');
    logSecurityEvent('lid_closed', { category, categoryName: name, success: false, reason: 'API error' });
  }
}

function confirmAutoDetectionOpen()   { closeLidModal(); }
function confirmAutoDetectionCancel() { closeLidModal(); }

function saveLidHistory(action, category, name) {
  const lidHistory = JSON.parse(localStorage.getItem('lidHistory') || '[]');
  lidHistory.push({ action, category, categoryName: name, timestamp: new Date().toISOString() });
  if (lidHistory.length > 100) lidHistory.shift();
  localStorage.setItem('lidHistory', JSON.stringify(lidHistory));
}

// =============================================================================
// TOAST NOTIFICATION
// =============================================================================

function showToast(message, type = 'info') {
  document.querySelectorAll(`.toast-${type}`).forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  const colors = { success: '#4CAF50', error: '#f44336', info: '#3b82f6', warning: '#ffc107' };
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    padding: 14px 24px;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 10px;
    z-index: 10001;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    max-width: 320px;
    letter-spacing: 0.3px;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =============================================================================
// PARTICLES
// =============================================================================

function createParticles(selector, count = CONFIG.PARTICLE_COUNT, isHeader = false) {
  const container = document.querySelector(selector);
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const p  = document.createElement('div');
    p.className = 'particle';
    const dx = (Math.random() - 0.5) * (isHeader ? 200 : 400);
    const dy = (Math.random() - 0.5) * (isHeader ? 200 : 400);
    p.style.left           = `${Math.random() * 100}%`;
    p.style.top            = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 12}s`;
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    container.appendChild(p);
  }
}

// =============================================================================
// TIME BUBBLE
// =============================================================================

function updateTimeBubble() {
  const now     = new Date();
  const months  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const timeEl      = document.getElementById('currentTime');
  const monthEl     = document.getElementById('floatingMonth');
  const dayEl       = document.getElementById('currentDay');
  const dayOfWeekEl = document.getElementById('currentDayOfWeek');
  const monthNumEl  = document.getElementById('currentMonthNumber');

  if (timeEl)      timeEl.textContent      = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  if (monthEl)     monthEl.textContent     = months[now.getMonth()];
  if (dayEl)       dayEl.textContent       = String(now.getDate()).padStart(2,'0');
  if (dayOfWeekEl) dayOfWeekEl.textContent = days[now.getDay()];
  if (monthNumEl)  monthNumEl.textContent  = String(now.getMonth() + 1).padStart(2,'0');
}

function initTimeBubble() {
  updateTimeBubble();
  setInterval(updateTimeBubble, 1000);
}

// =============================================================================
// CIRCULAR PROGRESS CANVAS
// Store current progress per circle so we don't restart from 0 every poll.
// FIX: Firebase pushes new sensor data every ~2s, and the old version reset
// `progress = 0` on every single call — so the ring visibly "reset and raced
// back up" every couple seconds even when the real fill % hadn't changed,
// and it could never animate downward. This version remembers where each
// circle currently is and only re-animates when the target actually changes.
// =============================================================================

const _circleProgress  = {};   // { 'biodegradable': 45, 'nonBiodegradable': 30 }
const _circleAnimating = {};   // { 'biodegradable': true } — prevents double-start

function animateCircle(id, targetPercent, baseColor) {
  const box = document.getElementById(id);
  if (!box) return;
  const canvas    = box.querySelector('canvas');
  const percentEl = box.querySelector('.circle-percent');
  if (!canvas || !percentEl) return;

  // ── Only re-animate if the value actually changed ────────────
  const currentTarget = _circleProgress[id + '_target'];
  if (currentTarget === targetPercent && _circleAnimating[id]) return;
  _circleProgress[id + '_target'] = targetPercent;

  // ── Start progress from where we currently are, not from 0 ──
  if (_circleProgress[id] === undefined) _circleProgress[id] = 0;

  const ctx  = canvas.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const size = 160;

  // Only re-scale canvas if size changed (avoids flicker)
  if (canvas.width !== size * dpr) {
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
  }

  const cx = size / 2, cy = size / 2, r = 58, lw = 11;

  // Use current stored progress — not 0
  let progress = _circleProgress[id];
  _circleAnimating[id] = true;

  function draw() {
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;

    ctx.shadowColor  = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur   = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth   = lw;
    ctx.strokeStyle = 'rgba(226,232,240,0.12)';
    ctx.stroke();

    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + (progress / 100) * Math.PI * 2;
    const gradient   = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gradient.addColorStop(0,   baseColor);
    gradient.addColorStop(0.5, baseColor);
    gradient.addColorStop(1,   baseColor + 'cc');

    ctx.shadowColor  = baseColor + '80';
    ctx.shadowBlur   = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.lineWidth   = lw;
    ctx.strokeStyle = gradient;
    ctx.stroke();

    ctx.shadowColor  = baseColor + '40';
    ctx.shadowBlur   = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.lineWidth   = lw + 6;
    ctx.strokeStyle = baseColor + '20';
    ctx.stroke();

    ctx.shadowColor  = 'transparent';
    const centerGrad = ctx.createRadialGradient(cx - 20, cy - 20, 5, cx, cy, r - lw - 12);
    centerGrad.addColorStop(0,   'rgba(255,255,255,0.2)');
    centerGrad.addColorStop(0.3, 'rgba(20,28,50,0.8)');
    centerGrad.addColorStop(1,   'rgba(10,15,26,0.95)');
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw / 2 - 8, 0, Math.PI * 2);
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = centerGrad;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    const gloss = ctx.createRadialGradient(cx - 15, cy - 15, 0, cx, cy, r - lw);
    gloss.addColorStop(0,   'rgba(255,255,255,0.4)');
    gloss.addColorStop(0.4, 'rgba(255,255,255,0.1)');
    gloss.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw - 10, 0, Math.PI * 2);
    ctx.fillStyle = gloss;
    ctx.fill();

    percentEl.textContent = Math.round(progress) + '%';
    _circleProgress[id]   = progress;   // ← save current position every frame

    const diff = targetPercent - progress;
    if (Math.abs(diff) > 0.5) {
      // Animate toward target (works for both increasing and decreasing)
      progress += diff * 0.08 + (diff > 0 ? 0.5 : -0.5);
      requestAnimationFrame(draw);
    } else {
      // Reached target — stop animating
      progress = targetPercent;
      _circleProgress[id]  = targetPercent;
      _circleAnimating[id] = false;
      percentEl.textContent = Math.round(progress) + '%';
    }
  }

  requestAnimationFrame(draw);
}

// =============================================================================
// BOX SLIDER
// =============================================================================

let currentSlide    = 0;
const sliderWrapper = document.getElementById('boxSlider');
const boxSlides     = document.querySelectorAll('.box-slide');

function initializeSlider() {
  if (!sliderWrapper || boxSlides.length === 0) return;
}

function updateSlider() {
  if (!sliderWrapper) return;
  sliderWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
  boxSlides.forEach((slide, i) => {
    slide.classList.toggle('active', i === currentSlide);
  });
}

function goToSlide(index) {
  currentSlide = index;
  updateSlider();
}

function moveSlide(dir) {
  currentSlide = (currentSlide + dir + boxSlides.length) % boxSlides.length;
  updateSlider();
}

// =============================================================================
// CALENDAR (Box 1)
// =============================================================================

let currentMonthIndex = 4;
const monthSlides     = document.querySelectorAll('#calendarSlider .calendar-slide');
const monthTitle      = document.getElementById('currentMonth');

function changeMonth(dir) {
  monthSlides[currentMonthIndex].classList.remove('active');
  currentMonthIndex = (currentMonthIndex + dir + monthSlides.length) % monthSlides.length;
  monthSlides[currentMonthIndex].classList.add('active');
  if (monthTitle) monthTitle.textContent = monthSlides[currentMonthIndex].dataset.month;
}

// =============================================================================
// TREND CHART (Box 2)
// =============================================================================

let combinedTrendChartInstance = null;

const dailyTrendData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  bio:    [30, 40, 35, 50, 45, 60, 55],
  nonBio: [45, 50, 48, 60, 55, 65, 62]
};

function updateTrendChart(data = dailyTrendData) {
  const chartElement = document.getElementById('combinedTrendChart');
  if (!chartElement) return;

  const ctx = chartElement.getContext('2d');
  if (combinedTrendChartInstance) {
    combinedTrendChartInstance.destroy();
  }

  combinedTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   data.labels,
      datasets: [
        {
          label:                'Biodegradable',
          data:                 data.bio,
          borderColor:          '#4CAF50',
          backgroundColor:      'rgba(76,175,80,0.15)',
          fill:                 true,
          tension:              0.4,
          pointRadius:          5,
          pointBackgroundColor: '#4CAF50',
          pointBorderColor:     '#ffffff',
          pointBorderWidth:     2,
          borderWidth:          3,
        },
        {
          label:                'Non-Biodegradable',
          data:                 data.nonBio,
          borderColor:          '#3b82f6',
          backgroundColor:      'rgba(59,130,246,0.15)',
          fill:                 true,
          tension:              0.4,
          pointRadius:          5,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor:     '#ffffff',
          pointBorderWidth:     2,
          borderWidth:          3,
        }
      ]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display:  true,
          position: 'top',
          labels: {
            color:         '#e2e8f0',
            font:          { size: 14, weight: '600' },
            padding:       15,
            usePointStyle: true,
            pointStyle:    'circle'
          }
        },
        filler: { propagate: true }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 13, weight: '500' } },
          grid:  { color: 'rgba(148,163,184,0.12)', drawBorder: false }
        },
        y: {
          min:   0,
          max:   100,
          ticks: { color: '#94a3b8', font: { size: 13, weight: '500' }, stepSize: 20 },
          grid:  { color: 'rgba(148,163,184,0.12)', drawBorder: false }
        }
      }
    }
  });
}

// =============================================================================
// DETECTION POPUP FEEDBACK
// =============================================================================

function handleDetectionResponse(isCorrect) {
  const popup        = document.getElementById('detectionPopup');
  const feedbackMsg  = document.getElementById('feedbackMessage');
  const feedbackText = document.getElementById('feedbackText');
  const popupButtons = document.querySelector('.popup-buttons');
  const popupQuestion= document.querySelector('.popup-content p');

  if (!popup || !feedbackMsg) return;

  if (popupButtons)  popupButtons.style.display  = 'none';
  if (popupQuestion) popupQuestion.style.display = 'none';

  feedbackMsg.style.display = 'block';

  if (isCorrect) {
    feedbackMsg.classList.replace('error', 'success');
    feedbackText.textContent = '✓ Thank you! Feedback recorded.';
  } else {
    feedbackMsg.classList.replace('success', 'error');
    feedbackText.textContent = '✗ Feedback noted. Will improve detection.';
  }

  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => {
      popup.style.display        = 'none';
      feedbackMsg.style.display  = 'none';
      if (popupButtons)  popupButtons.style.display  = 'flex';
      if (popupQuestion) popupQuestion.style.display = 'block';
    }, 400);
  }, 2500);
}

function showDetection(item) {
  const imageBox      = document.getElementById('imageBox');
  const popup         = document.getElementById('detectionPopup');
  const resultBox     = document.getElementById('detectionResult');
  const waitingDetect = document.getElementById('waitingDetection');

  document.querySelector('.detected-img')?.remove();
  waitingDetect?.classList.add('hidden');

  if (imageBox && item.image) {
    const img     = document.createElement('img');
    img.className = 'detected-img';
    img.src       = item.image;
    img.alt       = `Detected: ${item.name}`;
    img.onerror   = () => {
      img.src = `https://via.placeholder.com/900x750?text=${encodeURIComponent(item.name)}`;
    };
    imageBox.appendChild(img);

    const confidence    = Math.floor(Math.random() * 15) + 85;
    const categoryNames = { bio: 'Biodegradable', nonBio: 'Non-Biodegradable' };
    const categoryDisplay = categoryNames[item.category] || item.category;

    if (resultBox) {
      const resultText = document.getElementById('detectionText');
      if (resultText) {
        resultText.innerHTML = `<strong>${item.name}</strong><br>Category: ${categoryDisplay}<br>Confidence: ${confidence}%`;
      }
      resultBox.style.display       = 'block';
      resultBox.classList.add('show');
      resultBox.style.pointerEvents = 'auto';
    }

    if (popup) {
      popup.style.display       = 'block';
      popup.classList.add('show');
      popup.style.pointerEvents = 'auto';
    }

    setTimeout(() => {
      img?.parentNode && img.remove();
      popup?.classList.remove('show');
      setTimeout(() => popup && (popup.style.display = 'none'), 400);
      resultBox?.classList.remove('show');
      setTimeout(() => resultBox && (resultBox.style.display = 'none'), 400);
      waitingDetect?.classList.remove('hidden');
    }, 8000);
  }
}

// =============================================================================
// GAS + BIN LEVEL DISPLAY
// =============================================================================

function showFullBinNotification(category, categoryName) {
  const id = `notification-${category}`;
  if (document.getElementById(id)) return;

  const n = document.createElement('div');
  n.id        = id;
  n.className = `full-bin-notification ${category}`;
  n.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">🔴</span>
      <span class="notification-text">${categoryName} Bin is Full!</span>
      <span class="notification-action">🔒 Lid Locked</span>
    </div>
  `;
  document.body.appendChild(n);

  setTimeout(() => n.classList.add('show'), 100);
  setTimeout(() => {
    n.classList.remove('show');
    setTimeout(() => n.parentNode?.removeChild(n), 300);
  }, 5000);

  console.warn(`⚠️ ${categoryName} Bin FULL — lid locked`);
  logSecurityEvent('bin_full', { category, categoryName, lidLocked: true });
}

// ── Updated: only bio and nonbio, no hazard ──────────────────
function updateGasBox(gasHigh, bio, nonBio) {
  const bioPPM    = Math.round(bio    * 3.75);
  const nonBioPPM = Math.round(nonBio * 3.75);

  const bioR    = document.getElementById('bioGasReading');
  const nonBioR = document.getElementById('nonBioGasReading');
  if (bioR)    bioR.textContent    = bioPPM    + ' PPM';
  if (nonBioR) nonBioR.textContent = nonBioPPM + ' PPM';

  const setBar = (barId, pctId, val) => {
    const bar = document.getElementById(barId);
    const pct = document.getElementById(pctId);
    if (bar) bar.style.width = val + '%';
    if (pct) pct.textContent = val + '%';
  };
  setBar('bioLevelBar',    'bioLevelPercent',    bio);
  setBar('nonBioLevelBar', 'nonBioLevelPercent', nonBio);

  // NOTE: bin locking was moved to updateUIFromSensorData() where it
  // correctly uses ULTRASONIC fill levels, not gas percentages.
  // Gas sensor here is informational/indicator only.

  const updateGasStatus = (pct, statusId) => {
    const el = document.getElementById(statusId);
    if (!el) return;
    let cls = 'safe', icon = '✓', text = 'Safe Level - Fan OFF';
    if      (pct >= 80) { cls = 'danger';  icon = '⚡'; text = 'CRITICAL - Fan AUTO-ON!'; }
    else if (pct >= 70) { cls = 'warning'; icon = '⚠'; text = 'Warning - Monitor Closely'; }
    else if (pct >= 50) { cls = 'warning'; icon = '⚠'; text = 'Elevated - Fan Ready'; }
    el.className = 'gas-indicator-status ' + cls;
    el.innerHTML = `<span class="status-icon ${cls}">${icon}</span><span class="status-text">${text}</span>`;
  };
  updateGasStatus(bio,    'bioGasStatus');
  updateGasStatus(nonBio, 'nonBioGasStatus');

  const systemBadge = document.getElementById('gasStatusBadge');
  if (systemBadge) {
    const max = Math.max(bio, nonBio);
    let badgeStatus = 'Normal', badgeColor = '#4CAF50';
    if      (max >= 80) { badgeStatus = 'CRITICAL'; badgeColor = '#ef4444'; }
    else if (max >= 70) { badgeStatus = 'Warning';  badgeColor = '#ffc107'; }
    else if (max >= 50) { badgeStatus = 'Elevated'; badgeColor = '#ff9800'; }

    const badgeValue = systemBadge.querySelector('.badge-value');
    if (badgeValue) {
      badgeValue.textContent = badgeStatus;
      badgeValue.style.color = badgeColor;
    }
  }
}

function updateLidButtonState(category, isLocked) {
  document.querySelectorAll(`button[onclick="openLid('${category}')"]`).forEach(btn => {
    if (isLocked) {
      btn.disabled = true;
      btn.classList.add('lid-locked');
      btn.innerHTML = '<span class="btn-icon">🔒</span><span class="btn-label">Locked</span>';
      btn.title = 'Bin full — lid locked until emptied';
    } else {
      btn.disabled = false;
      btn.classList.remove('lid-locked');
      btn.innerHTML = '<span class="btn-icon">📂</span><span class="btn-label">Open</span>';
      btn.title = 'Open lid';
    }
  });

  document.querySelectorAll(`.btn-open-lid[onclick="openLid('${category}')"]`).forEach(btn => {
    if (isLocked) {
      btn.disabled = true;
      btn.classList.add('lid-locked');
      btn.textContent = '🔒 Locked';
    } else {
      btn.disabled = false;
      btn.classList.remove('lid-locked');
      btn.textContent = 'Open';
    }
  });
}

// =============================================================================
// SETTINGS PANEL
// =============================================================================

function openSettings() {
  const panel        = document.getElementById('settingsPanel');
  const pinScreen    = document.getElementById('pinUnlockScreen');
  const contentPanel = document.getElementById('settingsContentPanel');

  if (panel) {
    panel.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (pinScreen)    pinScreen.style.display    = 'flex';
    if (contentPanel) contentPanel.style.display = 'none';
    clearPinInputs();
  }
}

function closeSettings() {
  const panel        = document.getElementById('settingsPanel');
  const pinScreen    = document.getElementById('pinUnlockScreen');
  const contentPanel = document.getElementById('settingsContentPanel');

  if (contentPanel?.style.display === 'block') {
    logSecurityEvent('SETTINGS_SESSION_CLOSED', { success: true, reason: 'User closed settings' });
  }

  if (panel) {
    panel.classList.remove('show');
    document.body.style.overflow = 'auto';
    clearPinInputs();
    if (pinScreen)    pinScreen.style.display    = 'flex';
    if (contentPanel) contentPanel.style.display = 'none';
  }
}

// =============================================================================
// PIN
// =============================================================================

function handlePinInput(event, fieldNumber) {
  const input = event.target;
  const value = input.value;
  if (value && isNaN(value)) { input.value = ''; return; }
  if (value && fieldNumber < 4) document.getElementById(`pinInput${fieldNumber + 1}`)?.focus();
  if (event.key === 'Backspace' && !value && fieldNumber > 1) {
    document.getElementById(`pinInput${fieldNumber - 1}`)?.focus();
  }
}

function clearPinInputs() {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`pinInput${i}`);
    if (el) el.value = '';
  }
  const err = document.getElementById('pinErrorMessage');
  if (err) err.style.display = 'none';
}

function getPinValue() {
  let pin = '';
  for (let i = 1; i <= 4; i++) {
    pin += document.getElementById(`pinInput${i}`)?.value || '';
  }
  return pin;
}

function verifyPin() {
  const enteredPin = getPinValue();

  if (enteredPin.length !== 4) {
    logSecurityEvent('PIN_ATTEMPT_INCOMPLETE', { success: false, pinLength: enteredPin.length });
    showPinError();
    return;
  }

  const adminUsers = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  const validUser  = adminUsers.find(u =>
    (u.role === 'Supervisor' || u.role === 'Collector') && u.password === enteredPin
  );

  if (validUser) {
    logSecurityEvent('PIN_UNLOCK_SUCCESS', {
      success: true, userId: validUser.id, userName: validUser.name, userRole: validUser.role
    });
    document.getElementById('pinUnlockScreen').style.display     = 'none';
    document.getElementById('settingsContentPanel').style.display = 'block';
    console.log(`✅ Settings unlocked for ${validUser.role}: ${validUser.name}`);
  } else {
    logSecurityEvent('PIN_UNLOCK_FAILED', { success: false, reason: 'Invalid PIN' });
    showPinError();
    clearPinInputs();
    document.getElementById('pinInput1')?.focus();
  }
}

function showPinError() {
  const err = document.getElementById('pinErrorMessage');
  if (err) {
    err.style.display = 'block';
    setTimeout(() => { err.style.display = 'none'; }, 3000);
  }
}

// =============================================================================
// SECURITY LOG
// =============================================================================

function logSecurityEvent(eventType, details = {}) {
  const logs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]');
  logs.push({
    id:        'LOG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    datetime:  new Date().toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true }),
    eventType,
    severity:  details.success ? 'info' : 'warning',
    details,
    source:    'Dashboard',
    status:    details.success ? '✅ Success' : '⚠️ Failed'
  });
  if (logs.length > 500) logs.shift();
  localStorage.setItem('binbot_security_logs', JSON.stringify(logs));
  console.log(`📋 Security: ${eventType}`, details);
}

// =============================================================================
// SETTINGS CONTROLS
// =============================================================================

function switchSettingsTab(tabName) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
  event.target.classList.add('active');
}

function switchSettingsTabDirect(tabName) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.settings-tab-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && tabName === 'sensors') || (i === 1 && tabName === 'health'));
  });
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
}

function updateCameraThreshold(value)  { document.getElementById('cameraThresholdValue').textContent  = value + '%'; }
function updateBioThreshold(value)     { document.getElementById('bioThresholdValue').textContent     = value + '%'; }
function updateNonBioThreshold(value)  { document.getElementById('nonBioThresholdValue').textContent  = value + '%'; }
function updateGasThreshold(value)     { document.getElementById('gasThresholdValue').textContent     = value + ' PPM'; }

function resetToDefaults() {
  if (!confirm('Reset all settings to defaults?')) return;
  const defaults = { cameraThreshold: 85, bioThreshold: 80, nonBioThreshold: 80, gasThreshold: 300 };
  Object.entries(defaults).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  updateCameraThreshold(85);
  updateBioThreshold(80);
  updateNonBioThreshold(80);
  updateGasThreshold(300);
}

function saveSettings() {
  const settings = {
    cameraThreshold: document.getElementById('cameraThreshold')?.value,
    bioThreshold:    document.getElementById('bioThreshold')?.value,
    nonBioThreshold: document.getElementById('nonBioThreshold')?.value,
    gasThreshold:    document.getElementById('gasThreshold')?.value,
    timestamp:       new Date().toISOString()
  };
  localStorage.setItem('binbotSettings', JSON.stringify(settings));
  showToast('✅ Settings saved!', 'success');
  console.log('Settings saved:', settings);
  closeSettings();
}

// =============================================================================
// ADMIN BIN UNLOCK
// =============================================================================

function unlockLockedBin(category) {
  const categoryNames = { bio: 'Biodegradable', nonbio: 'Non-Biodegradable' };
  const name          = categoryNames[category] || category;

  if (!binLockState[category]) {
    showSuccessModal(`ℹ️ ${name} bin is not locked.`);
    return;
  }

  const pin = prompt('🔐 Enter your 4-digit PIN to unlock this bin:\n(Supervisor or Collector only)');
  if (!pin) return;

  if (pin.length !== 4 || isNaN(pin)) {
    showSuccessModal('❌ Invalid PIN! Must be 4 digits.');
    logSecurityEvent('bin_unlock_invalid_pin', { category, success: false });
    return;
  }

  const adminUsers = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  const validUser  = adminUsers.find(u =>
    (u.role === 'Supervisor' || u.role === 'Collector') && u.password === pin
  );

  if (!validUser) {
    showSuccessModal('❌ Access Denied!\n\nOnly Supervisor and Collector accounts can unlock bins.');
    logSecurityEvent('bin_unlock_failed', { category, success: false, reason: 'Invalid PIN or role' });
    return;
  }

  if (confirm(`✅ Welcome, ${validUser.name}!\n\n🔓 Unlock ${name} Bin?\n\nOnly do this after emptying the bin.`)) {
    binLockState[category] = false;
    updateLidButtonState(category, false);
    showSuccessModal(`✅ ${name} bin unlocked by ${validUser.name}!\n\nLid can now be opened normally.`);
    logSecurityEvent('bin_manually_unlocked', {
      category, categoryName: name, unlockedBy: validUser.name, userRole: validUser.role, success: true
    });
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTimeBubble();
  initializeSlider();
  updateSlider();

  createParticles('.particle-container', 16, true);
  createParticles('body', 22, false);

  if (monthSlides.length > 0) {
    monthSlides[currentMonthIndex].classList.add('active');
    if (monthTitle) monthTitle.textContent = monthSlides[currentMonthIndex].dataset.month;
  }

  updateTrendChart();
  startRealtimePolling(); // attaches Firebase listeners, including camera detection

  document.querySelector('a[href="#settings"]')?.addEventListener('click', e => {
    e.preventDefault();
    openSettings();
  });

  switchSettingsTabDirect('sensors');

  console.log('✅ Binbot dashboard initialized — MANUAL LID MODE | Hazardous REMOVED');
  console.log('🔥 Data source: Firebase Realtime Database');
});

window.addEventListener('beforeunload', stopRealtimePolling);
window.addEventListener('resize', () => updateTrendChart());