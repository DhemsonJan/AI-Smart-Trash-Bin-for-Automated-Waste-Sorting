/*
 * ============================================================
 *  SMART WASTE SORTER — ESP32-S3  (Firebase Edition)
 * ============================================================
 *  Talks to the ESP32-CAM and the web dashboard entirely through
 *  Firebase Realtime Database. No more local IP addresses —
 *  this board only needs an internet connection, on ANY WiFi
 *  network, to stay in sync with the camera and the dashboard.
 *
 *  Firebase Realtime Database layout used by this sketch:
 *    /binbot/sensors    <- this board writes sensor + lid status
 *    /binbot/command    <- dashboard writes, this board reads + clears
 *    /binbot/detection  <- ESP32-CAM writes, this board reads
 *    /binbot/chart      <- this board writes daily fill history
 *
 *  REQUIRED LIBRARIES (Arduino IDE > Library Manager):
 *    "Firebase ESP Client" by Mobizt
 *    "ESP32Servo" by Kevin Harrington / madhephaestus
 *
 *  UPDATE (label matching fix):
 *    The Edge Impulse model on the ESP32-CAM reports labels like
 *    "Leaves(Biodegradable)" or "Bottle(Recyclable)" — the category
 *    is baked into the label string itself, not sent as a separate
 *    field. isBiodegradable()/isRecyclable() now use substring
 *    matching (indexOf) instead of exact equality (==), so labels
 *    like "Leaves(Biodegradable)" correctly match "Leaves" /
 *    "Biodegradable" instead of falling through to "Unknown label".
 *
 *  UPDATE (lid timing):
 *    OPEN_DURATION_MS and CLOSE_DURATION_MS both set to 2500ms.
 *    Full lid cycle is now: open (CW) 2.5s -> standby 5s -> close (CCW) 2.5s.
 * ============================================================
 */

#include <Arduino.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <time.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ─────────────────────────────────────────────
//  WIFI  <- any network with internet works now
// ─────────────────────────────────────────────
#define WIFI_SSID        "Gryka"
#define WIFI_PASSWORD    "Gryka123"

// ─────────────────────────────────────────────
//  FIREBASE  <- fill these in from your Firebase project
//  Project settings (gear icon) > General > Web app > apiKey
//  Build > Realtime Database > copy the URL shown at the top
// ─────────────────────────────────────────────
#define FIREBASE_API_KEY      "AIzaSyB3sEQ3WE3Dt2yRkhhdza_0foaTnbP3p0s"
#define FIREBASE_DATABASE_URL "https://aitrashbin-afce1-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData    fbdo;
FirebaseAuth    auth;
FirebaseConfig  config;

#define FIRMWARE_VERSION "v3.0.3-firebase"

// ─────────────────────────────────────────────
//  PIN DEFINITIONS  (unchanged from your original wiring)
// ─────────────────────────────────────────────
#define SERVO_BIO_PIN       4
#define SERVO_NONBIO_PIN    5

#define TRIG_BIO            7
#define ECHO_BIO            15
#define TRIG_NONBIO         16
#define ECHO_NONBIO         17

#define GAS_BIO_PIN         1
#define GAS_NONBIO_PIN      2

// ─────────────────────────────────────────────
//  SERVO PULSE WIDTHS
// ─────────────────────────────────────────────
#define SERVO_CW_US         1300
#define SERVO_STOP_US       1500
#define SERVO_CCW_US        1800

// Full lid cycle: open (CW) 2.5s -> standby (hold open) 5s -> close (CCW) 2.5s
#define OPEN_DURATION_MS    1500
#define STANDBY_MS          5000
#define CLOSE_DURATION_MS   1000

// ─────────────────────────────────────────────
//  SENSOR THRESHOLDS
// ─────────────────────────────────────────────
#define BIN_DEPTH_CM        30     // Full bin depth (distance from sensor to bottom)
#define BIN_FULL_CM         5      // Distance = bin is full
#define GAS_MAX_RAW         4095   // Max ADC value for 100%

// ─────────────────────────────────────────────
//  TIMING
// ─────────────────────────────────────────────
#define SENSOR_POST_MS      2000    // write sensor data every 2 s
#define COMMAND_POLL_MS     1000    // check for dashboard commands every 1 s
#define DETECTION_POLL_MS   700     // check for camera detections every 0.7 s
#define CHART_LOG_MS        60000   // update the daily chart log once a minute

// ─────────────────────────────────────────────
//  OBJECTS
// ─────────────────────────────────────────────
Servo servoBio;
Servo servoNonBio;

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
bool lidBioOpen    = false;
bool lidNonBioOpen = false;

unsigned long lastSensorPost    = 0;
unsigned long lastCommandPoll   = 0;
unsigned long lastDetectionPoll = 0;
unsigned long lastChartLog      = 0;
unsigned long lastMonitorPrint  = 0;

