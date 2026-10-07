<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Binbot Admin Login - Premium Edition</title>
  <link rel="stylesheet" href="login-enhanced.css">
</head>
<body>

<div class="login-container">
  <!-- Left Side - Branding -->
  <div class="login-branding">
    <div class="branding-content">
      <div class="branding-logo">
        <span class="logo-icon">🗑️</span>
        <h1>Binbot</h1>
        <p class="logo-subtitle">Smart Waste Management</p>
      </div>
      
      <div class="branding-features">
        <h2>Welcome to Binbot Admin</h2>
        <p class="branding-description">Real-time waste management system for smart cities</p>
        
        <div class="features-list">
          <div class="feature-item">
            <span class="feature-icon">📊</span>
            <div class="feature-text">
              <h3>Real-time Analytics</h3>
              <p>Monitor waste collection in real-time</p>
            </div>
          </div>

          <div class="feature-item">
            <span class="feature-icon">🚨</span>
            <div class="feature-text">
              <h3>Smart Alerts</h3>
              <p>Get notified of critical issues</p>
            </div>
          </div>

          <div class="feature-item">
            <span class="feature-icon">👥</span>
            <div class="feature-text">
              <h3>User Management</h3>
              <p>Manage team and permissions</p>
            </div>
          </div>

          <div class="feature-item">
            <span class="feature-icon">🔒</span>
            <div class="feature-text">
              <h3>Secure Access</h3>
              <p>Enterprise-grade security</p>
            </div>
          </div>
        </div>
      </div>

      <div class="branding-footer">
        <p>© 2026 Binbot. All rights reserved.</p>
        <p class="version">v1.0 Premium Edition</p>
      </div>
    </div>
  </div>

  <!-- Right Side - Login Form -->
  <div class="login-panel">
    <div class="login-content">
      <div class="login-header">
        <h1>Admin Login</h1>
        <p>Sign in to access your dashboard</p>
      </div>

      <!-- Login Form -->
      <form id="loginForm" class="login-form active-form" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label for="loginEmail">Email Address</label>
          <div class="input-wrapper">
            <span class="input-icon">📧</span>
            <input 
              type="email" 
              id="loginEmail" 
              placeholder="admin@binbot.com" 
              required
            >
          </div>
        </div>

        <div class="form-group">
          <label for="loginPassword">Password</label>
          <div class="input-wrapper">
            <span class="input-icon">🔒</span>
            <input 
              type="password" 
              id="loginPassword" 
              class="password-input" 
              placeholder="Enter your password" 
              required
            >
            <button 
              type="button" 
              class="toggle-password" 
              onclick="togglePasswordField('loginPassword')"
            >👁️</button>
          </div>
        </div>

        <div class="form-check">
          <input type="checkbox" id="rememberMe">
          <label for="rememberMe">Remember me on this device</label>
        </div>

        <button type="submit" class="btn-login">
          <span>Sign In</span>
          <span class="btn-icon">→</span>
        </button>

        <div class="forgot-password">
          <a href="#" onclick="showResetForm(event)">Forgot your password?</a>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- Error/Success Notifications -->
<div id="notification" class="notification"></div>

<script src="login-enhanced.js"></script>
</body>
</html>
