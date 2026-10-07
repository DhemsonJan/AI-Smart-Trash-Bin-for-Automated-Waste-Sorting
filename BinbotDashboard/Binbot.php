<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Binbot – AI Waste Monitor</title>
  <link rel="stylesheet" href="Binbot.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════════════════════
     HEADER
══════════════════════════════════════════════════════════════════════════ -->
<header class="premium-header compact">
  <div class="header-wave-bg"></div>

  <div class="logo-title">
    <h1 class="typing-title" id="mainTitle">Binbot</h1>
    <p class="header-subtitle">AI-Powered Waste Monitoring</p>
  </div>

  <div class="header-content">
    <nav class="header-nav">
      <a href="#home"     class="nav-link active">Home</a>
      <a href="#settings" class="nav-link">Settings</a>
    </nav>
  </div>

  <div class="particle-container" id="particles"></div>
</header>

<!-- ══════════════════════════════════════════════════════════════════════════
     MAIN DASHBOARD
══════════════════════════════════════════════════════════════════════════ -->
<main class="dashboard-layout">

  <div class="top-row">

    <!-- ── LEFT: Camera / Detection ── -->
    <section class="camera-section">
      <div class="image-box" id="imageBox">
        <video id="cameraFeed" autoplay muted style="display:none;width:100%;height:100%;object-fit:cover;"></video>

        <!-- Waiting spinner -->
        <div class="waiting-detection" id="waitingDetection">
          <div class="waiting-content">
            <div class="spinner"></div>
            <p>Waiting for detection…</p>
          </div>
        </div>

        <!-- Detection result -->
        <div class="detection-result-box" id="detectionResult" style="display:none;">
          <div class="detection-image-container">
            <img id="detectionImage" src="" alt="Detected Waste Type" class="detection-image">
            <div class="detection-label">
              <span id="detectionText">Waiting for detection…</span>
              <span id="detectionConfidence" class="confidence-badge"></span>
            </div>
          </div>
        </div>

        <!-- Detection confirmation popup -->
        <div class="detection-popup" id="detectionPopup" style="display:none;">
          <div class="popup-content">
            <p>Is this correct?</p>
            <div class="popup-buttons">
              <button class="btn-yes" onclick="handleDetectionResponse(true)">Yes</button>
              <button class="btn-no"  onclick="handleDetectionResponse(false)">No</button>
            </div>
            <div class="feedback-message" id="feedbackMessage" style="display:none;">
              <span id="feedbackText"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── RIGHT: Slider (4 panels) ── -->
    <div class="slider-section">
      <div class="box-slider-container">
        <div class="box-slider-wrapper" id="boxSlider">

          <!-- ════════════════════════════════════
               BOX 1 · Monthly Summary + Circles
          ════════════════════════════════════ -->
          <div class="box-slide active">
            <div class="box-card">
              <h3>Monthly Summary</h3>

              <div class="calendar-box">
                <div class="calendar-header">
                  <button class="nav-arrow prev" onclick="changeMonth(-1)">←</button>
                  <h3 id="currentMonth">May 2026</h3>
                  <button class="nav-arrow next" onclick="changeMonth(1)">→</button>
                </div>

                <div class="calendar-slider" id="calendarSlider">
                  <div class="calendar-slide" data-month="January 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">35%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">52%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="February 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">33%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">54%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="March 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">38%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">48%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="April 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">36%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">50%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide active" data-month="May 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">40%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">46%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="June 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">32%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">55%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="July 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">39%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">47%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="August 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">37%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">49%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="September 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">34%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">52%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="October 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">38%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">48%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="November 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">36%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">51%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                  <div class="calendar-slide" data-month="December 2026">
                    <div class="month-stats">
                      <div class="stat bio"><div class="stat-content"><div class="stat-icon">🌿</div><div class="stat-info"><span class="label">Biodegradable</span><span class="value">35%</span></div></div></div>
                      <div class="stat nonbio"><div class="stat-content"><div class="stat-icon">♻️</div><div class="stat-info"><span class="label">Non-Biodegradable</span><span class="value">50%</span></div></div></div>
                    </div>
                    <div class="total-waste"><div class="total-label">Total Collected</div><strong>100%</strong></div>
                  </div>
                </div><!-- /calendar-slider -->
              </div><!-- /calendar-box -->

              <!-- Live fill-level circles -->
              <div class="analysis-circles-container">
                <div class="centered-circles" style="flex-direction:row;">
                  <div class="circle-group">
                    <div class="analysis-box" id="biodegradable">
                      <canvas width="160" height="160"></canvas>
                      <div class="circle-percent">0%</div>
                      <div class="circle-summary" id="bioSummary"></div>
                    </div>
                    <div class="circle-label">Bio Fill</div>
                  </div>
                  <div class="circle-group">
                    <div class="analysis-box" id="nonBiodegradable">
                      <canvas width="160" height="160"></canvas>
                      <div class="circle-percent">0%</div>
                      <div class="circle-summary" id="nonBioSummary"></div>
                    </div>
                    <div class="circle-label">Non-Bio Fill</div>
                  </div>
                </div>
              </div>

            </div>
          </div><!-- /box-slide 1 -->

          <!-- ════════════════════════════════════
               BOX 2 · Fill Level Trend Chart
          ════════════════════════════════════ -->
          <div class="box-slide">
            <div class="box-card">
              <div class="chart-header">
                <div>
                  <h3>📊 Fill Level Trend</h3>
                  <p class="subtitle">Daily fill percentage over 30 days — live from ESP32</p>
                </div>
                <div class="chart-info-badge">
                  <span class="info-label">Tracking</span>
                  <span class="info-value">30 Days</span>
                </div>
              </div>

              <div class="chart-container">
                <canvas id="combinedTrendChart"></canvas>
              </div>

              <div class="chart-legend"></div>

              <div class="collection-stats">
                <div class="stat-item">
                  <span class="stat-label">Avg Daily Fill</span>
                  <span class="stat-value" id="statAvg">—</span>
                  <span class="stat-unit">per day</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Peak Fill</span>
                  <span class="stat-value" id="statPeak">—</span>
                  <span class="stat-unit">highest</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Lowest Fill</span>
                  <span class="stat-value" id="statLow">—</span>
                  <span class="stat-unit">lowest</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Days Tracked</span>
                  <span class="stat-value" id="statDays">30</span>
                  <span class="stat-unit">days</span>
                </div>
              </div>

              <div class="trend-insight" id="trendInsight">
                📈 <strong>Trend:</strong> Waiting for live data from ESP32…
              </div>
            </div>
          </div><!-- /box-slide 2 -->

          <!-- ════════════════════════════════════
               BOX 3 · Gas Level Monitor
          ════════════════════════════════════ -->
          <div class="box-slide">
            <div class="box-card">
              <div class="gas-header">
                <div>
                  <h3>💨 Gas Level Monitoring</h3>
                  <p class="subtitle">Real-time MQ-135 readings — fan auto-activates at 80%</p>
                </div>
                <div class="gas-status-badge" id="gasStatusBadge">
                  <span class="badge-label">System</span>
                  <span class="badge-value">Normal</span>
                </div>
              </div>

              <!-- Biodegradable Gas -->
              <div class="gas-monitor-card">
                <div class="gas-card-header">
                  <span class="gas-type-label">🟩 Biodegradable Compartment</span>
                  <span class="gas-reading" id="bioGasReading">— PPM</span>
                </div>
                <div class="gas-threshold-bar">
                  <div class="threshold-marker" style="left:80%;top:-8px;">
                    <span class="threshold-label">Fan ON ⚡</span>
                  </div>
                  <div id="bioLevelBar" class="gas-bar-fill" style="background:linear-gradient(90deg,#4CAF50,#45a049);width:0%;transition:all 0.5s ease;"></div>
                  <span id="bioLevelPercent" class="gas-level-percent">0%</span>
                </div>
                <div class="gas-indicator-status" id="bioGasStatus">
                  <span class="status-icon safe">✓</span>
                  <span class="status-text">Safe Level — Fan OFF</span>
                </div>
              </div>

              <!-- Non-Biodegradable Gas -->
              <div class="gas-monitor-card">
                <div class="gas-card-header">
                  <span class="gas-type-label">🟦 Non-Biodegradable Compartment</span>
                  <span class="gas-reading" id="nonBioGasReading">— PPM</span>
                </div>
                <div class="gas-threshold-bar">
                  <div class="threshold-marker" style="left:80%;top:-8px;">
                    <span class="threshold-label">Fan ON ⚡</span>
                  </div>
                  <div id="nonBioLevelBar" class="gas-bar-fill" style="background:linear-gradient(90deg,#3b82f6,#2563eb);width:0%;transition:all 0.5s ease;"></div>
                  <span id="nonBioLevelPercent" class="gas-level-percent">0%</span>
                </div>
                <div class="gas-indicator-status" id="nonBioGasStatus">
                  <span class="status-icon safe">✓</span>
                  <span class="status-text">Safe Level — Fan OFF</span>
                </div>
              </div>

              <!-- Gas System Info -->
              <div class="gas-system-info">
                <div class="info-item">
                  <span class="info-icon">⚡</span>
                  <div>
                    <span class="info-title">Fan Activation</span>
                    <span class="info-detail">Triggers at 80% gas level</span>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">🌡️</span>
                  <div>
                    <span class="info-title">Sensor</span>
                    <span class="info-detail">MQ-135 Air Quality</span>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">📊</span>
                  <div>
                    <span class="info-title">Last Updated</span>
                    <span class="info-detail" id="gasLastUpdated">Waiting…</span>
                  </div>
                </div>
              </div>
            </div>
          </div><!-- /box-slide 3 -->

          <!-- ════════════════════════════════════
               BOX 4 · Manual Lid Control
          ════════════════════════════════════ -->
          <div class="box-slide">
            <div class="box-card">
              <div class="manual-control-header">
                <div>
                  <h3>🚪 Manual Lid Control</h3>
                  <p class="subtitle">Open/close individual compartment lids via ESP32</p>
                </div>
              </div>

              <!-- Biodegradable Lid -->
              <div class="manual-control-card">
                <div class="control-header">
                  <h4>🟩 Biodegradable</h4>
                  <span class="lid-indicator" id="bioLidIndicator">🔒 Closed</span>
                </div>
                <div class="control-buttons manual-controls-bio">
                  <button class="btn-control btn-open" onclick="openLid('bio')">
                    <span class="btn-icon">📂</span>
                    <span class="btn-label">Open</span>
                  </button>
                  <button class="btn-control btn-close active" onclick="closeLid('bio')">
                    <span class="btn-icon">📁</span>
                    <span class="btn-label">Close</span>
                  </button>
                </div>
              </div>

              <!-- Non-Biodegradable Lid -->
              <div class="manual-control-card">
                <div class="control-header">
                  <h4>🟦 Non-Biodegradable</h4>
                  <span class="lid-indicator" id="nonbioLidIndicator">🔒 Closed</span>
                </div>
                <div class="control-buttons manual-controls-nonbio">
                  <button class="btn-control btn-open" onclick="openLid('nonbio')">
                    <span class="btn-icon">📂</span>
                    <span class="btn-label">Open</span>
                  </button>
                  <button class="btn-control btn-close active" onclick="closeLid('nonbio')">
                    <span class="btn-icon">📁</span>
                    <span class="btn-label">Close</span>
                  </button>
                </div>
              </div>

              <div class="manual-control-info">
                <p>💡 <strong>Note:</strong> Lids auto-close after 5 seconds. Bins auto-lock at 100% full.</p>
              </div>
            </div>
          </div><!-- /box-slide 4 -->

        </div><!-- /box-slider-wrapper -->

        <button class="slider-arrow prev" onclick="moveSlide(-1)">←</button>
        <button class="slider-arrow next" onclick="moveSlide(1)">→</button>
      </div>
    </div><!-- /slider-section -->

  </div><!-- /top-row -->

  <!-- ══════════════════════════════════════════════════════════════════════
       SETTINGS PANEL
  ══════════════════════════════════════════════════════════════════════ -->
  <div class="settings-panel" id="settingsPanel">

    <!-- PIN Unlock Screen -->
    <div class="pin-unlock-screen" id="pinUnlockScreen">
      <div class="pin-unlock-content">
        <h2>🔐 Unlock Settings</h2>
        <p>Enter your 4-digit PIN to access settings</p>
        <div class="pin-input-container">
          <input type="password" id="pinInput1" class="pin-input" maxlength="1" inputmode="numeric" placeholder="•" onkeyup="handlePinInput(event,1)">
          <input type="password" id="pinInput2" class="pin-input" maxlength="1" inputmode="numeric" placeholder="•" onkeyup="handlePinInput(event,2)">
          <input type="password" id="pinInput3" class="pin-input" maxlength="1" inputmode="numeric" placeholder="•" onkeyup="handlePinInput(event,3)">
          <input type="password" id="pinInput4" class="pin-input" maxlength="1" inputmode="numeric" placeholder="•" onkeyup="handlePinInput(event,4)">
        </div>
        <button class="btn-unlock-pin" onclick="verifyPin()">🔓 Unlock</button>
        <div class="pin-error-message" id="pinErrorMessage" style="display:none;">❌ Invalid PIN. Please try again.</div>
        <p class="pin-hint">ℹ️ Use your Supervisor or Collector PIN</p>
      </div>
    </div>

    <!-- Settings Content -->
    <div class="settings-content" id="settingsContentPanel" style="display:none;">
      <button class="settings-close" onclick="closeSettings()">✕</button>
      <h2 class="settings-title">System Settings</h2>

      <div class="settings-tabs">
        <button class="settings-tab-btn active" onclick="switchSettingsTab('sensors')">Sensors</button>
        <button class="settings-tab-btn"        onclick="switchSettingsTab('health')">Health &amp; Security</button>
      </div>

      <!-- ── Sensors Tab ── -->
      <div id="sensors-tab" class="settings-tab active">
        <div class="settings-section">

          <!-- Camera -->
          <div class="sensor-card">
            <div class="sensor-header">
              <h3>📷 Camera Detection</h3>
              <span class="sensor-status healthy">Active</span>
            </div>
            <p class="sensor-description">AI-powered detection accuracy for waste classification</p>
            <div class="setting-control">
              <label>Detection Confidence Threshold</label>
              <div class="slider-container">
                <input type="range" min="50" max="99" value="85" class="settings-slider" id="cameraThreshold" onchange="updateCameraThreshold(this.value)">
                <span class="slider-value" id="cameraThresholdValue">85%</span>
              </div>
            </div>
            <div class="setting-control">
              <label>Camera Resolution</label>
              <select class="settings-select">
                <option selected>640x480 (Default)</option>
                <option>800x600 (Higher Detail)</option>
                <option>1280x720 (Maximum)</option>
              </select>
            </div>
            <div class="setting-info">ℹ️ Higher confidence reduces false positives but may miss some detections.</div>
          </div>

          <!-- Ultrasonic -->
          <div class="sensor-card">
            <div class="sensor-header">
              <h3>📏 Ultrasonic Sensor (HC-SR04)</h3>
              <span class="sensor-status healthy">Active</span>
            </div>
            <p class="sensor-description">Measures fill levels for Bio and Non-Bio compartments</p>
            <div class="setting-control">
              <label>Biodegradable Fill Alert Threshold</label>
              <div class="slider-container">
                <input type="range" min="50" max="100" value="80" class="settings-slider" id="bioThreshold" onchange="updateBioThreshold(this.value)">
                <span class="slider-value" id="bioThresholdValue">80%</span>
              </div>
            </div>
            <div class="setting-control">
              <label>Non-Biodegradable Fill Alert Threshold</label>
              <div class="slider-container">
                <input type="range" min="50" max="100" value="80" class="settings-slider" id="nonBioThreshold" onchange="updateNonBioThreshold(this.value)">
                <span class="slider-value" id="nonBioThresholdValue">80%</span>
              </div>
            </div>
            <div class="setting-info">ℹ️ Lower thresholds trigger alerts sooner.</div>
          </div>

          <!-- Gas Sensor -->
          <div class="sensor-card">
            <div class="sensor-header">
              <h3>💨 Gas Sensor (MQ-135)</h3>
              <span class="sensor-status healthy">Active</span>
            </div>
            <p class="sensor-description">Monitors VOC/air-quality levels and controls ventilation fan</p>
            <div class="setting-control">
              <label>Gas Level Alert Threshold (PPM)</label>
              <div class="slider-container">
                <input type="range" min="100" max="500" value="300" class="settings-slider" id="gasThreshold" onchange="updateGasThreshold(this.value)">
                <span class="slider-value" id="gasThresholdValue">300 PPM</span>
              </div>
            </div>
            <div class="setting-control">
              <label>Fan Activation Mode</label>
              <select class="settings-select">
                <option>Automatic (Smart Control)</option>
                <option selected>Manual Threshold</option>
                <option>Always On</option>
              </select>
            </div>
            <div class="setting-info">ℹ️ Recommended threshold: 250–350 PPM for MQ-135.</div>
          </div>

        </div>
      </div><!-- /sensors-tab -->

      <!-- ── Health & Security Tab ── -->
      <div id="health-tab" class="settings-tab">
        <div class="settings-section">

          <!-- Sensor Maintenance -->
          <div class="health-card">
            <h3>🔧 Sensor Maintenance</h3>
            <div class="maintenance-item">
              <div class="maintenance-info">
                <span class="maintenance-label">Camera Detection</span>
                <span class="maintenance-detail">Last Calibrated: 30 days ago</span>
              </div>
              <button class="btn-calibrate">Calibrate Now</button>
            </div>
            <div class="maintenance-item">
              <div class="maintenance-info">
                <span class="maintenance-label">Ultrasonic Sensor (HC-SR04)</span>
                <span class="maintenance-detail">Last Calibrated: 60 days ago</span>
              </div>
              <button class="btn-calibrate">Calibrate Now</button>
            </div>
            <div class="maintenance-item">
              <div class="maintenance-info">
                <span class="maintenance-label">Gas Sensor (MQ-135)</span>
                <span class="maintenance-detail">Last Calibrated: 15 days ago</span>
              </div>
              <button class="btn-calibrate">Calibrate Now</button>
            </div>
          </div>

          <!-- Manual Lid Control (Settings version) -->
          <div class="health-card">
            <h3>🚪 Manual Lid Control</h3>
            <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:1.5rem;">Open compartment lids for maintenance or emptying</p>
            <div class="lid-control-grid">
              <div class="lid-control-item">
                <div class="lid-icon" style="background:linear-gradient(135deg,rgba(76,175,80,0.2),rgba(76,175,80,0.1));color:#4CAF50;">🟩</div>
                <div class="lid-info">
                  <span class="lid-label">Biodegradable Lid</span>
                  <span class="lid-detail">Green compartment</span>
                </div>
                <div class="lid-buttons">
                  <button class="btn-open-lid"  onclick="openLid('bio')">Open</button>
                  <button class="btn-close-lid" onclick="closeLid('bio')">Close</button>
                </div>
              </div>
              <div class="lid-control-item">
                <div class="lid-icon" style="background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.1));color:#3b82f6;">🟦</div>
                <div class="lid-info">
                  <span class="lid-label">Non-Biodegradable Lid</span>
                  <span class="lid-detail">Blue compartment</span>
                </div>
                <div class="lid-buttons">
                  <button class="btn-open-lid"  onclick="openLid('nonbio')">Open</button>
                  <button class="btn-close-lid" onclick="closeLid('nonbio')">Close</button>
                </div>
              </div>
            </div>
            <div class="lid-warning" style="margin-top:1.5rem;">
              ⚠️ Ensure the bin is stable before opening lids. Only open when necessary.
            </div>
          </div>

          <!-- System Info -->
          <div class="health-card">
            <h3>ℹ️ System Information</h3>
            <div class="info-row">
              <span class="info-label">Firmware Version</span>
              <span class="info-value" id="sysInfoFirmware">v2.2.0</span>
            </div>
            <div class="info-row">
              <span class="info-label">Hardware</span>
              <span class="info-value">ESP32-S3 DevKit</span>
            </div>
            <div class="info-row">
              <span class="info-label">System ID</span>
              <span class="info-value">BINBOT-2026-001</span>
            </div>
            <div class="info-row">
              <span class="info-label">ESP32 IP</span>
              <span class="info-value" id="sysInfoIP">—</span>
            </div>
            <div class="info-row">
              <span class="info-label">WiFi Signal</span>
              <span class="info-value" id="sysInfoRSSI">—</span>
            </div>
            <div class="info-row">
              <span class="info-label">ESP32 Uptime</span>
              <span class="info-value" id="sysInfoUptime">—</span>
            </div>
          </div>

        </div>
      </div><!-- /health-tab -->

      <div class="settings-actions">
        <button class="btn-reset" onclick="resetToDefaults()">Reset to Defaults</button>
        <button class="btn-save"  onclick="saveSettings()">Save Changes</button>
      </div>
    </div><!-- /settingsContentPanel -->
  </div><!-- /settings-panel -->

  <!-- ── Daily Time Bubble ── -->
  <div class="daily-time-bubble" id="dailyTimeBubble">
    <div class="time-display">
      <div class="month-section">
        <span id="currentMonthNumber">05</span>
      </div>
      <div class="date-info">
        <span id="currentDayOfWeek">Monday</span>
        <span id="floatingMonth">May</span>
        <span id="currentDay">18</span>
      </div>
      <div class="time-info">
        <span id="currentTime">00:00:00</span>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       MODALS
  ══════════════════════════════════════════════════════════════════════ -->
  <div class="modal-overlay" id="lidModalOverlay"></div>

  <!-- Open Lid Modal -->
  <div class="modal-dialog" id="openLidModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>🚪 Open Compartment Lid</h2>
        <button class="modal-close" onclick="closeLidModal()">×</button>
      </div>
      <div class="modal-body">
        <p id="openLidText"></p>
        <div class="modal-warning">⚠️ Make sure the bin is stable before opening!</div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-secondary" onclick="closeLidModal()">Cancel</button>
        <button class="btn-modal-primary"   onclick="confirmOpenLid()">Open Lid</button>
      </div>
    </div>
  </div>

  <!-- Close Lid Modal -->
  <div class="modal-dialog" id="closeLidModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>🚪 Close Compartment Lid</h2>
        <button class="modal-close" onclick="closeLidModal()">×</button>
      </div>
      <div class="modal-body">
        <p id="closeLidText"></p>
        <div class="modal-warning">⚠️ Make sure nothing is in the way!</div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-secondary" onclick="closeLidModal()">Cancel</button>
        <button class="btn-modal-primary"   onclick="confirmCloseLid()">Close Lid</button>
      </div>
    </div>
  </div>

  <!-- Locked Bin Modal -->
  <div class="modal-dialog" id="lockedBinModal">
    <div class="modal-content">
      <div class="modal-header modal-header-locked">
        <h2>🔒 Bin is Locked</h2>
        <button class="modal-close" onclick="closeLidModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="locked-icon">🔴</div>
        <p id="lockedBinText"></p>
        <div class="modal-info">
          <strong>Why is it locked?</strong><br>
          This compartment reached maximum capacity and is automatically locked for safety.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-primary" onclick="closeLidModal()">Understand</button>
      </div>
    </div>
  </div>

  <!-- Success/Error Modal -->
  <div class="modal-dialog" id="successModal">
    <div class="modal-content">
      <div class="modal-header modal-header-success">
        <h2>✅ Result</h2>
        <button class="modal-close" onclick="closeLidModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="success-icon">✓</div>
        <p id="successText"></p>
      </div>
      <div class="modal-footer">
        <button class="btn-modal-primary" onclick="closeLidModal()">OK</button>
      </div>
    </div>
  </div>

</main><!-- /dashboard-layout -->

<!-- Firebase (Realtime Database + Anonymous Auth) -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
<script src="firebase-config.js"></script>

<script src="Binbot.js"></script>
</body>
</html>