String lastCommandId   = "";
String lastDetectionId = "";

// ─────────────────────────────────────────────
//  FILL LEVEL CALCULATION
//  Maps distance -> fill % (0% = empty, 100% = full)
// ─────────────────────────────────────────────
int distanceToFillPercent(float distCM) {
    if (distCM < 0) return 0;  // Sensor error -> report 0
    if (distCM <= BIN_FULL_CM) return 100;
    if (distCM >= BIN_DEPTH_CM) return 0;
    float fill = (float)(BIN_DEPTH_CM - distCM) / (float)(BIN_DEPTH_CM - BIN_FULL_CM) * 100.0f;
    return (int)constrain(fill, 0, 100);
}

int rawToGasPercent(int raw) {
    return (int)((float)raw / GAS_MAX_RAW * 100.0f);
}

// ─────────────────────────────────────────────
//  WIFI CONNECT
// ─────────────────────────────────────────────
void connectWiFi() {
    Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
        if (++attempts > 40) {
            Serial.println("\n[WIFI] Failed — restarting");
            ESP.restart();
        }
    }
    Serial.printf("\n[WIFI] Connected! IP: %s (this IP no longer matters — Firebase handles routing)\n",
                  WiFi.localIP().toString().c_str());
}

// ─────────────────────────────────────────────
//  FIREBASE CONNECT
// ─────────────────────────────────────────────
void connectFirebase() {
    config.api_key      = FIREBASE_API_KEY;
    config.database_url = FIREBASE_DATABASE_URL;

    // Anonymous sign-in — enable "Anonymous" under
    // Firebase Console > Authentication > Sign-in method
    if (Firebase.signUp(&config, &auth, "", "")) {
        Serial.println("[FIREBASE] Signed in anonymously");
    } else {
        Serial.printf("[FIREBASE] Sign-in failed: %s\n",
                      config.signer.signupError.message.c_str());
    }

    config.token_status_callback = tokenStatusCallback; // see addons/TokenHelper.h
    Firebase.reconnectWiFi(true);
    fbdo.setBSSLBufferSize(2048, 1024);
    Firebase.begin(&config, &auth);
}

// ─────────────────────────────────────────────
//  NTP TIME (only used to date-stamp the chart log)
// ─────────────────────────────────────────────
void setupTime() {
    // Philippines = UTC+8. Change gmtOffset_sec if you're elsewhere.
    configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");
}

bool getDateString(char *out, size_t outLen) {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo, 1000)) return false;  // NTP not synced yet
    strftime(out, outLen, "%Y-%m-%d", &timeinfo);
    return true;
}

// ─────────────────────────────────────────────
//  ULTRASONIC HELPER
// ─────────────────────────────────────────────
float readDistanceCM(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    long dur = pulseIn(echoPin, HIGH, 30000);
    if (dur == 0) return -1.0f;
    return (dur * 0.0343f) / 2.0f;
}

// ─────────────────────────────────────────────
//  SERVO HELPERS
// ─────────────────────────────────────────────
void openServo(Servo &srv) {
    srv.writeMicroseconds(SERVO_CW_US);
    delay(OPEN_DURATION_MS);
    srv.writeMicroseconds(SERVO_STOP_US);
}

void closeServo(Servo &srv) {
    srv.writeMicroseconds(SERVO_CCW_US);
    delay(CLOSE_DURATION_MS);
    srv.writeMicroseconds(SERVO_STOP_US);
}

// ─────────────────────────────────────────────
//  OPEN / CLOSE LID  (called from Firebase commands + camera detections)
// ─────────────────────────────────────────────
void openLid(bool isBio) {
    Servo      &srv  = isBio ? servoBio : servoNonBio;
    const char *name = isBio ? "BIO"    : "NONBIO";
    Serial.printf("[LID] Opening %s...\n", name);
    openServo(srv);
    if (isBio) lidBioOpen = true; else lidNonBioOpen = true;

    delay(STANDBY_MS);

    Serial.printf("[LID] Auto-closing %s...\n", name);
    closeServo(srv);
    if (isBio) lidBioOpen = false; else lidNonBioOpen = false;
    Serial.printf("[LID] %s closed.\n", name);
}

void closeLid(bool isBio) {
    Servo      &srv  = isBio ? servoBio : servoNonBio;
    const char *name = isBio ? "BIO"    : "NONBIO";
    Serial.printf("[LID] Force-closing %s...\n", name);
    closeServo(srv);
    if (isBio) lidBioOpen = false; else lidNonBioOpen = false;
}

