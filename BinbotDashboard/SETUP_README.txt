# Binbot Dashboard ↔ ESP32-S3 Integration Setup
================================================

## STEP 1 — Copy PHP files to XAMPP

Copy all 5 PHP files into:
  C:\xampp\htdocs\BinbotDashboard\api\

  ├── post-sensor-data.php    ← ESP32-S3 POSTs sensor readings here
  ├── get-sensor-data.php     ← Dashboard JS reads sensor data here
  ├── get-chart-data.php      ← Dashboard JS reads chart history here
  ├── send-command.php        ← Dashboard JS sends lid commands here
  ├── get-command.php         ← ESP32-S3 polls for commands here
  └── get-esp32-status.php    ← Dashboard JS checks online status here

The PHP files auto-create these data files in the same folder:
  sensor_data.json        (latest sensor snapshot)
  chart_log.json          (30-day fill history)
  pending_command.json    (queued lid command)


## STEP 2 — Find your PC's IP address

  1. Open Command Prompt (Win+R → cmd → Enter)
  2. Type:  ipconfig
  3. Look for:  "IPv4 Address . . . . . . . : 192.168.X.X"
  4. That is your DASHBOARD_IP


## STEP 3 — Update ESP32_S3_Binbot.ino

  Change line:
    #define DASHBOARD_IP  "192.168.1.5"
  To your actual PC IP, e.g.:
    #define DASHBOARD_IP  "192.168.1.42"

  Also confirm your WiFi credentials are correct:
    #define WIFI_SSID      "Maglasang"
    #define WIFI_PASSWORD  "quinhazon"


## STEP 4 — Install Arduino library

  In Arduino IDE → Sketch → Include Library → Manage Libraries
  Search: "ArduinoJson"
  Install: ArduinoJson by Benoit Blanchon (version 6.x)


## STEP 5 — Upload firmware

  1. Select board: ESP32S3 Dev Module (or your exact board)
  2. Upload ESP32_S3_Binbot.ino
  3. Open Serial Monitor at 115200 baud
  4. You should see:
       [WIFI] Connected! IP: 192.168.X.X
       [HTTP] Sensor data posted OK (fill B:0% NB:0%)


## STEP 6 — Fix the missing fetchESP32Status in Binbot.js

  Open Binbot.js and find the function fetchSensorData() (around line 40).
  Paste the contents of fetchESP32Status_patch.js BEFORE that function.

  Then find startRealtimePolling() and add this line:
    setInterval(fetchESP32Status, 5000);


## STEP 7 — Test

  1. Start XAMPP → Apache
  2. Open dashboard:  http://localhost/BinbotDashboard/Binbot.php
  3. Power on ESP32-S3
  4. Within 3 seconds the header dot should turn GREEN (ESP32 Online)
  5. Fill level circles and gas bars should update every 2 seconds
  6. Click Open/Close lid buttons → ESP32 servo should respond within 1 second


## DATA FLOW DIAGRAM

  ESP32-CAM
      │ UDP "LABEL:Bottle:0.95"
      ▼
  ESP32-S3  ──── POST /api/post-sensor-data.php ──►  XAMPP (sensor_data.json)
      │                                                        │
      │◄─── GET /api/get-command.php ─────────────────────────┤
      │                                                        │
      │                                              Dashboard JS
      │                                              (Binbot.js)
      │                                                    │
      │                                         fetchSensorData() every 2s
      │                                         fetchESP32Status() every 5s
      │                                         sendCommandToESP32() on button click


## TROUBLESHOOTING

  ESP32 Serial shows "[HTTP] POST failed: -1"
  → XAMPP Apache is not running, or DASHBOARD_IP is wrong

  Dashboard dot stays RED
  → Check that esp32-status.php exists in the api/ folder
  → Check browser console for 404 errors (wrong API_BASE path)

  Lid button does nothing
  → Open Serial Monitor — do you see "[CMD] Received: action=open_lid"?
  → If not, get-command.php is not being reached

  Fill circles stuck at 0%
  → Check sensor wiring (TRIG/ECHO pins 25/26 and 27/32)
  → Open Serial Monitor and look for "[ULTRA]" lines
