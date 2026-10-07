// ============================================================================
// firebase-config.js — Binbot Dashboard
// ----------------------------------------------------------------------------
// Fill in the two values below from your Firebase project, then load this
// file BEFORE Binbot.js (Binbot.php already does this for you).
//
// Where to find them:
//   1. Firebase Console → Project settings (⚙️) → General → "Your apps" →
//      Web app → copy the "apiKey" value.
//   2. Firebase Console → Build → Realtime Database → copy the URL shown
//      at the top of the page (looks like https://xxxx-default-rtdb.
//      <region>.firebasedatabase.app).
//
// Also make sure, under Build → Authentication → Sign-in method, that
// "Anonymous" is enabled — that's what lets this dashboard (and the ESP32
// boards) read/write without a username/password.
// ============================================================================

const firebaseConfig = {
  apiKey:      "AIzaSyB3sEQ3WE3Dt2yRkhhdza_0foaTnbP3p0s",
  databaseURL: "https://aitrashbin-afce1-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);

// Anonymous sign-in — required once you move the database rules out of
// test mode. Harmless to leave in even while still in test mode.
firebase.auth().signInAnonymously().catch((err) => {
  console.error('[FIREBASE] Anonymous sign-in failed:', err.message);
});

// Shared Realtime Database handle used throughout Binbot.js
const db = firebase.database();
