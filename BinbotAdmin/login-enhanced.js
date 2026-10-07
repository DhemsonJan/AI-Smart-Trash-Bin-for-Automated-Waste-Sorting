/* ===== Binbot Admin Dashboard - Premium Edition JavaScript ===== */

// ===== DATE & TIME DISPLAY =====
function initializeDateTimeDisplay() {
  updateDateTimeDisplay();
  
  // Update every second
  setInterval(updateDateTimeDisplay, 1000);
}

function updateDateTimeDisplay() {
  const now = new Date();
  const dateElement = document.getElementById('currentDate');
  const timeElement = document.getElementById('currentTime');
  
  if (dateElement) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    dateElement.textContent = now.toLocaleDateString('en-US', options);
  }
  
  if (timeElement) {
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
  }
  
  // Auto-refresh calendar if date has changed
  checkAndUpdateCalendar(now);
}

let lastCalendarDate = null;

function checkAndUpdateCalendar(now) {
  const currentDateString = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  
  if (lastCalendarDate !== currentDateString) {
    lastCalendarDate = currentDateString;
    
    // Update calendar and related stats when date changes
    if (typeof generateCalendar === 'function') {
      generateCalendar();
    }
    if (typeof updateDetectionStats === 'function') {
      updateDetectionStats();
    }
    if (typeof updateCollectionStats === 'function') {
      updateCollectionStats();
    }
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  // Check session before initializing app
  const sessionToken = localStorage.getItem('binbot_session');
  if (!sessionToken) {
    window.location.href = 'login-enhanced.php';
    return;
  }

  initializeApp();
  initializeDateTimeDisplay();
  loadUsers();
  initializeCharts();
  initializeReportsPage();
  initializeAlertsPage();
  updateMonthDisplay();
  updateUserStats();
  setupEventListeners();
  updateUserDisplay();
  loadCustomSettings();
  startAdminRealtimePolling();
});

function initializeApp() {
  // Initialize localStorage with default data if empty
  if (!localStorage.getItem('binbot_users')) {
    const defaultUsers = [
      {
        id: 'USR001',
        name: 'John Supervisor',
        email: 'john@binbot.com',
        role: 'Supervisor',
        department: 'Operations',
        status: 'Active',
        joinDate: '2024-01-15',
        avatar: 'JS'
      },
      {
        id: 'USR002',
        name: 'Sarah Manager',
        email: 'sarah@binbot.com',
        role: 'Manager',
        department: 'Logistics',
        status: 'Active',
        joinDate: '2024-02-20',
        avatar: 'SM'
      },
      {
        id: 'USR003',
        name: 'Mike Collector',
        email: 'mike@binbot.com',
        role: 'Collector',
        department: 'Field',
        status: 'Active',
        joinDate: '2024-03-10',
        avatar: 'MC'
      }
    ];
    localStorage.setItem('binbot_users', JSON.stringify(defaultUsers));
  }

  // Initialize settings
  if (!localStorage.getItem('binbot_settings')) {
    const defaultSettings = {
      bioThreshold: 80,
      plasticThreshold: 75,
      paperThreshold: 85,
      metalThreshold: 80,
      collectionSchedule: 'automatic',
      alertNotifications: true,
      maintenanceAlert: true
    };
    localStorage.setItem('binbot_settings', JSON.stringify(defaultSettings));
  }
}

// Update month display on dashboard
function updateUserStats() {
  const users = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  // Count only users who are not Admin or Manager (i.e., only Collectors)
  const collectorCount = users.filter(u => u.role === 'Collector').length;
  
  const userCountElement = document.getElementById('userCount');
  const userChangeElement = document.getElementById('userChange');
  const userBar = document.getElementById('userBar');
  
  if (userCountElement) {
    userCountElement.textContent = collectorCount;
  }
  
  if (userChangeElement) {
    userChangeElement.textContent = `↑ ${collectorCount} Active collectors`;
  }
  
  if (userBar) {
    // Calculate percentage based on max of 10 collectors
    const percentage = Math.min((collectorCount / 10) * 100, 100);
    userBar.style.width = percentage + '%';
  }
}

// ===== PAGE NAVIGATION =====
function switchPage(pageName) {
  // Hide all pages
  const pages = document.querySelectorAll('.page-content');
  pages.forEach(page => page.classList.remove('active'));

  // Show selected page
  const selectedPage = document.getElementById(`${pageName}-page`);
  if (selectedPage) {
    selectedPage.classList.add('active');
  }

  // Update active nav link
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));
  event.target.closest('.nav-link').classList.add('active');

  // Update page title
  const pageTitle = {
    'dashboard': '📊 Dashboard',
    'overview': '👁️ Overview',
    'sensors': '📡 Sensors',
    'alerts': '🚨 Alerts',
    'bin-status': '📦 Bin Status',
    'users': '👥 Users',
    'reports': '📈 Reports',
    'logs': '📋 System Logs',
    'settings': '⚙️ Settings',
    'maintenance': '🔧 Maintenance'
  };

  document.getElementById('page-title').textContent = pageTitle[pageName] || 'Dashboard';

  // Close mobile menu if open
  closeMobileMenu();

  // Load specific page data
  if (pageName === 'users') {
    loadUsers();
  } else if (pageName === 'settings') {
    loadSettings();
  } else if (pageName === 'sensors') {
    initializeSensorsPage();
  } else if (pageName === 'alerts') {
    initializeAlertsPage();
  } else if (pageName === 'reports') {
    initializeReportsPage();
  } else if (pageName === 'logs') {
    loadSecurityLogs();
  }
}

// ===== USER MANAGEMENT =====
function loadUsers() {
  const users = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  const tbody = document.querySelector('.users-table tbody');

  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #8b92b4;">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${user.avatar}</div>
          <div class="user-info">
            <p class="user-name">${user.name}</p>
            <p class="user-email">${user.email}</p>
          </div>
        </div>
      </td>
      <td>
        <span class="badge badge-${user.role.toLowerCase().replace(' ', '-')}">${user.role}</span>
      </td>
      <td>
        <span class="badge badge-${user.status.toLowerCase()}">${user.status}</span>
      </td>
      <td>${new Date(user.joinDate).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action" onclick="editUser('${user.id}')">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteUser('${user.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Update user stats on dashboard
  updateUserStats();
}

function deleteUser(userId) {
  if (confirm('Are you sure you want to delete this user?')) {
    let users = JSON.parse(localStorage.getItem('binbot_users') || '[]');
    users = users.filter(u => u.id !== userId);
    localStorage.setItem('binbot_users', JSON.stringify(users));
    loadUsers();
    showNotification('User deleted successfully', 'success');
  }
}

function editUser(userId) {
  const users = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    showNotification('User not found', 'error');
    return;
  }
  
  // Populate the edit modal
  document.getElementById('editUserName').value = user.name;
  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserRole').value = user.role;
  document.getElementById('editUserStatus').value = user.status;
  
  // Clear password fields
  document.getElementById('editPassword').value = '';
  document.getElementById('editConfirmPassword').value = '';
  
  // Set password label based on role
  const passwordLabel = document.getElementById('editPasswordLabel');
  const confirmPasswordLabel = document.getElementById('editConfirmPasswordLabel');
  const passwordInput = document.getElementById('editPassword');
  const confirmPasswordInput = document.getElementById('editConfirmPassword');
  
  if (user.role === 'Collector' || user.role === 'Supervisor') {
    passwordLabel.textContent = 'New PIN (4 digits)';
    confirmPasswordLabel.textContent = 'Confirm PIN';
    passwordInput.inputMode = 'numeric';
    confirmPasswordInput.inputMode = 'numeric';
    passwordInput.placeholder = 'Enter 4-digit PIN (optional)';
    confirmPasswordInput.placeholder = 'Confirm 4-digit PIN (optional)';
  } else {
    passwordLabel.textContent = 'New Password';
    confirmPasswordLabel.textContent = 'Confirm Password';
    passwordInput.inputMode = 'text';
    confirmPasswordInput.inputMode = 'text';
    passwordInput.placeholder = 'Leave empty to keep current password';
    confirmPasswordInput.placeholder = 'Leave empty to keep current password';
  }
  
  // Store the userId and role for later use
  document.getElementById('editUserForm').dataset.userId = userId;
  document.getElementById('editUserForm').dataset.userRole = user.role;
  
  // Show the modal
  document.getElementById('editUserModal').style.display = 'flex';
}

