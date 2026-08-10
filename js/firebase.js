// Kulzzy Live Community
// Firebase Configuration

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9t1vD22---PDIPsFEjUvzNk6-5he9j9o",
  authDomain: "kulzzy-live-community.firebaseapp.com",
  databaseURL: "https://kulzzy-live-community-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kulzzy-live-community",
  storageBucket: "kulzzy-live-community.firebasestorage.app",
  messagingSenderId: "58845684099",
  appId: "1:58845684099:web:e19f506c5969184cae96b6",
  measurementId: "G-5GCB9MNP7M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(app);

// Firebase Realtime Database
const db = getDatabase(app);

// Export for other JavaScript files
export { app, auth, db };
