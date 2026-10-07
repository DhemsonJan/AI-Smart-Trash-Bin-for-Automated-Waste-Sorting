// ============================================================================
// admin.js — Binbot Admin Console
//
// DATA POLICY:
//   • June (this year) is backed by deterministically generated demo data
//     (same seed = same numbers every load) instead of Firebase — but it is
//     displayed identically to real months, with no distinguishing label.
//   • Every other month is real: a month is "Live" the moment its real-world
//     date arrives (a completed past month and the current month both count
//     as Live); a month that hasn't started yet is "Upcoming" and shows no
//     data at all until it begins.
//   • Access is restricted to Admin and Manager accounts. ("Manager" is
//     shown in this UI but stored internally as role "Supervisor" so the
//     same account also unlocks the main dashboard's settings panel.)
// ============================================================================

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SIMULATED_MONTH_INDEX = 5; // June — the one deliberately-fake demo month
const FAKE_LABELS = ['Bottle(Recyclable)','Cup(Biodegradable)','Can(Recyclable)','Paper(Biodegradable)',
                      'Plastic(Recyclable)','Leaves(Biodegradable)','Eggshell(Biodegradable)','Styro(Recyclable)','Glass(Recyclable)'];

const today = new Date();
const CURRENT_YEAR  = today.getFullYear();
const CURRENT_MONTH = today.getMonth(); // 0-indexed

let selectedMonthIndex = CURRENT_MONTH;
let selectedYear       = CURRENT_YEAR;

// Live caches populated by Firebase listeners
const live = {
  sensors: null,
  chart: {},          // { 'YYYY-MM-DD': {bio_fill, nonbio_fill} }
  detections: [],      // [{id, label, category, confidence, timestamp}]
  lastCommand: null,
  esp32Online: false,
  camOnline: false
};

let lastSeenDetectionId = null;
let analyticsChartInstance = null;

// ── Small helpers ─────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const isCurrentMonth = (m, y) => m === CURRENT_MONTH && y === CURRENT_YEAR;
// A month counts as "arrived" (Live) once its real-world start date has passed —
// covers the current month AND any already-completed month in the same year.
const hasArrived = (m, y) => y < CURRENT_YEAR || (y === CURRENT_YEAR && m <= CURRENT_MONTH);
const isSimulatedMonth = (m, y) => m === SIMULATED_MONTH_INDEX && y === CURRENT_YEAR;
// dataState decides WHERE the numbers come from: 'simulated' | 'live' | 'upcoming'
function dataState(m, y) {
  if (isSimulatedMonth(m, y)) return 'simulated';
  return hasArrived(m, y) ? 'live' : 'upcoming';
}
// displayState decides what the UI SHOWS — simulated months are visually
// indistinguishable from real Live ones, on purpose.
function displayState(m, y) {
  const s = dataState(m, y);
  return s === 'simulated' ? 'live' : s;
}
// "Manager" is how role "Supervisor" is displayed in this console.
const roleLabel = role => role === 'Supervisor' ? 'Manager' : role;

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function fakeDayFill(year, monthIndex, day) {
  const seed = year * 10000 + (monthIndex + 1) * 100 + day;
  return {
    bio_fill:    Math.round(22 + seededRandom(seed) * 55),
    nonbio_fill: Math.round(28 + seededRandom(seed + 0.37) * 58)
  };
}

function fakeDayDetections(year, monthIndex, day) {
  const seed  = year * 10000 + (monthIndex + 1) * 100 + day + 0.71;
  const count = 1 + Math.floor(seededRandom(seed) * 4); // 1-4 events
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 3.1;
    const label = FAKE_LABELS[Math.floor(seededRandom(s) * FAKE_LABELS.length)];
    const hour  = Math.floor(seededRandom(s + 1) * 14) + 7; // 7am-9pm
    const min   = Math.floor(seededRandom(s + 2) * 60);
    const conf  = Math.round((0.55 + seededRandom(s + 3) * 0.43) * 100) / 100;
    out.push({
      label,
      category: resolveCategory(label),
      confidence: conf,
      timestamp: new Date(year, monthIndex, day, hour, min).getTime()
    });
  }
  return out;
}