function closeEditUser() {
  document.getElementById('editUserModal').style.display = 'none';
}

function handleEditUser(event) {
  event.preventDefault();
  
  const userId = document.getElementById('editUserForm').dataset.userId;
  const userRole = document.getElementById('editUserForm').dataset.userRole;
  const newStatus = document.getElementById('editUserStatus').value;
  const newPassword = document.getElementById('editPassword').value;
  const confirmPassword = document.getElementById('editConfirmPassword').value;
  
  // Validate password/PIN if provided
  if (newPassword || confirmPassword) {
    if (newPassword !== confirmPassword) {
      showNotification('❌ Passwords do not match', 'error');
      return;
    }
    
    if (userRole === 'Collector' || userRole === 'Supervisor') {
      // Validate PIN: exactly 4 digits
      if (!/^\d{4}$/.test(newPassword)) {
        showNotification('❌ PIN must be exactly 4 digits', 'error');
        return;
      }
    } else {
      // Validate password: minimum 8 characters
      if (newPassword.length < 8) {
        showNotification('❌ Password must be at least 8 characters', 'error');
        return;
      }
    }
  }
  
  // Update the user in localStorage
  let users = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex !== -1) {
    users[userIndex].status = newStatus;
    
    // Update password/PIN if provided
    if (newPassword) {
      users[userIndex].password = newPassword;
    }
    
    localStorage.setItem('binbot_users', JSON.stringify(users));
    
    // Reload the users table
    loadUsers();
    
    // Close the modal
    closeEditUser();
    
    // Show success message
    if (newPassword) {
      showNotification('✅ User status and password updated successfully!', 'success');
    } else {
      showNotification('✅ User status updated successfully!', 'success');
    }
  }
}

function updateUserDisplay() {
  const user = JSON.parse(localStorage.getItem('binbot_user') || '{}');
  const userName = user.username || 'Admin';
  const userRole = user.role || 'Administrator';
  const userInitial = userName.charAt(0).toUpperCase();

  // Update all user display elements
  document.getElementById('userNameMini').textContent = userName;
  document.getElementById('userRoleMini').textContent = userRole;
  document.getElementById('greetingName').textContent = userName;
  document.getElementById('userNameHeader').textContent = userName;
  document.getElementById('userAvatarMini').textContent = userInitial;
  document.getElementById('userAvatarHeader').textContent = userInitial;
}

// ===== SETTINGS MANAGEMENT =====
// Load custom settings on page load
function loadCustomSettings() {
  const saved = localStorage.getItem('binbot_custom_settings');
  if (saved) {
    const settings = JSON.parse(saved);
    
    if (settings.theme) applyTheme(settings.theme, false);
    if (settings.accentColor) applyAccentColor(settings.accentColor, false);
    if (settings.fontSize) applyFontSize(settings.fontSize, false);
    if (settings.animationSpeed) applyAnimationSpeed(settings.animationSpeed, false);
    if (settings.chartAnimation !== undefined) document.getElementById('chartAnimation').checked = settings.chartAnimation;
    if (settings.desktopNotif !== undefined) document.getElementById('desktopNotif').checked = settings.desktopNotif;
    if (settings.soundAlerts !== undefined) document.getElementById('soundAlerts').checked = settings.soundAlerts;
    if (settings.chartLegends !== undefined) document.getElementById('chartLegends').checked = settings.chartLegends;
  }
}

function saveAllSettings() {
  const settings = {
    theme: document.querySelector('.theme-btn.active')?.dataset.theme || 'dark',
    accentColor: document.body.style.getPropertyValue('--accent-blue') || '#60a5fa',
    sidebar: document.getElementById('sidebarBehavior').value,
    fontSize: document.getElementById('fontSizeSlider').value,
    animationSpeed: document.getElementById('animationSpeed').value,
    chartAnimation: document.getElementById('chartAnimation').checked,
    desktopNotif: document.getElementById('desktopNotif').checked,
    soundAlerts: document.getElementById('soundAlerts').checked,
    alertFrequency: document.getElementById('alertFrequency').value,
    chartLegends: document.getElementById('chartLegends').checked,
    cardsPerRow: document.getElementById('cardsPerRow').value,
    activityItems: document.getElementById('activityItems').value,
    autoRefresh: document.getElementById('autoRefresh').value,
    dataRetention: document.getElementById('dataRetention').value,
    timeFormat: document.getElementById('timeFormat').value,
    timestamp: new Date().toISOString()
  };
  
  localStorage.setItem('binbot_custom_settings', JSON.stringify(settings));
  showNotification('✅ All settings saved successfully!', 'success');
}

