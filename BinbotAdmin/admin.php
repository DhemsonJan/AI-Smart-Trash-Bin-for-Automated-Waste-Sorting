<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Binbot Admin Console</title>
<link rel="stylesheet" href="admin.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

<!-- ══════════════════════════ PIN GATE ══════════════════════════ -->
<div class="pin-gate" id="pinGate">
  <div class="pin-box">
    <div class="pin-lock-badge">🔐</div>
    <h2 class="text-grad">Admin Console</h2>
    <p>Admin &amp; Manager access only</p>
    <div class="pin-inputs">
      <input type="password" maxlength="1" inputmode="numeric" id="ap1">
      <input type="password" maxlength="1" inputmode="numeric" id="ap2">
      <input type="password" maxlength="1" inputmode="numeric" id="ap3">
      <input type="password" maxlength="1" inputmode="numeric" id="ap4">
    </div>
    <button class="btn primary" style="width:100%" onclick="verifyAdminPin()">Unlock Console</button>
    <div class="pin-error" id="pinError">❌ Invalid PIN. Try again.</div>
    <div class="pin-hint" id="pinHint"></div>
  </div>
</div>

<!-- ══════════════════════════ SIDEBAR ══════════════════════════ -->
<aside class="admin-sidebar">
  <div class="brand-row">
    <div class="brand-mark">🗑️</div>
    <div class="brand">Binbot<br>Admin</div>
  </div>
  <div class="brand-sub">Control Console</div>

  <div class="nav-item active" data-section="overview">📊 Overview</div>
  <div class="nav-item" data-section="analytics">📅 Monthly Analytics</div>
  <div class="nav-item" data-section="detections">📷 Detection Log</div>
  <div class="nav-item" data-section="lids">🚪 Lid Control</div>
  <div class="nav-item" data-section="users">🔐 Users &amp; Security</div>

  <div class="sidebar-footer">
    <div class="user-chip">
      <div class="user-avatar" id="userAvatar">—</div>
      <span id="loggedInAs">Not signed in</span>
    </div>
    <button class="btn-logout" onclick="adminLogout()">Lock Console</button>
  </div>
</aside>