// ─────────────────────────────────────────────
//  WRITE SENSOR DATA -> Firebase  (/binbot/sensors)
// ─────────────────────────────────────────────
void postSensorData() {
    if (WiFi.status() != WL_CONNECTED || !Firebase.ready()) return;

    float bioDist    = readDistanceCM(TRIG_BIO,    ECHO_BIO);
    float nonbioDist = readDistanceCM(TRIG_NONBIO, ECHO_NONBIO);
    int   gasRawBio    = analogRead(GAS_BIO_PIN);
    int   gasRawNonBio = analogRead(GAS_NONBIO_PIN);

    int fillBio    = distanceToFillPercent(bioDist);
    int fillNonBio = distanceToFillPercent(nonbioDist);
    int gasPctBio    = rawToGasPercent(gasRawBio);
    int gasPctNonBio = rawToGasPercent(gasRawNonBio);

    FirebaseJson json;
    json.set("ultra_bio_cm",    bioDist);
    json.set("ultra_nonbio_cm", nonbioDist);
    json.set("fill_bio",        fillBio);
    json.set("fill_nonbio",     fillNonBio);
    json.set("gas_bio_raw",     gasRawBio);
    json.set("gas_nonbio_raw",  gasRawNonBio);
    json.set("gas_bio_pct",     gasPctBio);
    json.set("gas_nonbio_pct",  gasPctNonBio);
    json.set("lid_bio_open",    lidBioOpen);
    json.set("lid_nonbio_open", lidNonBioOpen);
    json.set("rssi",            WiFi.RSSI());
    json.set("ip",              WiFi.localIP().toString());
    json.set("uptime_ms",       (double)millis());
    json.set("firmware",        FIRMWARE_VERSION);
    json.set("free_heap",       (int)ESP.getFreeHeap());
    json.set("last_seen/.sv",   "timestamp");   // server-side timestamp — no clock sync needed

    if (Firebase.RTDB.setJSON(&fbdo, "/binbot/sensors", &json)) {
        Serial.printf("[FIREBASE] Sensors updated (B:%d%% NB:%d%%)\n", fillBio, fillNonBio);
    } else {
        Serial.printf("[FIREBASE] Sensor write failed: %s\n", fbdo.errorReason().c_str());
    }
}

// ─────────────────────────────────────────────
//  DAILY CHART LOG -> Firebase  (/binbot/chart/{date})
//  Keeps the highest fill reading seen each day, same as the old PHP logic.
// ─────────────────────────────────────────────
void updateChartLog() {
    char dateStr[11];
    if (!getDateString(dateStr, sizeof(dateStr))) return;  // NTP not ready yet, skip this round

    float bioDist    = readDistanceCM(TRIG_BIO,    ECHO_BIO);
    float nonbioDist = readDistanceCM(TRIG_NONBIO, ECHO_NONBIO);
    int   fillBio    = distanceToFillPercent(bioDist);
    int   fillNonBio = distanceToFillPercent(nonbioDist);

    String path = String("/binbot/chart/") + dateStr;

    int existingBio = 0, existingNonBio = 0;
    if (Firebase.RTDB.getInt(&fbdo, (path + "/bio_fill").c_str()))    existingBio    = fbdo.intData();
    if (Firebase.RTDB.getInt(&fbdo, (path + "/nonbio_fill").c_str())) existingNonBio = fbdo.intData();

    FirebaseJson json;
    json.set("date",        dateStr);
    json.set("bio_fill",    max(fillBio,    existingBio));
    json.set("nonbio_fill", max(fillNonBio, existingNonBio));

    if (Firebase.RTDB.updateNode(&fbdo, path.c_str(), &json)) {
        Serial.printf("[FIREBASE] Chart log updated for %s\n", dateStr);
    }
}

// ─────────────────────────────────────────────
//  POLL FOR COMMANDS <- Firebase  (/binbot/command)
// ─────────────────────────────────────────────
void pollForCommand() {
    if (!Firebase.ready()) return;
    if (!Firebase.RTDB.getJSON(&fbdo, "/binbot/command")) return;

    FirebaseJson    &json = fbdo.jsonObject();
    FirebaseJsonData result;

    json.get(result, "pending");
    bool pending = result.success && result.boolValue;
    if (!pending) return;

    json.get(result, "id");
    String id = result.success ? result.stringValue : "";
    if (id == "" || id == lastCommandId) return;

    json.get(result, "action");
    String action = result.success ? result.stringValue : "";
    json.get(result, "compartment");
    String compartment = result.success ? result.stringValue : "";
    json.get(result, "source");
    String source = result.success ? result.stringValue : "manual";

    Serial.printf("[CMD] action=%s compartment=%s source=%s\n",
                  action.c_str(), compartment.c_str(), source.c_str());

    if (action == "open_lid") {
        if      (compartment == "bio")    openLid(true);
        else if (compartment == "nonbio") openLid(false);
    } else if (action == "close_lid") {
        if      (compartment == "bio")    closeLid(true);
        else if (compartment == "nonbio") closeLid(false);
    }

    lastCommandId = id;
    Firebase.RTDB.setBool(&fbdo, "/binbot/command/pending", false);
}

