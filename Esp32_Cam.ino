/*
 * ============================================================
 *  SMART WASTE SORTER - ESP32-CAM  (Firebase Edition)
 * ============================================================
 *  - Runs Edge Impulse inference on camera frames (unchanged)
 *  - Connects to WiFi as a client
 *  - Sends the top detection label to Firebase Realtime Database
 *    instead of UDP — works on ANY WiFi network with internet,
 *    no need to know the ESP32-S3's IP address anymore.
 *
 *  REQUIRED LIBRARIES:
 *    Edge Impulse SDK    (your exported Arduino library: sigbin_inferencing)
 *    "Firebase ESP Client" by Mobizt — Library Manager search "Firebase ESP Client"
 *
 *  ⚠️ MEMORY NOTE: the AI-Thinker ESP32-CAM module has limited RAM, and the
 *  camera + Edge Impulse model already use a lot of it. Adding a TLS-based
 *  Firebase client on top can be tight. This sketch uses a small TLS buffer
 *  (setBSSLBufferSize) to help, and prints free heap to Serial so you can
 *  watch for trouble. If you see crashes/reboots, the first things to try
 *  are: lower jpeg_quality, drop FRAMESIZE_QVGA further, or reduce
 *  EI_CAMERA_RAW_FRAME_BUFFER_COLS/ROWS.
 * ============================================================
 */

/* Includes ---------------------------------------------------------------- */
#include <sigbin_inferencing.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"
#include "esp_camera.h"
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// Optional: disable the brownout detector so a power dip doesn't reset the
// board. This does NOT fix low voltage — it just stops the safety reset —
// so only keep this enabled while you're diagnosing/fixing the power supply.
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ─────────────────────────────────────────────
//  WIFI  <- any network with internet works now
// ─────────────────────────────────────────────
#define WIFI_SSID        "Gryka"       // Your WiFi SSID
#define WIFI_PASSWORD    "Gryka123"       // Your WiFi password

// ─────────────────────────────────────────────
//  FIREBASE  <- same project/credentials as the ESP32-S3 sketch
// ─────────────────────────────────────────────
#define FIREBASE_API_KEY      "AIzaSyB3sEQ3WE3Dt2yRkhhdza_0foaTnbP3p0s"
#define FIREBASE_DATABASE_URL "https://aitrashbin-afce1-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

// Minimum confidence to send a detection (0.0 – 1.0)
#define MIN_CONFIDENCE   0.70f

// ─────────────────────────────────────────────
//  CAMERA PINS  (AI Thinker ESP32-CAM) — unchanged
// ─────────────────────────────────────────────
#define CAMERA_MODEL_AI_THINKER // Has PSRAM

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

/* Constant defines -------------------------------------------------------- */
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS   320
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS   240
#define EI_CAMERA_FRAME_BYTE_SIZE         3

/* Private variables ------------------------------------------------------- */
static bool debug_nn       = false;
static bool is_initialised = false;
uint8_t *snapshot_buf;

static unsigned long detectionCounter = 0;
unsigned long lastHeartbeat = 0;
#define HEARTBEAT_MS 5000

static camera_config_t camera_config = {
    .pin_pwdn       = PWDN_GPIO_NUM,
    .pin_reset      = RESET_GPIO_NUM,
    .pin_xclk       = XCLK_GPIO_NUM,
    .pin_sscb_sda   = SIOD_GPIO_NUM,
    .pin_sscb_scl   = SIOC_GPIO_NUM,
    .pin_d7         = Y9_GPIO_NUM,
    .pin_d6         = Y8_GPIO_NUM,
    .pin_d5         = Y7_GPIO_NUM,
    .pin_d4         = Y6_GPIO_NUM,
    .pin_d3         = Y5_GPIO_NUM,
    .pin_d2         = Y4_GPIO_NUM,
    .pin_d1         = Y3_GPIO_NUM,
    .pin_d0         = Y2_GPIO_NUM,
    .pin_vsync      = VSYNC_GPIO_NUM,
    .pin_href       = HREF_GPIO_NUM,
    .pin_pclk       = PCLK_GPIO_NUM,
    .xclk_freq_hz   = 20000000,
    .ledc_timer     = LEDC_TIMER_0,
    .ledc_channel   = LEDC_CHANNEL_0,
    .pixel_format   = PIXFORMAT_JPEG,
    .frame_size     = FRAMESIZE_QVGA,
    .jpeg_quality   = 12,
    .fb_count       = 1,
    .fb_location    = CAMERA_FB_IN_PSRAM,
    .grab_mode      = CAMERA_GRAB_WHEN_EMPTY,
};

