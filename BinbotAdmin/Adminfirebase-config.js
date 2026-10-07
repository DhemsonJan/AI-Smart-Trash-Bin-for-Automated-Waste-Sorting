// ============================================================================
// firebase-config.js — shared by Binbot.html and admin.html
// Same Firebase project as the main dashboard (per your confirmation).
// ============================================================================

const firebaseConfig = {
  apiKey:      "AIzaSyB3sEQ3WE3Dt2yRkhhdza_0foaTnbP3p0s",
  databaseURL: "https://aitrashbin-afce1-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);

firebase.auth().signInAnonymously().catch((err) => {
  console.error('[FIREBASE] Anonymous sign-in failed:', err.message);
});

const db = firebase.database();