function resetSettings() {
  if (confirm('🔄 Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    localStorage.removeItem('binbot_custom_settings');
    
    // Reset all UI elements
    document.getElementById('fontSizeSlider').value = 100;
    document.getElementById('fontSizeValue').textContent = '100';
    applyFontSize(100, false);
    
    document.getElementById('animationSpeed').value = 'normal';
    applyAnimationSpeed('normal', false);
    
    setTheme('dark');
    setAccentColor('#60a5fa');
    
    document.getElementById('chartAnimation').checked = true;
    document.getElementById('desktopNotif').checked = true;
    document.getElementById('soundAlerts').checked = true;
    document.getElementById('chartLegends').checked = true;
    document.getElementById('sidebarBehavior').value = 'sticky';
    document.getElementById('alertFrequency').value = 'normal';
    document.getElementById('cardsPerRow').value = 'auto';
    document.getElementById('activityItems').value = '5';
    document.getElementById('autoRefresh').value = '10';
    document.getElementById('dataRetention').value = '30';
    document.getElementById('timeFormat').value = '24h';
    
    showNotification('🔄 Settings reset to defaults!', 'success');
  }
}

function exportSettings() {
  const settings = localStorage.getItem('binbot_custom_settings') || '{}';
  const dataStr = JSON.stringify(JSON.parse(settings), null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `binbot-settings-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  showNotification('📥 Settings exported successfully!', 'success');
}

// Theme Management
function setTheme(theme) {
  applyTheme(theme);
  
  // Update button states
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.theme === theme) {
      btn.classList.add('active');
    }
  });
}

function applyTheme(theme, save = true) {
  if (theme === 'light') {
    document.documentElement.style.setProperty('--primary', '#f8fafc');
    document.documentElement.style.setProperty('--secondary', '#f1f5f9');
    document.documentElement.style.setProperty('--tertiary', '#e2e8f0');
    document.documentElement.style.setProperty('--text-primary', '#0f172a');
    document.documentElement.style.setProperty('--text-secondary', '#334155');
    document.documentElement.style.setProperty('--text-muted', '#64748b');
    document.documentElement.style.setProperty('--border-color', '#cbd5e1');
    document.documentElement.style.setProperty('--hover-color', '#e2e8f0');
  } else {
    // Reset to dark mode (default)
    document.documentElement.style.setProperty('--primary', '#0a0f1a');
    document.documentElement.style.setProperty('--secondary', '#0f141f');
    document.documentElement.style.setProperty('--tertiary', '#141a2e');
    document.documentElement.style.setProperty('--text-primary', '#f0f4ff');
    document.documentElement.style.setProperty('--text-secondary', '#c7d2e0');
    document.documentElement.style.setProperty('--text-muted', '#8b92b4');
    document.documentElement.style.setProperty('--border-color', '#1e2747');
    document.documentElement.style.setProperty('--hover-color', '#1a2847');
  }
  
  if (save) saveAllSettings();
}

// Accent Color Management
function setAccentColor(color) {
  applyAccentColor(color);
  
  // Update color button states
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.style.background.includes(color)) {
      btn.classList.add('active');
    }
  });
  
  // Update color picker
  document.getElementById('customColorPicker').value = color;
}

function applyAccentColor(color, save = true) {
  // Parse hex color
  const rgb = parseInt(color.slice(1), 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  
  document.documentElement.style.setProperty('--accent-blue', color);
  
  if (save) saveAllSettings();
}

// Font Size Management
function setFontSize(percentage) {
  applyFontSize(percentage);
  document.getElementById('fontSizeValue').textContent = percentage;
}

function applyFontSize(percentage, save = true) {
  const scale = percentage / 100;
  document.documentElement.style.setProperty('--font-scale', scale);
  document.body.style.fontSize = (16 * scale) + 'px';
  
  if (save) saveAllSettings();
}

// Animation Speed Management
function setAnimationSpeed(speed) {
  applyAnimationSpeed(speed);
}

function applyAnimationSpeed(speed, save = true) {
  let duration = 400;
  switch(speed) {
    case 'slow': duration = 600; break;
    case 'normal': duration = 400; break;
    case 'fast': duration = 200; break;
    case 'instant': duration = 0; break;
  }
  
  document.documentElement.style.setProperty('--animation-duration', duration + 'ms');
  
  // Update CSS transitions
  const style = document.getElementById('animation-speed-style') || document.createElement('style');
  style.id = 'animation-speed-style';
  style.textContent = `
    * {
      transition-duration: ${duration}ms !important;
    }
  `;
  if (!document.getElementById('animation-speed-style')) {
    document.head.appendChild(style);
  }
  
  if (save) saveAllSettings();
}

// Sidebar Behavior
function setSidebarBehavior(behavior) {
  // This would control sidebar collapsing, overlay, etc.
  localStorage.setItem('sidebar_behavior', behavior);
  showNotification(`Sidebar behavior set to: ${behavior}`, 'info');
  saveAllSettings();
}

// Chart Options
function toggleChartAnimation(enabled) {
  if (combinedTrendChartInstance) {
    combinedTrendChartInstance.options.animation = enabled ? { duration: 750 } : false;
  }
  saveAllSettings();
}

function toggleChartLegends(enabled) {
  if (combinedTrendChartInstance) {
    combinedTrendChartInstance.options.plugins.legend.display = enabled;
    combinedTrendChartInstance.update();
  }
  saveAllSettings();
}

// Dashboard Display
function setCardsPerRow(count) {
  const grid = document.querySelector('.dashboard-grid');
  if (grid) {
    if (count === 'auto') {
      grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    } else {
      const colWidths = {
        '4': 'repeat(4, 1fr)',
        '3': 'repeat(3, 1fr)',
        '2': 'repeat(2, 1fr)'
      };
      grid.style.gridTemplateColumns = colWidths[count] || 'repeat(auto-fit, minmax(250px, 1fr))';
    }
  }
  saveAllSettings();
}

function setActivityItems(count) {
  document.getElementById('activityValue').textContent = count;
  const items = document.querySelectorAll('.activity-item');
  items.forEach((item, index) => {
    item.style.display = index < count ? 'flex' : 'none';
  });
  saveAllSettings();
}

// Notifications
function toggleNotifications(enabled) {
  if (enabled && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  saveAllSettings();
}

function toggleSoundAlerts(enabled) {
  localStorage.setItem('sound_alerts', enabled);
  saveAllSettings();
}

function setAlertFrequency(frequency) {
  localStorage.setItem('alert_frequency', frequency);
  saveAllSettings();
}

// System Settings
function setAutoRefresh(seconds) {
  localStorage.setItem('auto_refresh', seconds);
  saveAllSettings();
}

function setDataRetention(days) {
  localStorage.setItem('data_retention', days);
  saveAllSettings();
}

function setTimeFormat(format) {
  localStorage.setItem('time_format', format);
  saveAllSettings();
}

// ===== CHARTS INITIALIZATION =====
// Chart.js context references
let trendChart, distributionChart, performanceChart, healthChart, reportsTrendChart;

function initializeCharts() {
  setTimeout(() => {
    initTrendChart();
    initDistributionChart();
    initPerformanceChart();
    initHealthChart();
  }, 100);
}

function initTrendChart() {
  // Initialize with last 7 days by default
  updateDashboardTrendChart('7');
}

async function updateDashboardTrendChart(days) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  if (trendChart) {
    trendChart.destroy();
  }

  // Pull REAL fill-level history from the same API the public dashboard uses
  const { labels, bioData, nonBioData } = await fetchAdminChartSeries(parseInt(days));

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Biodegradable Fill %',
          data: bioData,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#34d399',
          pointBorderColor: '#0a0f1a',
          pointBorderWidth: 2
        },
        {
          label: 'Non-Biodegradable Fill %',
          data: nonBioData,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#60a5fa',
          pointBorderColor: '#0a0f1a',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#c7d2e0',
            font: { size: 12, weight: 600 },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        filler: {
          propagate: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(30, 39, 71, 0.5)',
            drawBorder: false
          },
          ticks: {
            color: '#8b92b4',
            font: { size: 11 }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#8b92b4',
            font: { size: 11 }
          }
        }
      }
    }
  });
}

function setupEventListeners() {
  // Mobile menu
  const sliders = document.querySelectorAll('.range-slider');
  sliders.forEach(slider => {
    slider.addEventListener('input', function() {
      updateSliderValue(this);
    });
  });

  // Alert dismiss buttons
  const dismissButtons = document.querySelectorAll('.btn-dismiss');
  dismissButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.alert-item').remove();
    });
  });

  // Password strength input
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('input', checkPasswordStrength);
  }

  // Role change handler
  const roleSelect = document.getElementById('role');
  if (roleSelect) {
    roleSelect.addEventListener('change', function() {
      handleRoleChange(this.value);
    });
  }

  // PIN/Password input constraints
  const passwordField = document.getElementById('password');
  const confirmField = document.getElementById('confirmPassword');
  if (passwordField) {
    passwordField.addEventListener('input', function() {
      const role = document.getElementById('role').value;
      if (role === 'Collector' || role === 'Supervisor') {
        // Allow only digits and limit to 4
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
      }
    });
  }
  if (confirmField) {
    confirmField.addEventListener('input', function() {
      const role = document.getElementById('role').value;
      if (role === 'Collector' || role === 'Supervisor') {
        // Allow only digits and limit to 4
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
      }
    });
  }

  // Edit Password input constraints
  const editPasswordField = document.getElementById('editPassword');
  const editConfirmField = document.getElementById('editConfirmPassword');
  if (editPasswordField) {
    editPasswordField.addEventListener('input', function() {
      const userRole = document.getElementById('editUserForm').dataset.userRole;
      if (userRole === 'Collector' || userRole === 'Supervisor') {
        // Allow only digits and limit to 4
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
      }
    });
  }
  if (editConfirmField) {
    editConfirmField.addEventListener('input', function() {
      const userRole = document.getElementById('editUserForm').dataset.userRole;
      if (userRole === 'Collector' || userRole === 'Supervisor') {
        // Allow only digits and limit to 4
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
      }
    });
  }

  // Close modal on overlay click
  const modal = document.getElementById('userRegistrationModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeUserRegistration();
      }
    });
  }

  // Close edit modal on overlay click
  const editModal = document.getElementById('editUserModal');
  if (editModal) {
    editModal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeEditUser();
      }
    });
  }

  // ===== SETTINGS EVENT LISTENERS =====
  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      setTheme(this.dataset.theme);
    });
  });

  // Color preset buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const color = this.style.backgroundColor;
      // Extract hex color from rgb
      const rgbMatch = color.match(/\d+/g);
      if (rgbMatch && rgbMatch.length === 3) {
        const hex = '#' + rgbMatch.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
        setAccentColor(hex);
      }
    });
  });

  // Custom color picker
  const colorPicker = document.getElementById('customColorPicker');
  if (colorPicker) {
    colorPicker.addEventListener('input', function() {
      setAccentColor(this.value);
    });
  }

  // Font size slider
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', function() {
      setFontSize(this.value);
    });
  }

  // Animation speed dropdown
  const animationSpeed = document.getElementById('animationSpeed');
  if (animationSpeed) {
    animationSpeed.addEventListener('change', function() {
      setAnimationSpeed(this.value);
    });
  }

  // Sidebar behavior
  const sidebarBehavior = document.getElementById('sidebarBehavior');
  if (sidebarBehavior) {
    sidebarBehavior.addEventListener('change', function() {
      setSidebarBehavior(this.value);
    });
  }

  // Chart options
  const chartAnimToggle = document.getElementById('chartAnimation');
  if (chartAnimToggle) {
    chartAnimToggle.addEventListener('change', function() {
      toggleChartAnimation(this.checked);
    });
  }

  const chartLegendsToggle = document.getElementById('chartLegends');
  if (chartLegendsToggle) {
    chartLegendsToggle.addEventListener('change', function() {
      toggleChartLegends(this.checked);
    });
  }

  // Notification toggles
  const desktopNotifToggle = document.getElementById('desktopNotif');
  if (desktopNotifToggle) {
    desktopNotifToggle.addEventListener('change', function() {
      toggleNotifications(this.checked);
    });
  }

  const soundAlertsToggle = document.getElementById('soundAlerts');
  if (soundAlertsToggle) {
    soundAlertsToggle.addEventListener('change', function() {
      toggleSoundAlerts(this.checked);
    });
  }

  // Alert frequency
  const alertFrequency = document.getElementById('alertFrequency');
  if (alertFrequency) {
    alertFrequency.addEventListener('change', function() {
      setAlertFrequency(this.value);
    });
  }

  // Cards per row
  const cardsPerRow = document.getElementById('cardsPerRow');
  if (cardsPerRow) {
    cardsPerRow.addEventListener('change', function() {
      setCardsPerRow(this.value);
    });
  }

  // Activity items slider
  const activityItems = document.getElementById('activityItems');
  if (activityItems) {
    activityItems.addEventListener('input', function() {
      setActivityItems(this.value);
    });
  }

  // Auto refresh
  const autoRefresh = document.getElementById('autoRefresh');
  if (autoRefresh) {
    autoRefresh.addEventListener('change', function() {
      setAutoRefresh(this.value);
    });
  }

  // Data retention
  const dataRetention = document.getElementById('dataRetention');
  if (dataRetention) {
    dataRetention.addEventListener('change', function() {
      setDataRetention(this.value);
    });
  }

  // Time format
  const timeFormat = document.getElementById('timeFormat');
  if (timeFormat) {
    timeFormat.addEventListener('change', function() {
      setTimeFormat(this.value);
    });
  }

  // Settings action buttons
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveAllSettings);
  }

  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', resetSettings);
  }

  const exportSettingsBtn = document.getElementById('exportSettingsBtn');
  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener('click', exportSettings);
  }
}

// ===== MOBILE MENU =====
function toggleMobileMenu() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
}

function closeMobileMenu() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.remove('active');
  overlay.classList.remove('active');
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
  // Create notification toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  const styles = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 9999;
    animation: slideInUp 0.3s ease;
    ${type === 'success' ? 'background: #34d399; color: #0a0f1a;' : ''}
    ${type === 'error' ? 'background: #ef4444; color: white;' : ''}
    ${type === 'info' ? 'background: #60a5fa; color: white;' : ''}
  `;
  
  toast.style.cssText = styles;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== SECURITY LOGS FUNCTIONS =====
function loadSecurityLogs() {
  // Load and display security logs from localStorage
  const logs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]');
  
  // Update statistics
  const successfulPin = logs.filter(log => log.eventType === 'PIN_UNLOCK_SUCCESS').length;
  const failedPin = logs.filter(log => log.eventType === 'PIN_UNLOCK_FAILED').length;
  const sessionClose = logs.filter(log => log.eventType === 'SETTINGS_SESSION_CLOSED').length;
  const uniqueUsers = new Set(logs.filter(log => log.details.userId).map(log => log.details.userId)).size;
  
  document.getElementById('successfulPinCount').textContent = successfulPin;
  document.getElementById('failedPinCount').textContent = failedPin;
  document.getElementById('totalLogsCount').textContent = logs.length;
  document.getElementById('usersAccessedCount').textContent = uniqueUsers;
  
  // Display logs in table
  displaySecurityLogsTable(logs);
  
  // Display timeline
  displaySecurityTimeline(logs);
}

function displaySecurityLogsTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;
  
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #8b92b4;">No security logs yet. PIN unlocks will appear here.</td></tr>';
    return;
  }
  
  // Sort logs by timestamp (newest first)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  tbody.innerHTML = sortedLogs.map(log => {
    let userDetail = '';
    let eventDisplay = '';
    
    if (log.eventType === 'PIN_UNLOCK_SUCCESS') {
      userDetail = `${log.details.userName} (${log.details.userRole})`;
      eventDisplay = '🔓 PIN Unlock';
    } else if (log.eventType === 'PIN_UNLOCK_FAILED') {
      userDetail = `Invalid attempt`;
      eventDisplay = '❌ Failed PIN';
    } else if (log.eventType === 'SETTINGS_SESSION_CLOSED') {
      userDetail = 'Session closed';
      eventDisplay = '🔐 Session End';
    } else {
      userDetail = log.details.userName || 'System';
      eventDisplay = log.eventType.replace(/_/g, ' ');
    }
    
    return `
      <tr>
        <td><small>${log.datetime}</small></td>
        <td>${eventDisplay}</td>
        <td>${userDetail}</td>
        <td>${log.status}</td>
        <td><span class="severity-badge ${log.severity}">${log.severity.toUpperCase()}</span></td>
        <td>${log.source}</td>
      </tr>
    `;
  }).join('');
}