function resolveCategory(rawLabel) {
  const m = String(rawLabel).match(/\(([^)]+)\)/);
  const inner = m ? m[1].toLowerCase() : '';
  if (inner.includes('non-biodegradable') || inner.includes('recyclable')) return 'Non-Biodegradable';
  if (inner.includes('biodegradable')) return 'Biodegradable';
  return 'Unknown';
}

function showToast(msg, type = 'info') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ============================================================================
// SECURITY LOG + USERS (shared localStorage schema with main dashboard)
// ============================================================================

function logSecurityEvent(eventType, details = {}) {
  const logs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]');
  logs.push({
    id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    timestamp: new Date().toISOString(),
    datetime: new Date().toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true }),
    eventType,
    severity: details.success ? 'info' : 'warning',
    details,
    source: 'AdminConsole',
    status: details.success ? '✅ Success' : '⚠️ Failed'
  });
  if (logs.length > 500) logs.shift();
  localStorage.setItem('binbot_security_logs', JSON.stringify(logs));
  renderSecurityLog();
}

function getUsers() { return JSON.parse(localStorage.getItem('binbot_users') || '[]'); }
function saveUsers(u) { localStorage.setItem('binbot_users', JSON.stringify(u)); }

function bootstrapDefaultAdmin() {
  const users = getUsers();
  if (users.length === 0) {
    saveUsers([{ id: 'admin_default', name: 'Administrator', role: 'Admin', password: '1234' }]);
    document.getElementById('pinHint').textContent += ' First run: default PIN is 1234 — add your own account, then remove this one.';
  }
}

function addUser() {
  const name = document.getElementById('newUserName').value.trim();
  const role = document.getElementById('newUserRole').value;
  const pin  = document.getElementById('newUserPin').value.trim();

  if (!name) return showToast('Enter a name', 'error');
  if (!/^\d{4}$/.test(pin)) return showToast('PIN must be exactly 4 digits', 'error');

  const users = getUsers();
  users.push({ id: 'user_' + Date.now(), name, role, password: pin });
  saveUsers(users);

  document.getElementById('newUserName').value = '';
  document.getElementById('newUserPin').value  = '';
  renderUsersTable();
  logSecurityEvent('USER_ADDED', { success: true, name, role });
  showToast(`${name} added as ${roleLabel(role)}`, 'success');
}

function deleteUser(id) {
  const users = getUsers();
  const target = users.find(u => u.id === id);
  const admins = users.filter(u => u.role === 'Admin');
  if (target?.role === 'Admin' && admins.length <= 1) {
    return showToast('Cannot delete the only remaining Admin', 'error');
  }
  if (!confirm(`Remove ${target?.name}?`)) return;
  saveUsers(users.filter(u => u.id !== id));
  renderUsersTable();
  logSecurityEvent('USER_REMOVED', { success: true, name: target?.name, role: target?.role });
  showToast('User removed', 'success');
}