/* Function declarations --------------------------------------------------- */
bool ei_camera_init(void);
void ei_camera_deinit(void);
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf);
static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr);
void connectWiFi(void);
void connectFirebase(void);
void sendLabel(const char *label, float confidence);
void sendHeartbeat(void);

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
            Serial.println("\n[WIFI] Failed! Restarting...");
            ESP.restart();
        }
    }
    Serial.printf("\n[WIFI] Connected! IP: %s (no longer needs to be shared with the S3)\n",
                  WiFi.localIP().toString().c_str());
}

// ─────────────────────────────────────────────
//  FIREBASE CONNECT
// ─────────────────────────────────────────────
void connectFirebase() {
    config.api_key      = FIREBASE_API_KEY;
    config.database_url = FIREBASE_DATABASE_URL;

    if (Firebase.signUp(&config, &auth, "", "")) {
        Serial.println("[FIREBASE] Signed in anonymously");
    } else {
        Serial.printf("[FIREBASE] Sign-in failed: %s\n",
                      config.signer.signupError.message.c_str());
    }

    config.token_status_callback = tokenStatusCallback; // see addons/TokenHelper.h
    Firebase.reconnectWiFi(true);
    // Smaller TLS buffers — the AI-Thinker module's RAM is tight once the
    // camera + Edge Impulse model are already loaded.
    fbdo.setBSSLBufferSize(1024, 512);
    Firebase.begin(&config, &auth);
}

// ─────────────────────────────────────────────
//  SEND DETECTION -> Firebase  (/binbot/detection)
// ─────────────────────────────────────────────
void sendLabel(const char *label, float confidence) {
    if (!Firebase.ready()) {
        Serial.println("[FIREBASE] Not ready, skipping send");
        return;
    }

    String id = String(millis()) + "_" + String(detectionCounter++);

    FirebaseJson json;
    json.set("id",            id);
    json.set("label",         label);
    json.set("confidence",    confidence);
    json.set("timestamp/.sv", "timestamp");

    if (Firebase.RTDB.setJSON(&fbdo, "/binbot/detection", &json)) {
        Serial.printf("[FIREBASE] Sent -> %s (%.2f)\n", label, confidence);
    } else {
        Serial.printf("[FIREBASE] Send failed: %s\n", fbdo.errorReason().c_str());
    }
}

// ─────────────────────────────────────────────
//  HEARTBEAT -> Firebase  (/binbot/camStatus)
//  Lets the dashboard show the camera as online even when nothing
//  is currently being detected.
// ─────────────────────────────────────────────
void sendHeartbeat() {
    if (!Firebase.ready()) return;
    FirebaseJson json;
    json.set("last_seen/.sv", "timestamp");
    Firebase.RTDB.setJSON(&fbdo, "/binbot/camStatus", &json);
}

// ─────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────
void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout reset — diagnostic only, see note above
    Serial.begin(115200);
    Serial.println("\n[BOOT] ESP32-CAM Waste Detector — Firebase Edition");

    if (!ei_camera_init()) {
        Serial.println("[ERROR] Camera init failed!");
    } else {
        Serial.println("[BOOT] Camera ready");
    }

    connectWiFi();
    connectFirebase();

    Serial.println("[BOOT] Starting inference in 2 seconds...");
    delay(2000);
}

// ─────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────
void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Reconnecting...");
        connectWiFi();
    }

    if (millis() - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = millis();
        sendHeartbeat();
    }

    if (ei_sleep(5) != EI_IMPULSE_OK) return;

    snapshot_buf = (uint8_t*)malloc(
        EI_CAMERA_RAW_FRAME_BUFFER_COLS *
        EI_CAMERA_RAW_FRAME_BUFFER_ROWS *
        EI_CAMERA_FRAME_BYTE_SIZE
    );

    if (snapshot_buf == nullptr) {
        Serial.println("[ERROR] Failed to allocate snapshot buffer!");
        return;
    }

    ei::signal_t signal;
    signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
    signal.get_data     = &ei_camera_get_data;

    if (!ei_camera_capture(
            (size_t)EI_CLASSIFIER_INPUT_WIDTH,
            (size_t)EI_CLASSIFIER_INPUT_HEIGHT,
            snapshot_buf)) {
        Serial.println("[ERROR] Camera capture failed");
        free(snapshot_buf);
        return;
    }

    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR err = run_classifier(&signal, &result, debug_nn);
    if (err != EI_IMPULSE_OK) {
        Serial.printf("[ERROR] Classifier failed (%d)\n", err);
        free(snapshot_buf);
        return;
    }

    // ── Object Detection mode ──────────────────