function displaySecurityTimeline(logs) {
  const timeline = document.getElementById('securityTimeline');
  if (!timeline || logs.length === 0) return;
  
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
  
  timeline.innerHTML = sortedLogs.map((log, index) => {
    let icon = '📋';
    let title = log.eventType.replace(/_/g, ' ');
    let description = '';
    
    if (log.eventType === 'PIN_UNLOCK_SUCCESS') {
      icon = '✅';
      title = 'PIN Unlock Successful';
      description = `${log.details.userName} (${log.details.userRole}) unlocked settings`;
    } else if (log.eventType === 'PIN_UNLOCK_FAILED') {
      icon = '❌';
      title = 'Failed PIN Attempt';
      description = 'Invalid PIN entered';
    } else if (log.eventType === 'SETTINGS_SESSION_CLOSED') {
      icon = '🔐';
      title = 'Settings Session Closed';
      description = 'User closed the settings panel';
    }
    
    return `
      <div class="timeline-item ${index === 0 ? 'active' : ''}">
        <div class="timeline-marker">${icon}</div>
        <div class="timeline-content">
          <h4>${title}</h4>
          <p>${description}</p>
          <small>${log.datetime}</small>
        </div>
      </div>
    `;
  }).join('');
}

function filterSecurityLogs(filter) {
  const allLogs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]');
  let filteredLogs = allLogs;
  
  if (filter !== 'all') {
    if (filter === 'PIN_UNLOCK_SUCCESS') {
      filteredLogs = allLogs.filter(log => log.eventType === 'PIN_UNLOCK_SUCCESS');
    } else if (filter === 'PIN_UNLOCK_FAILED') {
      filteredLogs = allLogs.filter(log => log.eventType === 'PIN_UNLOCK_FAILED');
    } else if (filter === 'SESSION') {
      filteredLogs = allLogs.filter(log => log.eventType.includes('SESSION'));
    }
  }
  
  // Update filter buttons active state
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  // Display filtered logs
  displaySecurityLogsTable(filteredLogs);
}

function searchSecurityLogs(searchTerm) {
  const allLogs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]');
  
  if (!searchTerm.trim()) {
    displaySecurityLogsTable(allLogs);
    return;
  }
  
  const filtered = allLogs.filter(log => 
    log.details.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.datetime.includes(searchTerm)
  );
  
  displaySecurityLogsTable(filtered);
}

function clearAllLogs() {
  if (confirm('⚠️ Are you sure you want to delete all security logs? This cannot be undone.')) {
    localStorage.setItem('binbot_security_logs', '[]');
    loadSecurityLogs();
    showNotification('🗑️ All security logs have been cleared', 'info');
  }
}

