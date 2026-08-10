// Kulzzy Radio Live Community
// Admin Control System

import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  ref,
  onValue,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


// ======================================================
// ADMIN SETTINGS
// ======================================================

const ADMIN_EMAIL = "dstnewz.ng@gmail.com";


// ======================================================
// ELEMENTS
// ======================================================

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");

const emailInput = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");

const callersList = document.getElementById("callersList");

const generalMuteButton =
  document.getElementById("generalMuteButton");

const allowOneButton =
  document.getElementById("allowOneButton");

const adminMessage =
  document.getElementById("adminMessage");


// ======================================================
// VARIABLES
// ======================================================

let callers = {};

let generalMute = true;

let allowOneMode = false;

let selectedCaller = null;


// ======================================================
// HELPER
// ======================================================

function showMessage(message) {

  if (!adminMessage) return;

  adminMessage.textContent = message;

}


// ======================================================
// LOGIN
// ======================================================

if (loginButton) {

  loginButton.addEventListener("click", async () => {

    const email = emailInput.value.trim();

    const password = passwordInput.value;


    if (!email || !password) {

      showMessage("Enter your admin email and password.");

      return;

    }


    try {

      loginButton.disabled = true;

      loginButton.textContent = "LOGGING IN...";


      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


      showMessage("Login successful.");

    } catch (error) {

      console.error(error);

      showMessage(
        "Login failed. Check your email and password."
      );

    } finally {

      loginButton.disabled = false;

      loginButton.textContent = "LOGIN";

    }

  });

}


// ======================================================
// AUTHENTICATION STATE
// ======================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {

    if (loginBox) {
      loginBox.style.display = "block";
    }

    if (adminPanel) {
      adminPanel.style.display = "none";
    }

    return;

  }


  /*
   * IMPORTANT:
   * Only your designated admin email should be allowed
   * to use this panel.
   */

  if (
    ADMIN_EMAIL !== "YOUR_ADMIN_EMAIL_HERE" &&
    user.email !== ADMIN_EMAIL
  ) {

    showMessage("This account is not authorized.");

    signOut(auth);

    return;

  }


  if (loginBox) {
    loginBox.style.display = "none";
  }

  if (adminPanel) {
    adminPanel.style.display = "block";
  }


  startCallerListener();

});


// ======================================================
// LOGOUT
// ======================================================

if (logoutButton) {

  logoutButton.addEventListener("click", async () => {

    try {

      await signOut(auth);

      showMessage("Logged out.");

    } catch (error) {

      console.error(error);

    }

  });

}


// ======================================================
// LISTEN FOR CALLERS
// ======================================================

function startCallerListener() {

  const callersRef = ref(db, "callers");


  onValue(callersRef, (snapshot) => {

    const data = snapshot.val() || {};

    callers = data;

    renderCallers();

  });

}


// ======================================================
// DISPLAY CALLERS
// ======================================================

function renderCallers() {

  if (!callersList) return;


  callersList.innerHTML = "";


  const entries = Object.entries(callers);


  if (entries.length === 0) {

    callersList.innerHTML = `
      <div class="empty-callers">
        No callers connected.
      </div>
    `;

    return;

  }


  entries.forEach(([uid, caller]) => {

    if (!caller) return;

    if (caller.online === false) return;


    const card = document.createElement("div");

    card.className = "caller-card";


    const phone = caller.phone || "Unknown";

    const status = caller.status || "waiting";

    const muted = caller.muted === true;

    const allowed =
      caller.allowedToSpeak === true;


    card.innerHTML = `

      <div class="caller-information">

        <div class="caller-icon">
          👤
        </div>

        <div>

          <div class="caller-phone">
            ${escapeHTML(phone)}
          </div>

          <div class="caller-status">

            ${getStatusText(
              status,
              muted,
              allowed
            )}

          </div>

        </div>

      </div>


      <div class="caller-controls">

        <button
          class="allow-button"
          data-action="allow"
          data-uid="${uid}"
        >
          🎙️ ALLOW
        </button>


        <button
          class="mute-button"
          data-action="mute"
          data-uid="${uid}"
        >
          ${muted ? "🔊 UNMUTE" : "🔇 MUTE"}
        </button>


        <button
          class="disconnect-button"
          data-action="disconnect"
          data-uid="${uid}"
        >
          ❌ DISCONNECT
        </button>

      </div>

    `;


    callersList.appendChild(card);

  });


  attachCallerButtons();

}


// ======================================================
// STATUS TEXT
// ======================================================

function getStatusText(
  status,
  muted,
  allowed
) {

  if (status === "disconnected") {

    return "🔴 Disconnected";

  }


  if (muted) {

    return "🔇 Muted";

  }


  if (allowed) {

    return "🎙️ Allowed to speak";

  }


  return "⏳ Waiting";

}


// ======================================================
// CALLER BUTTONS
// ======================================================