<!-- ══════════════════════════ MAIN ══════════════════════════ -->
<main class="admin-main">

  <div class="topbar">
    <div>
      <h2 id="pageTitle">Overview</h2>
      <div class="subtitle" id="pageSubtitle">Live system status</div>
    </div>
    <div class="topbar-right">
      <div class="status-pill"><span class="dot" id="esp32Dot"></span><span id="esp32Text">ESP32 Offline</span></div>
      <div class="status-pill"><span class="dot" id="camDot"></span><span id="camText">CAM Offline</span></div>
      <div class="status-pill">🗓️ <span id="todayLabel">—</span></div>
    </div>
  </div>

  <!-- ── OVERVIEW ── -->
  <section class="section active" id="section-overview">
    <div class="grid grid-4" style="margin-bottom:1.2rem;">
      <div class="card"><h3>Bio Fill</h3><div class="stat-num green" id="statBioFill">0%</div><div class="stat-sub">Ultrasonic reading</div></div>
      <div class="card"><h3>Non-Bio Fill</h3><div class="stat-num blue" id="statNonbioFill">0%</div><div class="stat-sub">Ultrasonic reading</div></div>
      <div class="card"><h3>Last Detection</h3><div class="stat-num pink" id="statLastDetect">—</div><div class="stat-sub" id="statLastDetectConf">Waiting…</div></div>
      <div class="card"><h3>Pending Command</h3><div class="stat-num" id="statPendingCmd" style="font-size:1.1rem;">None</div><div class="stat-sub">Last command sent</div></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3>Fill Levels</h3>
        <div class="ring-row">
          <div class="ring-item">
            <canvas id="ringBio" width="130" height="130"></canvas>
            <div class="ring-label">Biodegradable</div>
          </div>
          <div class="ring-item">
            <canvas id="ringNonbio" width="130" height="130"></canvas>
            <div class="ring-label">Non-Biodegradable</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Gas Levels (MQ-135)</h3>
        <div class="gas-row">
          <div class="gas-row-head"><span>🟩 Biodegradable</span><span id="gasBioPct">0%</span></div>
          <div class="gas-track"><div class="gas-fill" id="gasBioBar" style="width:0%;background:linear-gradient(90deg,#4CAF50,#45a049);"></div></div>
        </div>
        <div class="gas-row">
          <div class="gas-row-head"><span>🟦 Non-Biodegradable</span><span id="gasNonbioPct">0%</span></div>
          <div class="gas-track"><div class="gas-fill" id="gasNonbioBar" style="width:0%;background:linear-gradient(90deg,#3b82f6,#2563eb);"></div></div>
        </div>
        <div class="stat-sub" style="margin-top:0.6rem;">System IP: <span id="sysIP">—</span> · Uptime: <span id="sysUptime">—</span> · Firmware: <span id="sysFirmware">—</span></div>
      </div>
    </div>
  </section>

  <!-- ── MONTHLY ANALYTICS ── -->
  <section class="section" id="section-analytics">
    <div class="timeline-rail" id="timelineRail"></div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.6rem;">
        <h3 style="margin:0;" id="analyticsMonthLabel">—</h3>
        <span class="badge" id="analyticsBadge">—</span>
      </div>

      <div class="grid grid-4" style="margin-bottom:1.2rem;">
        <div class="card"><h3>Avg Fill</h3><div class="stat-num blue" id="anAvg">—</div></div>
        <div class="card"><h3>Peak Fill</h3><div class="stat-num pink" id="anPeak">—</div></div>
        <div class="card"><h3>Lowest Fill</h3><div class="stat-num green" id="anLow">—</div></div>
        <div class="card"><h3>Days Recorded</h3><div class="stat-num" id="anDays">—</div></div>
      </div>

      <canvas id="analyticsChart" height="90"></canvas>

      <div class="table-wrap" style="margin-top:1.4rem;">
        <table>
          <thead><tr><th>Day</th><th>Bio Fill</th><th>Non-Bio Fill</th><th>Status</th></tr></thead>
          <tbody id="analyticsTableBody"></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ── DETECTION LOG ── -->
  <section class="section" id="section-detections">
    <div class="card" style="margin-bottom:1.2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
        <h3 style="margin:0;">Filter by month</h3>
        <select id="detectMonthFilter" class="field" style="min-width:180px;"></select>
      </div>
    </div>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="margin:0;">Detection Events</h3>
        <span class="badge" id="detectBadge">—</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>Raw Label</th><th>Category</th><th>Confidence</th></tr></thead>
          <tbody id="detectTableBody"></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ── LID CONTROL ── -->
  <section class="section" id="section-lids">
    <div class="card">
      <h3>Compartment Lids</h3>
      <div class="lid-card" style="background:rgba(76,175,80,0.06); border:1px solid rgba(76,175,80,0.18); border-radius:12px;">
        <div class="lid-meta">
          <span class="lid-emoji">🟩</span>
          <div>
            <div class="lid-name">Biodegradable</div>
            <div class="lid-state" id="lidStateBio">🔒 Closed</div>
          </div>
        </div>
        <div class="lid-actions">
          <button class="btn primary" onclick="adminSendCommand('open_lid','bio')">Open</button>
          <button class="btn danger" onclick="adminSendCommand('close_lid','bio')">Close</button>
        </div>
      </div>
      <div class="lid-card" style="background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.18); border-radius:12px;">
        <div class="lid-meta">
          <span class="lid-emoji">🟦</span>
          <div>
            <div class="lid-name">Non-Biodegradable</div>
            <div class="lid-state" id="lidStateNonbio">🔒 Closed</div>
          </div>
        </div>
        <div class="lid-actions">
          <button class="btn primary" onclick="adminSendCommand('open_lid','nonbio')">Open</button>
          <button class="btn danger" onclick="adminSendCommand('close_lid','nonbio')">Close</button>
        </div>
      </div>
      <p class="stat-sub" style="margin-top:1rem;">Commands are written to Firebase (<code>binbot/command</code>) and picked up by the ESP32-S3 within ~1 second. Lids auto-close after 5 seconds.</p>
    </div>
  </section>

  <!-- ── USERS & SECURITY ── -->
  <section class="section" id="section-users">
    <div class="grid grid-2">
      <div class="card">
        <h3>Staff Accounts</h3>
        <div class="form-row">
          <div class="field"><label>Name</label><input id="newUserName" placeholder="Full name"></div>
          <div class="field"><label>Role</label>
            <select id="newUserRole">
              <option value="Admin">Admin</option>
              <option value="Supervisor">Manager</option>
              <option value="Collector">Collector</option>
            </select>
          </div>
          <div class="field"><label>4-Digit PIN</label><input id="newUserPin" maxlength="4" inputmode="numeric" placeholder="0000"></div>
          <button class="btn primary" onclick="addUser()">Add User</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>PIN</th><th></th></tr></thead>
            <tbody id="usersTableBody"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>Security Log</h3>
        <div class="table-wrap" style="max-height:420px; overflow-y:auto;">
          <table>
            <thead><tr><th>Time</th><th>Event</th><th>Status</th></tr></thead>
            <tbody id="secLogTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

</main>

<!-- Firebase (same project as main dashboard) -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
<script src="Adminfirebase-config.js"></script>
<script src="admin.js"></script>
</body>
</html>