function renderUsersTable() {
  const body = document.getElementById('usersTableBody');
  const users = getUsers();
  body.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td><span class="chip ${u.role === 'Supervisor' ? 'manager' : u.role.toLowerCase()}">${roleLabel(u.role)}</span></td>
      <td class="mono dim">••••</td>
      <td><button class="btn danger" style="padding:0.3rem 0.7rem;font-size:0.75rem;" onclick="deleteUser('${u.id}')">Remove</button></td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="dim">No accounts yet.</td></tr>`;
}

function renderSecurityLog() {
  const body = document.getElementById('secLogTableBody');
  const logs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]').slice(-100).reverse();
  body.innerHTML = logs.map(l => `
    <tr>
      <td class="mono dim">${l.datetime}</td>
      <td>${l.eventType}</td>
      <td><span class="chip ${l.details?.success ? 'ok' : 'fail'}">${l.status}</span></td>
    </tr>
  `).join('') || `<tr><td colspan="3" class="dim">No events logged yet.</td></tr>`;
}

// ============================================================================
// PIN GATE
// ============================================================================

function wirePinInputs() {
  const ids = ['ap1','ap2','ap3','ap4'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '').slice(0, 1);
      if (el.value && i < 3) document.getElementById(ids[i+1]).focus();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !el.value && i > 0) document.getElementById(ids[i-1]).focus();
      if (e.key === 'Enter') verifyAdminPin();
    });
  });
}

function verifyAdminPin() {
  const pin = ['ap1','ap2','ap3','ap4'].map(id => document.getElementById(id).value).join('');
  if (pin.length !== 4) return showPinError();

  const users = getUsers();
  const authorized = users.find(u => (u.role === 'Admin' || u.role === 'Supervisor') && u.password === pin);

  if (authorized) {
    document.getElementById('pinGate').classList.add('hidden');
    document.getElementById('loggedInAs').textContent = `${authorized.name} · ${roleLabel(authorized.role)}`;
    document.getElementById('userAvatar').textContent = authorized.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    logSecurityEvent('ADMIN_LOGIN_SUCCESS', { success: true, name: authorized.name, role: authorized.role });
    initAdminApp();
    return;
  }

  // A correct PIN that belongs to a Collector account is a different case
  // than a wrong PIN — worth telling them exactly why they're locked out.
  const unauthorized = users.find(u => u.role === 'Collector' && u.password === pin);
  if (unauthorized) {
    logSecurityEvent('ADMIN_LOGIN_DENIED_ROLE', { success: false, name: unauthorized.name, role: unauthorized.role });
    return showPinError('Collector accounts cannot access the admin console.');
  }

  logSecurityEvent('ADMIN_LOGIN_FAILED', { success: false });
  showPinError();
}

function showPinError(message) {
  const err = document.getElementById('pinError');
  err.textContent = message || '❌ Invalid PIN. Try again.';
  err.style.display = 'block';
  ['ap1','ap2','ap3','ap4'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ap1').focus();
  setTimeout(() => err.style.display = 'none', 3000);
}

function adminLogout() {
  logSecurityEvent('ADMIN_LOGOUT', { success: true });
  document.getElementById('pinGate').classList.remove('hidden');
  document.getElementById('loggedInAs').textContent = 'Not signed in';
  document.getElementById('userAvatar').textContent = '—';
  ['ap1','ap2','ap3','ap4'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ap1').focus();
}

// ============================================================================
// NAVIGATION
// ============================================================================

const SECTION_META = {
  overview:   ['Overview', 'Live system status'],
  analytics:  ['Monthly Analytics', 'Every month runs on real data — it simply activates once its date arrives'],
  detections: ['Detection Log', 'Camera classification history'],
  lids:       ['Lid Control', 'Manual open/close commands to the ESP32-S3'],
  users:      ['Users & Security', 'Staff accounts and the security audit trail']
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const sec = item.dataset.section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + sec).classList.add('active');
    const [title, sub] = SECTION_META[sec];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = sub;
  });
});

// ============================================================================
// FIREBASE LISTENERS
// ============================================================================

function setupLiveListeners() {
  db.ref('binbot/sensors').on('value', snap => {
    const data = snap.val();
    if (!data) return;
    live.sensors = data;

    const age = Date.now() - (data.last_seen || 0);
    live.esp32Online = data.last_seen > 0 && age < 8000;
    updateStatusPill('esp32Dot', 'esp32Text', live.esp32Online, 'ESP32');

    updateOverview(data);
    updateLidPanel(data);
  });

  db.ref('binbot/camStatus').on('value', snap => {
    const data = snap.val();
    const age = Date.now() - (data?.last_seen || 0);
    live.camOnline = data?.last_seen > 0 && age < 8000;
    updateStatusPill('camDot', 'camText', live.camOnline, 'CAM');
  });

  db.ref('binbot/chart').on('value', snap => {
    live.chart = snap.val() || {};
    if (isCurrentMonth(selectedMonthIndex, selectedYear)) renderAnalytics();
  });

  db.ref('binbot/command').on('value', snap => {
    live.lastCommand = snap.val();
    const el = document.getElementById('statPendingCmd');
    if (live.lastCommand) {
      el.textContent = `${live.lastCommand.action} → ${live.lastCommand.compartment}`;
    } else {
      el.textContent = 'None';
    }
  });

  // Live detections: display + persist to binbot/detectionLog + append to local cache
  db.ref('binbot/detection').on('value', snap => {
    const d = snap.val();
    if (!d || !d.id || d.id === lastSeenDetectionId) return;
    lastSeenDetectionId = d.id;

    const entry = {
      label: d.label,
      category: resolveCategory(d.label),
      confidence: d.confidence,
      timestamp: d.timestamp || Date.now()
    };

    document.getElementById('statLastDetect').textContent = entry.category;
    document.getElementById('statLastDetectConf').textContent = `${Math.round((entry.confidence||0)*100)}% confidence`;

    db.ref('binbot/detectionLog').push(entry).catch(err => console.warn('detectionLog write failed:', err.message));
  });

  // Real detection history (this is what makes the current month's log genuinely real).
  // Always re-render on new data — cheap DOM update, and avoids showing a stale
  // table the first time the person switches to this tab.
  db.ref('binbot/detectionLog').limitToLast(1000).on('value', snap => {
    const raw = snap.val() || {};
    live.detections = Object.values(raw).sort((a, b) => a.timestamp - b.timestamp);
    renderDetectionLog();
  });
}

function updateStatusPill(dotId, textId, online, label) {
  document.getElementById(dotId).classList.toggle('on', online);
  document.getElementById(textId).textContent = `${label} ${online ? 'Online' : 'Offline'}`;
}

function updateOverview(data) {
  const bio    = data.fill_bio    || 0;
  const nonbio = data.fill_nonbio || 0;
  document.getElementById('statBioFill').textContent    = bio + '%';
  document.getElementById('statNonbioFill').textContent = nonbio + '%';

  drawRing('ringBio', bio, '#4CAF50');
  drawRing('ringNonbio', nonbio, '#3b82f6');

  const gasBio = data.gas_bio_pct || 0, gasNonbio = data.gas_nonbio_pct || 0;
  document.getElementById('gasBioPct').textContent = gasBio + '%';
  document.getElementById('gasNonbioPct').textContent = gasNonbio + '%';
  document.getElementById('gasBioBar').style.width = gasBio + '%';
  document.getElementById('gasNonbioBar').style.width = gasNonbio + '%';

  document.getElementById('sysIP').textContent = data.ip || '—';
  document.getElementById('sysFirmware').textContent = data.firmware || '—';
  const uptimeMs = data.uptime_ms || 0;
  const s = Math.floor(uptimeMs/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  document.getElementById('sysUptime').textContent = uptimeMs ? `${h}h ${m}m` : '—';
}

function updateLidPanel(data) {
  document.getElementById('lidStateBio').textContent    = data.lid_bio_open    ? '🔓 Open' : '🔒 Closed';
  document.getElementById('lidStateNonbio').textContent = data.lid_nonbio_open ? '🔓 Open' : '🔒 Closed';
}

function drawRing(canvasId, pct, color) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const size = 130, cx = size/2, cy = size/2, r = 52, lw = 10;
  ctx.clearRect(0, 0, size, size);

  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(226,232,240,0.1)'; ctx.stroke();

  const end = -Math.PI/2 + (pct/100) * Math.PI*2;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, end);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 22px Space Grotesk, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pct + '%', cx, cy);
}

// ============================================================================
// LID COMMANDS
// ============================================================================

async function adminSendCommand(action, compartment) {
  try {
    await db.ref('binbot/command').set({
      id: Date.now().toString() + '_' + Math.random().toString(36).slice(2,7),
      action, compartment, source: 'manual', pending: true, created_at: Date.now()
    });
    showToast(`${action.replace('_',' ')} → ${compartment} sent`, 'success');
    logSecurityEvent('ADMIN_LID_COMMAND', { success: true, action, compartment });
  } catch (err) {
    showToast('Command failed — check connection', 'error');
    logSecurityEvent('ADMIN_LID_COMMAND', { success: false, action, compartment, error: err.message });
  }
}

// ============================================================================
// TIMELINE RAIL + MONTHLY ANALYTICS
// ============================================================================

function renderTimelineRail() {
  const rail = document.getElementById('timelineRail');
  const nodesHtml = MONTH_NAMES.map((name, i) => {
    const state = displayState(i, CURRENT_YEAR);
    const isNow = isCurrentMonth(i, CURRENT_YEAR);
    const sel   = i === selectedMonthIndex && CURRENT_YEAR === selectedYear;
    const badgeText = state === 'live' ? 'Live' : 'Upcoming';
    return `
      <div class="month-node ${state} ${isNow ? 'current' : ''} ${sel ? 'selected' : ''}" data-month="${i}" onclick="selectMonth(${i}, ${CURRENT_YEAR})">
        <span class="rail-badge">${badgeText}</span>
        <div class="node-dot"></div>
        <div class="rail-label">${name.slice(0,3)}</div>
      </div>`;
  }).join('');

  const elapsedPct = ((CURRENT_MONTH + 1) / 12) * 100;
  rail.innerHTML = `<div class="rail-track"><div class="rail-progress" style="width:${elapsedPct}%"></div></div>` + nodesHtml;
}

function selectMonth(monthIndex, year) {
  selectedMonthIndex = monthIndex;
  selectedYear = year;
  renderTimelineRail();
  renderAnalytics();
  populateDetectMonthFilter();
  document.getElementById('detectMonthFilter').value = `${year}-${monthIndex}`;
  renderDetectionLog();
}

function renderAnalytics() {
  const dState = dataState(selectedMonthIndex, selectedYear);
  const dispState = displayState(selectedMonthIndex, selectedYear);
  const isNow = isCurrentMonth(selectedMonthIndex, selectedYear);
  document.getElementById('analyticsMonthLabel').textContent = `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`;
  const badge = document.getElementById('analyticsBadge');
  badge.textContent = dispState === 'live' ? '🟢 Live' : '⏳ Upcoming';
  badge.className = 'badge ' + dispState;

  const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const rows = [];

  for (let d = 1; d <= daysInMonth; d++) {
    if (dState === 'simulated') {
      const f = fakeDayFill(selectedYear, selectedMonthIndex, d);
      rows.push({ day: d, bio: f.bio_fill, nonbio: f.nonbio_fill, status: 'Live' });
      continue;
    }
    if (dState === 'upcoming') {
      rows.push({ day: d, bio: null, nonbio: null, status: 'Upcoming' });
      continue;
    }
    if (isNow && d > today.getDate()) {
      rows.push({ day: d, bio: null, nonbio: null, status: 'Upcoming' });
      continue;
    }
    const rec = live.chart[dateKey(selectedYear, selectedMonthIndex, d)];
    rows.push(rec
      ? { day: d, bio: rec.bio_fill, nonbio: rec.nonbio_fill, status: 'Live' }
      : { day: d, bio: null, nonbio: null, status: 'No reading recorded' });
  }

  const emptyState = document.getElementById('analyticsEmptyState');
  if (emptyState) emptyState.remove();
  if (dispState === 'upcoming') {
    document.getElementById('analyticsChart').insertAdjacentHTML('beforebegin',
      `<div id="analyticsEmptyState" class="stat-sub" style="text-align:center;padding:1.2rem;">This month hasn't started yet — data will begin populating automatically on ${MONTH_NAMES[selectedMonthIndex]} 1, ${selectedYear}.</div>`);
  }

  const valid = rows.filter(r => r.bio !== null);
  const allFills = valid.flatMap(r => [r.bio, r.nonbio]);
  const avg  = allFills.length ? Math.round(allFills.reduce((a,b)=>a+b,0)/allFills.length) : 0;
  const peak = allFills.length ? Math.max(...allFills) : 0;
  const low  = allFills.length ? Math.min(...allFills) : 0;

  document.getElementById('anAvg').textContent  = allFills.length ? avg + '%' : '—';
  document.getElementById('anPeak').textContent = allFills.length ? peak + '%' : '—';
  document.getElementById('anLow').textContent  = allFills.length ? low + '%' : '—';
  document.getElementById('anDays').textContent = valid.length + ' / ' + daysInMonth;

  const chipStyle = s => s === 'Live' ? 'ok' : '';
  document.getElementById('analyticsTableBody').innerHTML = rows.map(r => `
    <tr>
      <td>${MONTH_NAMES[selectedMonthIndex].slice(0,3)} ${r.day}</td>
      <td>${r.bio  !== null ? r.bio  + '%' : '<span class="dim">—</span>'}</td>
      <td>${r.nonbio !== null ? r.nonbio + '%' : '<span class="dim">—</span>'}</td>
      <td><span class="chip ${chipStyle(r.status)}">${r.status}</span></td>
    </tr>
  `).join('');

  const ctx = document.getElementById('analyticsChart').getContext('2d');
  if (analyticsChartInstance) analyticsChartInstance.destroy();
  analyticsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.day),
      datasets: [
        { label: 'Biodegradable', data: rows.map(r => r.bio), borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.12)', fill: true, tension: 0.35, spanGaps: true },
        { label: 'Non-Biodegradable', data: rows.map(r => r.nonbio), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', fill: true, tension: 0.35, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
        y: { min: 0, max: 100, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
      }
    }
  });
}