function attachCallerButtons() {

  const buttons =
    callersList.querySelectorAll(
      "button[data-action]"
    );


  buttons.forEach((button) => {

    button.addEventListener("click", async () => {

      const action =
        button.dataset.action;

      const uid =
        button.dataset.uid;


      if (action === "allow") {

        await allowCaller(uid);

      }


      if (action === "mute") {

        await toggleMute(uid);

      }


      if (action === "disconnect") {

        await disconnectCaller(uid);

      }

    });

  });

}


// ======================================================
// ALLOW CALLER
// ======================================================

async function allowCaller(uid) {

  if (generalMute && !allowOneMode) {

    showMessage(
      "General Mute is active. Use Allow 1 Person mode first."
    );

    return;

  }


  try {

    selectedCaller = uid;


    const callerRef =
      ref(db, `callers/${uid}`);


    await update(callerRef, {

      allowedToSpeak: true,

      muted: false,

      status: "speaking"

    });


    showMessage(
      "Caller has been allowed to speak."
    );


  } catch (error) {

    console.error(error);

    showMessage(
      "Unable to allow caller."
    );

  }

}


// ======================================================
// MUTE / UNMUTE CALLER
// ======================================================

async function toggleMute(uid) {

  const caller = callers[uid];


  if (!caller) return;


  const currentlyMuted =
    caller.muted === true;


  try {

    await update(
      ref(db, `callers/${uid}`),
      {

        muted: !currentlyMuted,

        allowedToSpeak:
          currentlyMuted,

        status:
          currentlyMuted
            ? "speaking"
            : "muted"

      }
    );


    showMessage(
      currentlyMuted
        ? "Caller microphone allowed."
        : "Caller muted."
    );


  } catch (error) {

    console.error(error);

    showMessage(
      "Unable to change microphone status."
    );

  }

}


// ======================================================
// DISCONNECT CALLER
// ======================================================

async function disconnectCaller(uid) {

  try {

    await update(
      ref(db, `callers/${uid}`),
      {

        status: "disconnected",

        muted: true,

        allowedToSpeak: false,

        online: false

      }
    );


    showMessage(
      "Caller disconnected."
    );


  } catch (error) {

    console.error(error);

    showMessage(
      "Unable to disconnect caller."
    );

  }

}


// ======================================================
// GENERAL MUTE
// ======================================================

if (generalMuteButton) {

  generalMuteButton.addEventListener(
    "click",
    async () => {

      try {

        generalMute = true;

        allowOneMode = false;

        selectedCaller = null;


        const updates = {};


        Object.keys(callers).forEach((uid) => {

          const caller = callers[uid];

          if (!caller) return;

          if (caller.online === false) return;


          updates[
            `callers/${uid}/muted`
          ] = true;


          updates[
            `callers/${uid}/allowedToSpeak`
          ] = false;


          updates[
            `callers/${uid}/status`
          ] = "muted";

        });


        if (Object.keys(updates).length > 0) {

          await update(
            ref(db),
            updates
          );

        }


        showMessage(
          "GENERAL MUTE activated. Everyone is muted."
        );


        updateControlButtons();

      } catch (error) {

        console.error(error);

        showMessage(
          "Unable to activate General Mute."
        );

      }

    }
  );

}


// ======================================================
// GENERAL MUTE + ALLOW ONE PERSON
// ======================================================

if (allowOneButton) {

  allowOneButton.addEventListener(
    "click",
    async () => {

      allowOneMode = true;

      generalMute = true;

      selectedCaller = null;


      try {

        const updates = {};


        Object.keys(callers).forEach((uid) => {

          const caller = callers[uid];

          if (!caller) return;

          if (caller.online === false) return;


          updates[
            `callers/${uid}/muted`
          ] = true;


          updates[
            `callers/${uid}/allowedToSpeak`
          ] = false;


          updates[
            `callers/${uid}/status`
          ] = "muted";

        });


        if (Object.keys(updates).length > 0) {

          await update(
            ref(db),
            updates
          );

        }


        showMessage(
          "General Mute active. Select ALLOW for one caller."
        );


        updateControlButtons();

      } catch (error) {

        console.error(error);

        showMessage(
          "Unable to activate Allow 1 Person mode."
        );

      }

    }
  );

}


// ======================================================
// CONTROL BUTTON DISPLAY
// ======================================================

function updateControlButtons() {

  if (!generalMuteButton) return;

  if (!allowOneButton) return;


  if (allowOneMode) {

    allowOneButton.classList.add(
      "active"
    );

    generalMuteButton.classList.remove(
      "active"
    );

  } else {

    allowOneButton.classList.remove(
      "active"
    );

    generalMuteButton.classList.add(
      "active"
    );

  }

}


// ======================================================
// SECURITY / HTML ESCAPING
// ======================================================

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

      }