function exportSecurityLogs() {
  const logs = JSON.parse(localStorage.getItem('binbot_security_logs') || '[]');
  
  if (logs.length === 0) {
    showNotification('❌ No logs to export', 'warning');
    return;
  }
  
  // Create CSV
  let csv = 'Timestamp,Event Type,User,Status,Severity,Source\n';
  logs.forEach(log => {
    const user = log.details.userName || log.details.reason || 'System';
    csv += `"${log.datetime}","${log.eventType}","${user}","${log.status}","${log.severity}","${log.source}"\n`;
  });
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `security-logs-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  showNotification('📥 Security logs exported successfully', 'success');
}

// ===== LOGOUT =====
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    // Clear all session data
    localStorage.removeItem('binbot_session');
    localStorage.removeItem('binbot_user');
    localStorage.removeItem('binbot_remember_me');
    localStorage.removeItem('binbot_settings');
    localStorage.removeItem('binbot_custom_settings');
    
    // Clear form inputs
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
    
    // Redirect to login page
    setTimeout(() => {
      window.location.href = 'login-enhanced.php';
    }, 200);
  }
}

// ===== USER REGISTRATION MODAL =====
function openUserRegistration() {
  const modal = document.getElementById('userRegistrationModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeUserRegistration() {
  const modal = document.getElementById('userRegistrationModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('userRegistrationForm').reset();
    clearPasswordStrength();
    resetRoleDisplay();
  }
}

function resetRoleDisplay() {
  // Reset to password mode
  document.getElementById('passwordLabel').textContent = 'Password *';
  document.getElementById('confirmPasswordLabel').textContent = 'Confirm Password *';
  document.getElementById('roleInfo').textContent = '';
  
  const passwordField = document.getElementById('password');
  const confirmField = document.getElementById('confirmPassword');
  
  if (passwordField) passwordField.placeholder = '';
  if (confirmField) confirmField.placeholder = '';
}

function handleRoleChange(role) {
  const passwordLabel = document.getElementById('passwordLabel');
  const confirmPasswordLabel = document.getElementById('confirmPasswordLabel');
  const roleInfo = document.getElementById('roleInfo');
  const passwordField = document.getElementById('password');
  const confirmField = document.getElementById('confirmPassword');
  
  if (role === 'Collector' || role === 'Supervisor') {
    // Switch to PIN mode
    passwordLabel.textContent = 'PIN (4 digits) *';
    confirmPasswordLabel.textContent = 'Confirm PIN (4 digits) *';
    roleInfo.textContent = '🔐 Field access uses 4-digit PIN';
    roleInfo.style.color = '#34d399';
    
    if (passwordField) {
      passwordField.placeholder = '0000';
      passwordField.maxLength = '4';
    }
    if (confirmField) {
      confirmField.placeholder = '0000';
      confirmField.maxLength = '4';
    }
    
    // Clear password strength indicator
    clearPasswordStrength();
  } else {
    // Switch to password mode
    passwordLabel.textContent = 'Password *';
    confirmPasswordLabel.textContent = 'Confirm Password *';
    roleInfo.textContent = '';
    
    if (passwordField) {
      passwordField.placeholder = '';
      passwordField.maxLength = '999';
    }
    if (confirmField) {
      confirmField.placeholder = '';
      confirmField.maxLength = '999';
    }
  }
}

function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  if (field.type === 'password') {
    field.type = 'text';
  } else {
    field.type = 'password';
  }
}

function checkPasswordStrength() {
  const password = document.getElementById('password').value;
  const strengthIndicator = document.getElementById('passwordStrength');

  if (password.length === 0) {
    clearPasswordStrength();
    return;
  }

  let strength = 0;
  
  // Check length
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  
  // Check for uppercase
  if (/[A-Z]/.test(password)) strength++;
  
  // Check for lowercase
  if (/[a-z]/.test(password)) strength++;
  
  // Check for numbers
  if (/\d/.test(password)) strength++;
  
  // Check for special characters
  if (/[!@#$%^&*]/.test(password)) strength++;

  let text = '';
  let className = '';

  if (strength <= 2) {
    text = '❌ Weak password';
    className = 'weak';
  } else if (strength <= 4) {
    text = '⚠️ Medium password';
    className = 'medium';
  } else {
    text = '✅ Strong password';
    className = 'strong';
  }

  strengthIndicator.textContent = text;
  strengthIndicator.className = 'password-strength ' + className;
}

function clearPasswordStrength() {
  const strengthIndicator = document.getElementById('passwordStrength');
  if (strengthIndicator) {
    strengthIndicator.textContent = '';
    strengthIndicator.className = 'password-strength';
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password) {
  return password.length >= 8;
}

function handleUserRegistration(event) {
  event.preventDefault();

  // Get form values
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const role = document.getElementById('role').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validation
  if (!firstName || !lastName) {
    showNotification('❌ Please enter first and last name', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showNotification('❌ Please enter a valid email address', 'error');
    return;
  }

  if (!role) {
    showNotification('❌ Please select a user role', 'error');
    return;
  }

  // PIN vs Password Validation
  const isPinRole = role === 'Collector' || role === 'Supervisor';
  
  if (isPinRole) {
    // PIN validation: must be exactly 4 digits
    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      showNotification('❌ PIN must be exactly 4 digits', 'error');
      return;
    }
  } else {
    // Password validation: minimum 8 characters
    if (!isValidPassword(password)) {
      showNotification('❌ Password must be at least 8 characters long', 'error');
      return;
    }
  }

  if (password !== confirmPassword) {
    const fieldName = isPinRole ? 'PINs' : 'Passwords';
    showNotification(`❌ ${fieldName} do not match`, 'error');
    return;
  }

  // Check if email already exists
  const users = JSON.parse(localStorage.getItem('binbot_users') || '[]');
  if (users.some(u => u.email === email)) {
    showNotification('❌ Email already registered', 'error');
    return;
  }

  // Create new user
  const newUser = {
    id: 'USR' + String(Math.floor(Math.random() * 999999)).padStart(3, '0'),
    firstName: firstName,
    lastName: lastName,
    name: firstName + ' ' + lastName,
    email: email,
    password: password,
    role: role,
    department: role === 'Collector' || role === 'Supervisor' ? 'Field Operations' : 'Management',
    status: 'Active',
    joinDate: new Date().toISOString().split('T')[0],
    avatar: (firstName.charAt(0) + lastName.charAt(0)).toUpperCase(),
    accessType: isPinRole ? 'PIN' : 'Password'
  };

  // Add user to localStorage
  users.push(newUser);
  localStorage.setItem('binbot_users', JSON.stringify(users));
  
  // Also store in binbot_accounts for login compatibility
  const accounts = JSON.parse(localStorage.getItem('binbot_accounts') || '[]');
  accounts.push(newUser);
  localStorage.setItem('binbot_accounts', JSON.stringify(accounts));

  // Show success message
  const roleDisplay = role === 'Collector' || role === 'Supervisor' ? `with 4-digit PIN (${password})` : 'successfully';
  showNotification(`✅ User registered ${roleDisplay}!`, 'success');

  // Close modal and reload users
  closeUserRegistration();
  loadUsers();
}

// ===== DATA PERSISTENCE =====
function saveSettings() {
  const settings = {
    bioThreshold: document.querySelector('[data-setting="bioThreshold"]')?.value || 80,
    collectionSchedule: 'automatic',
    alertNotifications: true,
    maintenanceAlert: true
  };
  localStorage.setItem('binbot_settings', JSON.stringify(settings));
  showNotification('Settings saved successfully', 'success');
}

// ===== UTILITY FUNCTIONS =====
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// ===== REPORTS PAGE INITIALIZATION =====

/* ============================================================================
   REAL-TIME ADMIN DATA ENGINE
   Connects this admin panel to the SAME ESP32 backend the public dashboard
   uses (BinbotDashboard/api/*.php). No more fake/hardcoded sensor numbers.
   There is no hazardous-waste sensor on the hardware, so it is not shown.
   ============================================================================ */

// Adjust this if your BinbotAdmin folder isn't a sibling of BinbotDashboard.
// It must point at the SAME api/ folder the public dashboard (Binbot.js) uses.
const ADMIN_API_BASE = '/BinbotDashboard/api/';

const adminLive = {
  sensors: null,       // last successful get-sensor-data.php payload (data.data)
  fresh: false,
  ageSeconds: 9999,
  esp32Online: false,
  esp32Status: null,   // last get-esp32-status.php payload
  chart: null,          // last get-chart-data.php payload (data.data.daily_readings)
  chartStats: null,
  lastPollOk: false
};

let adminSensorPollTimer = null;
let adminStatusPollTimer = null;

function startAdminRealtimePolling() {
  fetchAdminSensorData();
  fetchAdminESP32Status();
  adminSensorPollTimer = setInterval(fetchAdminSensorData, 4000);
  adminStatusPollTimer = setInterval(fetchAdminESP32Status, 6000);
  window.addEventListener('beforeunload', () => {
    clearInterval(adminSensorPollTimer);
    clearInterval(adminStatusPollTimer);
  });
}

async function fetchAdminSensorData() {
  try {
    const res = await fetch(ADMIN_API_BASE + 'get-sensor-data.php');
    const json = await res.json();
    if (json.success && json.data) {
      adminLive.sensors = json.data;
      adminLive.fresh = !!json.fresh;
      adminLive.ageSeconds = json.age_seconds ?? 9999;
      adminLive.lastPollOk = true;
    } else {
      adminLive.lastPollOk = false;
    }
  } catch (err) {
    adminLive.lastPollOk = false;
    console.warn('⚠️ Admin: could not reach get-sensor-data.php —', err.message);
  }
  refreshLiveDashboardUI();
}

async function fetchAdminESP32Status() {
  try {
    const res = await fetch(ADMIN_API_BASE + 'get-esp32-status.php');
    const json = await res.json();
    adminLive.esp32Online = !!json.online;
    adminLive.esp32Status = json;
  } catch (err) {
    adminLive.esp32Online = false;
    console.warn('⚠️ Admin: could not reach get-esp32-status.php —', err.message);
  }
  refreshLiveDashboardUI();
  if (document.getElementById('sensors-page')?.classList.contains('active')) {
    renderRealSensorList();
  }
}

async function fetchAdminChartData(days = 30) {
  try {
    const res = await fetch(ADMIN_API_BASE + `get-chart-data.php?days=${days}`);
    const json = await res.json();
    if (json.success && json.data) {
      adminLive.chart = json.data.daily_readings || [];
      adminLive.chartStats = json.stats || null;
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Admin: could not reach get-chart-data.php —', err.message);
  }
  adminLive.chart = adminLive.chart || [];
  return false;
}

// Returns {labels, bioData, nonBioData} from the real daily log for Chart.js
async function fetchAdminChartSeries(days = 30) {
  await fetchAdminChartData(days);
  const rows = adminLive.chart || [];
  return {
    labels: rows.map(r => r.day),
    bioData: rows.map(r => r.bio_fill),
    nonBioData: rows.map(r => r.nonbio_fill)
  };
}

// ── Send a manual lid command (same endpoint the public dashboard uses) ──
async function adminSendLidCommand(action, compartment) {
  const name = compartment === 'bio' ? 'Biodegradable' : 'Non-Biodegradable';
  try {
    const res = await fetch(ADMIN_API_BASE + 'send-command.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, compartment, source: 'manual' })
    });
    const json = await res.json();
    if (json.success) {
      showNotification(`✅ ${action === 'open_lid' ? 'Opening' : 'Closing'} ${name} lid…`, 'success');
      logSecurityEvent('ADMIN_LID_COMMAND', { action, compartment, success: true });
    } else {
      showNotification(`❌ ${json.message || 'Command failed'}`, 'error');
      logSecurityEvent('ADMIN_LID_COMMAND', { action, compartment, success: false, reason: json.message });
    }
  } catch (err) {
    showNotification('❌ Could not reach ESP32 backend', 'error');
  }
}

// ============================================================================
// DASHBOARD — live cards, charts
// ============================================================================

function updateMonthDisplay() {
  const cards = document.querySelectorAll('.dashboard-grid .stat-card');
  const s = adminLive.sensors?.sensors;
  const bioFill = s?.ultrasonic?.bio?.fill_level ?? null;
  const nonBioFill = s?.ultrasonic?.nonbio?.fill_level ?? null;
  const avgFill = (bioFill !== null && nonBioFill !== null) ? Math.round((bioFill + nonBioFill) / 2) : null;
  const alertCount = computeRealAlerts().filter(a => a.severity === 'critical' || a.severity === 'warning').length;

  function setCard(card, headerText, value, changeText, changeClass, barPct) {
    if (!card) return;
    const h4 = card.querySelector('.stat-header h4');
    const val = card.querySelector('.stat-value');
    const chg = card.querySelector('.stat-change');
    const bar = card.querySelector('.stat-bar-fill');
    if (h4) h4.textContent = headerText;
    if (val) val.textContent = value;
    if (chg) { chg.textContent = changeText; chg.className = 'stat-change ' + changeClass; }
    if (bar) bar.style.width = Math.max(0, Math.min(100, barPct)) + '%';
  }

  setCard(cards[0], 'Avg Bin Fill (Live)',
    avgFill !== null ? avgFill + '%' : '—',
    adminLive.lastPollOk ? '📡 Live from ESP32' : '⚠️ No data from ESP32 yet',
    adminLive.lastPollOk ? 'positive' : 'negative',
    avgFill ?? 0);

  setCard(cards[1], 'Biodegradable Fill',
    bioFill !== null ? bioFill + '%' : '—',
    bioFill !== null ? (bioFill >= 90 ? '🔴 Needs collection' : '🟢 Normal') : 'Waiting for sensor…',
    bioFill >= 90 ? 'negative' : 'positive',
    bioFill ?? 0);

  setCard(cards[2], 'Active Alerts',
    String(alertCount),
    alertCount > 0 ? '⚠️ Needs attention' : '✅ All clear',
    alertCount > 0 ? 'negative' : 'positive',
    Math.min(100, alertCount * 20));

  const esp32Online = adminLive.esp32Online;
  const uptimeMs = adminLive.esp32Status?.system?.uptime_ms;
  setCard(cards[3], 'ESP32 Connection',
    esp32Online ? 'Online' : 'Offline',
    esp32Online ? ('Uptime: ' + formatAdminUptime(uptimeMs)) : '🔴 Device not responding',
    esp32Online ? 'positive' : 'negative',
    esp32Online ? 100 : 0);
}

function formatAdminUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function refreshLiveDashboardUI() {
  // Bin fill cards
  const s = adminLive.sensors?.sensors;
  const bio = s?.ultrasonic?.bio;
  const nonbio = s?.ultrasonic?.nonbio;
  const gasBio = s?.gas?.bio;
  const gasNonBio = s?.gas?.nonbio;

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setWidth = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%'; };

  if (bio) {
    setText('liveBioFillPct', bio.fill_level + '%');
    setText('liveBioDistance', bio.distance_cm + ' cm to surface');
    setWidth('liveBioFillBar', bio.fill_level);
  }
  if (nonbio) {
    setText('liveNonBioFillPct', nonbio.fill_level + '%');
    setText('liveNonBioDistance', nonbio.distance_cm + ' cm to surface');
    setWidth('liveNonBioFillBar', nonbio.fill_level);
  }
  if (gasBio) {
    setText('liveBioGasBar', gasBio.level_percent + '%');
    setWidth('liveBioGasBar', gasBio.level_percent);
    setText('liveBioGasRaw', gasBio.raw);
  }
  if (gasNonBio) {
    setText('liveNonBioGasBar', gasNonBio.level_percent + '%');
    setWidth('liveNonBioGasBar', gasNonBio.level_percent);
    setText('liveNonBioGasRaw', gasNonBio.raw);
  }

  const ageEl = document.getElementById('liveDataAge');
  if (ageEl) {
    if (!adminLive.lastPollOk) ageEl.textContent = '— no data received from ESP32 yet';
    else ageEl.textContent = adminLive.fresh ? `(updated ${adminLive.ageSeconds}s ago)` : `⚠️ data is ${adminLive.ageSeconds}s old — ESP32 may be offline`;
  }

  updateMonthDisplay();
  updateLiveDistributionChart();
  updateLiveGasChart();
  updateLiveHealthChart();

  // Keep sensors-page quick stats in sync if that page is open
  if (document.getElementById('sensors-page')?.classList.contains('active')) {
    renderRealSensorList();
  }
  if (document.getElementById('alerts-page')?.classList.contains('active')) {
    populateAlerts();
  }
}

// ── Doughnut: live Bio vs Non-Bio fill % (replaces fake 3-slice composition) ──
function initDistributionChart() {
  const ctx = document.getElementById('distributionChart');
  if (!ctx) return;

  distributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Biodegradable Fill %', 'Non-Biodegradable Fill %'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#34d399', '#60a5fa'],
        borderColor: '#0a0f1a',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#c7d2e0', font: { size: 12, weight: 600 }, padding: 15, usePointStyle: true }
        }
      }
    }
  });
}

function updateLiveDistributionChart() {
  if (!distributionChart) return;
  const s = adminLive.sensors?.sensors;
  const bio = s?.ultrasonic?.bio?.fill_level ?? 0;
  const nonbio = s?.ultrasonic?.nonbio?.fill_level ?? 0;
  distributionChart.data.datasets[0].data = [bio, nonbio];
  distributionChart.update('quiet');
}

// ── Bar chart: live gas % per compartment (replaces fake "collection rate") ──
function initPerformanceChart() {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) return;

  performanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Biodegradable', 'Non-Biodegradable'],
      datasets: [
        {
          label: 'Gas Level %',
          data: [0, 0],
          backgroundColor: 'rgba(96, 165, 250, 0.6)',
          borderColor: '#60a5fa',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Fan Trigger Threshold',
          data: [80, 80],
          backgroundColor: 'rgba(251, 146, 60, 0.25)',
          borderColor: '#fb923c',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#c7d2e0', font: { size: 12, weight: 600 }, padding: 15, usePointStyle: true } }
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(30, 39, 71, 0.5)', drawBorder: false }, ticks: { color: '#8b92b4', font: { size: 11 }, callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: { color: '#8b92b4', font: { size: 11 } } }
      }
    }
  });
}

function updateLiveGasChart() {
  if (!performanceChart) return;
  const s = adminLive.sensors?.sensors;
  const gasBio = s?.gas?.bio?.level_percent ?? 0;
  const gasNonBio = s?.gas?.nonbio?.level_percent ?? 0;
  performanceChart.data.datasets[0].data = [gasBio, gasNonBio];
  performanceChart.update('quiet');
}

// ── Radar: real system health (signal/uptime/headroom/gas safety) ──
function initHealthChart() {
  const ctx = document.getElementById('healthChart');
  if (!ctx) return;

  healthChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['WiFi Signal', 'Bio Headroom', 'Non-Bio Headroom', 'Gas Safety', 'Connection Uptime'],
      datasets: [{
        label: 'Live System Health',
        data: [0, 0, 0, 0, 0],
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#0a0f1a',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#c7d2e0', font: { size: 12, weight: 600 }, padding: 15, usePointStyle: true } }
      },
      scales: {
        r: {
          beginAtZero: true, max: 100,
          grid: { color: 'rgba(30, 39, 71, 0.5)' },
          ticks: { color: '#8b92b4', font: { size: 10 }, backdropColor: 'transparent', callback: v => v + '%' },
          pointLabels: { color: '#c7d2e0', font: { size: 11, weight: 600 } }
        }
      }
    }
  });
}

function updateLiveHealthChart() {
  if (!healthChart) return;
  const s = adminLive.sensors?.sensors;
  const rssi = adminLive.esp32Status?.system?.wifi_rssi ?? -100;
  // RSSI ~ -30 (great) to -90 (bad) -> 0-100%
  const signalPct = Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100)));
  const bioHeadroom = 100 - (s?.ultrasonic?.bio?.fill_level ?? 100);
  const nonBioHeadroom = 100 - (s?.ultrasonic?.nonbio?.fill_level ?? 100);
  const maxGas = Math.max(s?.gas?.bio?.level_percent ?? 0, s?.gas?.nonbio?.level_percent ?? 0);
  const gasSafety = 100 - maxGas;
  const connUptime = adminLive.esp32Online ? 100 : 0;

  healthChart.data.datasets[0].data = [signalPct, bioHeadroom, nonBioHeadroom, gasSafety, connUptime];
  healthChart.update('quiet');
}

// ============================================================================
// SENSORS PAGE — real hardware list + live lid status
// ============================================================================

function initializeSensorsPage() {
  renderRealSensorList();
}

function renderRealSensorList() {
  const list = document.getElementById('realSensorList');
  const s = adminLive.sensors?.sensors;
  const lids = adminLive.sensors?.lids;
  const online = adminLive.esp32Online;

  const icon = document.getElementById('sensorsEsp32Icon');
  const statusTxt = document.getElementById('sensorsEsp32Status');
  if (icon) icon.textContent = online ? '🟢' : '🔴';
  if (statusTxt) statusTxt.textContent = online ? 'Online' : 'Offline';

  const badge = document.getElementById('sensorsLiveBadge');
  if (badge) {
    badge.textContent = online ? '● Live' : '● Offline';
    badge.className = 'sensor-status ' + (online ? 'online' : '');
  }

  document.getElementById('sensorsBioFill') && (document.getElementById('sensorsBioFill').textContent = (s?.ultrasonic?.bio?.fill_level ?? '--') + '%');
  document.getElementById('sensorsNonBioFill') && (document.getElementById('sensorsNonBioFill').textContent = (s?.ultrasonic?.nonbio?.fill_level ?? '--') + '%');
  document.getElementById('sensorsRssi') && (document.getElementById('sensorsRssi').textContent = (adminLive.esp32Status?.system?.wifi_rssi ?? '--') + ' dBm');

  if (lids) {
    const bioTxt = document.getElementById('bioLidStatusText');
    const nonbioTxt = document.getElementById('nonbioLidStatusText');
    if (bioTxt) bioTxt.textContent = lids.bio_open ? '🔓 Open' : '🔒 Closed';
    if (nonbioTxt) nonbioTxt.textContent = lids.nonbio_open ? '🔓 Open' : '🔒 Closed';
  }

  if (!list) return;

  if (!s) {
    list.innerHTML = '<div class="sensor-item">No sensor data received from the ESP32 yet.</div>';
    return;
  }

  const rows = [
    { name: 'Ultrasonic — Biodegradable', type: 'Ultrasonic (HC-SR04)', reading: `${s.ultrasonic.bio.fill_level}% full · ${s.ultrasonic.bio.distance_cm} cm` },
    { name: 'Ultrasonic — Non-Biodegradable', type: 'Ultrasonic (HC-SR04)', reading: `${s.ultrasonic.nonbio.fill_level}% full · ${s.ultrasonic.nonbio.distance_cm} cm` },
    { name: 'Gas — Biodegradable', type: 'MQ-135', reading: `${s.gas.bio.level_percent}% · raw ${s.gas.bio.raw}` },
    { name: 'Gas — Non-Biodegradable', type: 'MQ-135', reading: `${s.gas.nonbio.level_percent}% · raw ${s.gas.nonbio.raw}` }
  ];

  list.innerHTML = rows.map(r => `
    <div class="sensor-item">
      <div class="sensor-info">
        <span class="sensor-type">${r.type}</span>
        <span class="detection-type">${r.name}</span>
        <span class="detection-time">${adminLive.sensors.timestamp || ''}</span>
        <span class="accuracy-badge ${online ? 'high' : 'low'}">${r.reading}</span>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// ALERTS PAGE — computed from real thresholds, not hardcoded
// ============================================================================

function computeRealAlerts() {
  const alerts = [];
  const s = adminLive.sensors?.sensors;
  const ts = adminLive.sensors?.timestamp || 'just now';

  if (!adminLive.esp32Online) {
    alerts.push({ id: 'esp32_offline', severity: 'critical', type: 'System', icon: '📡',
      title: 'ESP32 Offline', description: 'The device is not responding to the backend. Sensor and lid data may be stale.',
      time: ts, zone: 'System' });
  }

  if (s) {
    const checks = [
      { key: 'bio_fill', val: s.ultrasonic.bio.fill_level, name: 'Biodegradable', icon: '🌱' },
      { key: 'nonbio_fill', val: s.ultrasonic.nonbio.fill_level, name: 'Non-Biodegradable', icon: '📦' }
    ];
    checks.forEach(c => {
      if (c.val >= 90) {
        alerts.push({ id: c.key + '_critical', severity: 'critical', type: 'Capacity', icon: c.icon,
          title: `${c.name} Bin Critical Level`, description: `Fill level at ${c.val}% — needs immediate collection.`, time: ts, zone: 'Bin' });
      } else if (c.val >= 70) {
        alerts.push({ id: c.key + '_warning', severity: 'warning', type: 'Capacity', icon: '⚠️',
          title: `${c.name} Bin Filling Up`, description: `Fill level at ${c.val}% — schedule collection soon.`, time: ts, zone: 'Bin' });
      }
    });

    const gasChecks = [
      { key: 'bio_gas', val: s.gas.bio.level_percent, name: 'Biodegradable', icon: '🌱' },
      { key: 'nonbio_gas', val: s.gas.nonbio.level_percent, name: 'Non-Biodegradable', icon: '📦' }
    ];
    gasChecks.forEach(c => {
      if (c.val >= 80) {
        alerts.push({ id: c.key + '_critical', severity: 'critical', type: 'Gas', icon: '💨',
          title: `${c.name} Gas Level Critical`, description: `Gas at ${c.val}% — fan should auto-activate.`, time: ts, zone: 'Compartment' });
      } else if (c.val >= 50) {
        alerts.push({ id: c.key + '_warning', severity: 'warning', type: 'Gas', icon: '💨',
          title: `${c.name} Gas Level Elevated`, description: `Gas at ${c.val}% — monitor closely.`, time: ts, zone: 'Compartment' });
      }
    });
  } else if (adminLive.esp32Online) {
    alerts.push({ id: 'no_sensor_data', severity: 'info', type: 'System', icon: 'ℹ️',
      title: 'Waiting for sensor data', description: 'ESP32 is online but no sensor reading has been received yet.', time: ts, zone: 'System' });
  }

  if (alerts.length === 0) {
    alerts.push({ id: 'all_clear', severity: 'success', type: 'System', icon: '✅',
      title: 'All Systems Normal', description: 'No active alerts — fill levels and gas readings are within safe range.', time: ts, zone: 'System' });
  }

  return alerts;
}

function getDismissedAlertIds() {
  const raw = localStorage.getItem('binbot_admin_dismissed_alerts');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function initializeAlertsPage() {
  populateAlerts();
}

function populateAlerts(filterSeverity) {
  const container = document.getElementById('alertsContainer');
  if (!container) return;

  const dismissed = getDismissedAlertIds();
  const now = Date.now();
  let alerts = computeRealAlerts().filter(a => {
    const dismissedAt = dismissed[a.id];
    return !(dismissedAt && (now - dismissedAt) < 60 * 60 * 1000); // re-show after 1 hour
  });

  const activeFilter = filterSeverity || currentAlertFilter || 'all';
  currentAlertFilter = activeFilter;
  if (activeFilter !== 'all') {
    alerts = alerts.filter(a => a.severity === activeFilter);
  }

  if (alerts.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-muted);">No alerts in this category.</p>';
  } else {
    container.innerHTML = alerts.map(alert => `
      <div class="alert-item ${alert.severity}">
        <div class="alert-icon">${alert.icon}</div>
        <div class="alert-content">
          <div class="alert-header">
            <h4>${alert.title}</h4>
            <span class="alert-type">${alert.type}</span>
          </div>
          <p>${alert.description}</p>
          <div class="alert-footer">
            <span class="alert-time">${alert.time}</span>
            <span class="alert-zone">${alert.zone}</span>
          </div>
        </div>
        <div class="alert-actions">
          <button class="btn-action dismiss" onclick="dismissRealAlert('${alert.id}')" title="Dismiss for 1 hour">✕</button>
        </div>
      </div>
    `).join('');
  }

  updateAlertStats(alerts.length ? computeRealAlerts() : computeRealAlerts());
}

let currentAlertFilter = 'all';

function filterAlerts(severity) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (typeof event !== 'undefined' && event.target) event.target.classList.add('active');
  populateAlerts(severity);
}