// ============================================================================
// DETECTION LOG
// ============================================================================

function populateDetectMonthFilter() {
  const sel = document.getElementById('detectMonthFilter');
  const labelFor = state => state === 'live' ? '(Live)' : '(Upcoming)';
  sel.innerHTML = MONTH_NAMES.map((name, i) =>
    `<option value="${CURRENT_YEAR}-${i}">${name} ${CURRENT_YEAR} ${labelFor(displayState(i, CURRENT_YEAR))}</option>`
  ).join('');
  sel.onchange = () => {
    const [y, m] = sel.value.split('-').map(Number);
    selectedYear = y; selectedMonthIndex = m;
    renderTimelineRail();
    renderDetectionLog();
  };
}

function renderDetectionLog() {
  const dState = dataState(selectedMonthIndex, selectedYear);
  const dispState = displayState(selectedMonthIndex, selectedYear);
  const badge = document.getElementById('detectBadge');
  badge.textContent = dispState === 'live' ? '🟢 Live' : '⏳ Upcoming';
  badge.className = 'badge ' + dispState;

  if (dState === 'upcoming') {
    document.getElementById('detectTableBody').innerHTML =
      `<tr><td colspan="4" class="dim">This month hasn't started yet — real detection events will appear here once it begins.</td></tr>`;
    return;
  }

  let events;
  if (dState === 'simulated') {
    const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
    events = [];
    for (let d = 1; d <= daysInMonth; d++) events.push(...fakeDayDetections(selectedYear, selectedMonthIndex, d));
    events.sort((a, b) => b.timestamp - a.timestamp);
  } else {
    const monthStart = new Date(selectedYear, selectedMonthIndex, 1).getTime();
    const monthEnd   = new Date(selectedYear, selectedMonthIndex + 1, 1).getTime();
    events = live.detections
      .filter(e => e.timestamp >= monthStart && e.timestamp < monthEnd)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  document.getElementById('detectTableBody').innerHTML = events.map(e => `
    <tr>
      <td class="mono dim">${new Date(e.timestamp).toLocaleString()}</td>
      <td>${e.label}</td>
      <td><span class="chip ${e.category === 'Biodegradable' ? 'bio' : 'nonbio'}">${e.category}</span></td>
      <td>${Math.round((e.confidence||0)*100)}%</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="dim">No detections recorded yet for this month.</td></tr>`;
}

// ============================================================================
// INIT
// ============================================================================

function initAdminApp() {
  document.getElementById('todayLabel').textContent = today.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  renderTimelineRail();
  renderAnalytics();
  populateDetectMonthFilter();
  renderDetectionLog();
  renderUsersTable();
  renderSecurityLog();
  setupLiveListeners();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pinHint').textContent = 'Only Admin and Manager accounts can access this console.';
  bootstrapDefaultAdmin();
  wirePinInputs();
  document.getElementById('ap1').focus();
});