#if EI_CLASSIFIER_OBJECT_DETECTION == 1
    const char *bestLabel = nullptr;
    float       bestConf  = 0.0f;

    for (uint32_t i = 0; i < result.bounding_boxes_count; i++) {
        ei_impulse_result_bounding_box_t bb = result.bounding_boxes[i];
        if (bb.value == 0) continue;

        Serial.printf("[DETECT] %s (%.2f) [x:%u y:%u w:%u h:%u]\n",
            bb.label, bb.value, bb.x, bb.y, bb.width, bb.height);

        if (bb.value > bestConf) {
            bestConf  = bb.value;
            bestLabel = bb.label;
        }
    }

    if (bestLabel != nullptr && bestConf >= MIN_CONFIDENCE) {
        sendLabel(bestLabel, bestConf);
    }

    // ── Classification mode ────────────────────
#else
    const char *bestLabel = nullptr;
    float       bestConf  = 0.0f;

    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        float val = result.classification[i].value;
        Serial.printf("[CLASSIFY] %s: %.5f\n",
            ei_classifier_inferencing_categories[i], val);

        if (val > bestConf) {
            bestConf  = val;
            bestLabel = ei_classifier_inferencing_categories[i];
        }
    }

    if (bestLabel != nullptr && bestConf >= MIN_CONFIDENCE) {
        sendLabel(bestLabel, bestConf);
    }
#endif

    free(snapshot_buf);
}

// ─────────────────────────────────────────────
//  CAMERA FUNCTIONS  (unchanged from Edge Impulse)
// ─────────────────────────────────────────────
bool ei_camera_init(void) {
    if (is_initialised) return true;

    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) {
        Serial.printf("[ERROR] Camera init 0x%x\n", err);
        return false;
    }

    sensor_t *s = esp_camera_sensor_get();
    if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1);
        s->set_brightness(s, 1);
        s->set_saturation(s, 0);
    }

    is_initialised = true;
    return true;
}

void ei_camera_deinit(void) {
    esp_err_t err = esp_camera_deinit();
    if (err != ESP_OK) {
        Serial.println("[ERROR] Camera deinit failed");
        return;
    }
    is_initialised = false;
}

bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) {
    if (!is_initialised) {
        Serial.println("[ERROR] Camera not initialized");
        return false;
    }

    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[ERROR] Camera capture failed");
        return false;
    }

    bool converted = fmt2rgb888(fb->buf, fb->len, PIXFORMAT_JPEG, snapshot_buf);
    esp_camera_fb_return(fb);

    if (!converted) {
        Serial.println("[ERROR] Format conversion failed");
        return false;
    }

    if ((img_width  != EI_CAMERA_RAW_FRAME_BUFFER_COLS) ||
        (img_height != EI_CAMERA_RAW_FRAME_BUFFER_ROWS)) {
        ei::image::processing::crop_and_interpolate_rgb888(
            out_buf,
            EI_CAMERA_RAW_FRAME_BUFFER_COLS,
            EI_CAMERA_RAW_FRAME_BUFFER_ROWS,
            out_buf,
            img_width,
            img_height);
    }

    return true;
}

static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr) {
    size_t pixel_ix    = offset * 3;
    size_t pixels_left = length;
    size_t out_ptr_ix  = 0;

    while (pixels_left != 0) {
        out_ptr[out_ptr_ix] =
            (snapshot_buf[pixel_ix + 2] << 16) +
            (snapshot_buf[pixel_ix + 1] << 8)  +
             snapshot_buf[pixel_ix];
        out_ptr_ix++;
        pixel_ix += 3;
        pixels_left--;
    }
    return 0;
}

#if !defined(EI_CLASSIFIER_SENSOR) || EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_CAMERA
#error "Invalid model for current sensor"
#endif