function dismissRealAlert(id) {
  const dismissed = getDismissedAlertIds();
  dismissed[id] = Date.now();
  localStorage.setItem('binbot_admin_dismissed_alerts', JSON.stringify(dismissed));
  populateAlerts();
}

function dismissAllAlerts() {
  const all = computeRealAlerts();
  const dismissed = getDismissedAlertIds();
  all.forEach(a => { dismissed[a.id] = Date.now(); });
  localStorage.setItem('binbot_admin_dismissed_alerts', JSON.stringify(dismissed));
  populateAlerts();
  showNotification('All current alerts dismissed for 1 hour', 'success');
}

function markAllAsRead() {
  showNotification('Alerts are computed live from sensor thresholds — use Dismiss to hide one for an hour.', 'info');
}

function updateAlertStats(allAlerts) {
  const critical = allAlerts.filter(a => a.severity === 'critical').length;
  const warning = allAlerts.filter(a => a.severity === 'warning').length;
  const info = allAlerts.filter(a => a.severity === 'info').length;
  const resolved = allAlerts.filter(a => a.severity === 'success').length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('criticalAlertsCount', critical);
  set('warningAlertsCount', warning);
  set('infoAlertsCount', info);
  set('resolvedAlertsCount', resolved);
}

// ============================================================================
// REPORTS PAGE — real 30-day log from get-chart-data.php
// ============================================================================