// ─────────────────────────────────────────────
//  CATEGORY MAPS (for camera labels)
//
//  FIX: The Edge Impulse model reports labels like
//  "Leaves(Biodegradable)" or "Bottle(Recyclable)" — the category
//  name is embedded INSIDE the label string, not a separate exact
//  label. Exact equality (==) will never match these, so we use
//  indexOf() substring matching instead. This also means any label
//  containing "Biodegradable" or "Recyclable" (or one of the listed
//  keywords) anywhere in the string will match correctly.
// ─────────────────────────────────────────────
bool isBiodegradable(const String &label) {
    return label.indexOf("Biodegradable") >= 0 ||
           label.indexOf("Cartoon")       >= 0 ||
           label.indexOf("Cup")           >= 0 ||
           label.indexOf("Eggshell")      >= 0 ||
           label.indexOf("Leaves")        >= 0 ||
           label.indexOf("Paper")         >= 0 ||
           label.indexOf("Styro")         >= 0;
}

bool isRecyclable(const String &label) {
    return label.indexOf("Recyclable") >= 0 ||
           label.indexOf("Bottle")     >= 0 ||
           label.indexOf("Can")        >= 0 ||
           label.indexOf("Glass")      >= 0 ||
           label.indexOf("Plastic")    >= 0;
}

// ─────────────────────────────────────────────
//  POLL FOR DETECTIONS <- Firebase  (/binbot/detection)
//  (replaces the old direct UDP packet from ESP32-CAM)
// ─────────────────────────────────────────────
void pollForDetection() {
    if (!Firebase.ready()) return;
    if (!Firebase.RTDB.getJSON(&fbdo, "/binbot/detection")) return;

    FirebaseJson    &json = fbdo.jsonObject();
    FirebaseJsonData result;

    json.get(result, "id");
    String id = result.success ? result.stringValue : "";
    if (id == "" || id == lastDetectionId) return;
    lastDetectionId = id;

    json.get(result, "label");
    String label = result.success ? result.stringValue : "";
    json.get(result, "confidence");
    float confidence = result.success ? result.floatValue : 0;

    Serial.printf("[DETECT] %s (%.2f) via Firebase\n", label.c_str(), confidence);

    if (isBiodegradable(label)) {
        Serial.println("[DETECT] -> BIODEGRADABLE bin");
        openLid(true);
    } else if (isRecyclable(label)) {
        Serial.println("[DETECT] -> RECYCLABLE bin");
        openLid(false);
    } else {
        Serial.printf("[DETECT] Unknown label \"%s\" — ignoring.\n", label.c_str());
    }
}

// ─────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    Serial.println("\n[BOOT] Binbot ESP32-S3 — Firebase Edition");

    pinMode(TRIG_BIO,    OUTPUT);
    pinMode(ECHO_BIO,    INPUT);
    pinMode(TRIG_NONBIO, OUTPUT);
    pinMode(ECHO_NONBIO, INPUT);

    ESP32PWM::allocateTimer(0);
    ESP32PWM::allocateTimer(1);
    servoBio.setPeriodHertz(50);
    servoNonBio.setPeriodHertz(50);
    servoBio.attach(SERVO_BIO_PIN,    500, 2500);
    servoNonBio.attach(SERVO_NONBIO_PIN, 500, 2500);
    servoBio.writeMicroseconds(SERVO_STOP_US);
    servoNonBio.writeMicroseconds(SERVO_STOP_US);
    Serial.println("[BOOT] Servos stopped");

    connectWiFi();
    setupTime();
    connectFirebase();

    postSensorData();   // first reading immediately

    Serial.println("[BOOT] System ready! Routing through Firebase — no IP needed.\n");
}

// ─────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────
void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Lost — reconnecting...");
        connectWiFi();
    }

    unsigned long now = millis();

    if (now - lastSensorPost >= SENSOR_POST_MS) {
        lastSensorPost = now;
        postSensorData();
    }

    if (now - lastCommandPoll >= COMMAND_POLL_MS) {
        lastCommandPoll = now;
        pollForCommand();
    }

    if (now - lastDetectionPoll >= DETECTION_POLL_MS) {
        lastDetectionPoll = now;
        pollForDetection();
    }

    if (now - lastChartLog >= CHART_LOG_MS) {
        lastChartLog = now;
        updateChartLog();
    }

    if (now - lastMonitorPrint >= 5000) {
        lastMonitorPrint = now;
        Serial.printf("[STATUS] Uptime:%lus | Heap:%u | RSSI:%d dBm\n",
                      now / 1000, ESP.getFreeHeap(), WiFi.RSSI());
    }
}