async function initializeReportsPage() {
  await fetchAdminChartData(30);
  renderReportsSummary();
  await updateReportsTrendChart('30');
  renderReportsDailyLog();
}

function renderReportsSummary() {
  const rows = adminLive.chart || [];
  const stats = adminLive.chartStats;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  if (!rows.length) {
    set('reportAvgBio', '--');
    set('reportAvgNonBio', '--');
    set('reportPeakFill', '--');
    set('reportDaysTracked', '0');
    return;
  }

  const avgBio = Math.round(rows.reduce((sum, r) => sum + r.bio_fill, 0) / rows.length);
  const avgNonBio = Math.round(rows.reduce((sum, r) => sum + r.nonbio_fill, 0) / rows.length);

  set('reportAvgBio', avgBio);
  set('reportAvgNonBio', avgNonBio);
  set('reportPeakFill', stats?.peak_fill ?? Math.max(...rows.map(r => Math.max(r.bio_fill, r.nonbio_fill))));
  set('reportDaysTracked', rows.length);
}

async function updateReportsTrendChart(days) {
  const ctx = document.getElementById('reportsTrendChart');
  if (!ctx) return;

  if (reportsTrendChart) reportsTrendChart.destroy();

  const { labels, bioData, nonBioData } = await fetchAdminChartSeries(parseInt(days));
  renderReportsSummary();
  renderReportsDailyLog();

  reportsTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Biodegradable Fill %', data: bioData, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#34d399', pointBorderColor: '#0a0f1a', pointBorderWidth: 2 },
        { label: 'Non-Biodegradable Fill %', data: nonBioData, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#60a5fa', pointBorderColor: '#0a0f1a', pointBorderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#c7d2e0', font: { size: 12, weight: 600 }, padding: 15, usePointStyle: true } } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(30,39,71,0.5)', drawBorder: false }, ticks: { color: '#8b92b4', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: '#8b92b4', font: { size: 11 } } }
      }
    }
  });
}

function renderReportsDailyLog() {
  const tbody = document.getElementById('reportDailyLogBody');
  if (!tbody) return;
  const rows = adminLive.chart || [];
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;color:#8b92b4;">No data logged yet — the ESP32 has not posted any readings.</td></tr>';
    return;
  }
  tbody.innerHTML = [...rows].reverse().map(r => `
    <tr>
      <td>${r.day}</td>
      <td>${r.bio_fill}%</td>
      <td>${r.nonbio_fill}%</td>
    </tr>
  `).join('');
}

function downloadReport(format) {
  const rows = adminLive.chart || [];
  if (!rows.length) {
    showNotification('❌ No real data logged yet to export', 'error');
    return;
  }
  const today = new Date().toISOString().split('T')[0];

  if (format === 'csv') {
    let csv = 'Day,Biodegradable Fill %,Non-Biodegradable Fill %\n';
    rows.forEach(r => { csv += `${r.day},${r.bio_fill},${r.nonbio_fill}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Binbot-FillLog-${today}.csv`;
    link.click();
    showNotification('✅ Real fill-level log downloaded as CSV', 'success');
  } else if (format === 'json') {
    const blob = new Blob([JSON.stringify({ generated: today, daily_readings: rows, stats: adminLive.chartStats }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Binbot-FillLog-${today}.json`;
    link.click();
    showNotification('✅ Real fill-level log downloaded as JSON', 'success');
  }
}

function printReport() {
  window.print();
}