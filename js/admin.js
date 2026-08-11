// ======================================================
// KULZZY RADIO NETWORK
// LIVE COMMUNITY ADMIN CONTROL
// js/admin.js
// ======================================================

import {
  auth,
  db
} from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  ref,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  connectHost,
  closeWebRTC
} from "./webrtc.js";


// ======================================================
// ELEMENTS
// ======================================================

const loginBox =
  document.getElementById("loginBox");

const adminPanel =
  document.getElementById("adminPanel");

const adminEmail =
  document.getElementById("adminEmail");

const adminPassword =
  document.getElementById("adminPassword");

const loginButton =
  document.getElementById("loginButton");

const logoutButton =
  document.getElementById("logoutButton");

const adminMessage =
  document.getElementById("adminMessage");

const controlMessage =
  document.getElementById("controlMessage");

const generalMuteButton =
  document.getElementById("generalMuteButton");

const allowOneButton =
  document.getElementById("allowOneButton");

const callersList =
  document.getElementById("callersList");

const callerCount =
  document.getElementById("callerCount");


// ======================================================
// VARIABLES
// ======================================================

let callers = {};

let generalMute = true;

let allowOneMode = false;

let selectedCaller = null;

let connectedCaller = null;

let callersListenerStarted = false;


// ======================================================
// MESSAGE FUNCTIONS
// ======================================================

function showLoginMessage(message) {

  if (!adminMessage) {
    return;
  }

  adminMessage.textContent =
    message;

}


function clearLoginMessage() {

  if (!adminMessage) {
    return;
  }

  adminMessage.textContent =
    "";

}


function showControlMessage(message) {

  if (!controlMessage) {
    return;
  }

  controlMessage.textContent =
    message;

}


// ======================================================
// LOGIN
// ======================================================

loginButton.addEventListener(
  "click",
  async () => {

    clearLoginMessage();

    const email =
      adminEmail.value.trim();

    const password =
      adminPassword.value;


    if (!email) {

      showLoginMessage(
        "Please enter your admin email."
      );

      return;

    }


    if (!password) {

      showLoginMessage(
        "Please enter your password."
      );

      return;

    }


    loginButton.disabled =
      true;

    loginButton.textContent =
      "LOGGING IN...";


    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


      /*
       * onAuthStateChanged below will
       * open the admin panel.
       */

    } catch (error) {

      console.error(
        "Admin login error:",
        error
      );


      let message =
        "Unable to login.";

      if (
        error.code ===
        "auth/invalid-credential"
      ) {

        message =
          "Incorrect email or password.";

      } else if (
        error.code ===
        "auth/invalid-email"
      ) {

        message =
          "Please enter a valid email address.";

      } else if (
        error.code ===
        "auth/too-many-requests"
      ) {

        message =
          "Too many login attempts. Please try again later.";

      } else if (
        error.code ===
        "auth/user-disabled"
      ) {

        message =
          "This admin account has been disabled.";

      }


      showLoginMessage(
        message
      );


      loginButton.disabled =
        false;

      loginButton.textContent =
        "LOGIN";

    }

  }
);


// ======================================================
// ALLOW ENTER KEY TO LOGIN
// ======================================================

adminPassword.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Enter"
    ) {

      loginButton.click();

    }

  }
);


// ======================================================
// AUTHENTICATION STATE
// ======================================================

onAuthStateChanged(
  auth,
  (user) => {

    if (user) {

      console.log(
        "Admin logged in:",
        user.email
      );


      loginBox.style.display =
        "none";


      adminPanel.style.display =
        "block";


      loginButton.disabled =
        false;

      loginButton.textContent =
        "LOGIN";


      clearLoginMessage();


      startCallerListener();


      updateControlUI();


    } else {

      console.log(
        "No admin user logged in."
      );


      loginBox.style.display =
        "block";


      adminPanel.style.display =
        "none";


      loginButton.disabled =
        false;

      loginButton.textContent =
        "LOGIN";

    }

  }
);


// ======================================================
// LOGOUT
// ======================================================

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      if (connectedCaller) {

        try {

          await closeWebRTC(
            connectedCaller
          );

        } catch (error) {

          console.error(
            "WebRTC close error:",
            error
          );

        }

        connectedCaller =
          null;

        selectedCaller =
          null;

      }


      await signOut(
        auth
      );


    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

      showControlMessage(
        "Unable to logout."
      );

    }

  }
);


// ======================================================
// FIREBASE CALLER LISTENER
// ======================================================

function startCallerListener() {

  if (callersListenerStarted) {
    return;
  }

  callersListenerStarted =
    true;


  const callersRef =
    ref(
      db,
      "callers"
    );


  onValue(
    callersRef,
    (snapshot) => {

      const data =
        snapshot.val() || {};


      callers = {};


      Object.keys(data)
        .forEach(
          (uid) => {

            const caller =
              data[uid];


            if (
              caller &&
              caller.online !== false
            ) {

              callers[uid] =
                caller;

            }

          }
        );


      renderCallers();

    },
    (error) => {

      console.error(
        "Unable to read callers from Firebase:",
        error
      );


      callersList.innerHTML =
        `
        <div class="empty-callers">
          Unable to read callers from Firebase.
        </div>
        `;

      callerCount.textContent =
        "0";

    }
  );

}


// ======================================================
// RENDER CALLERS
// ======================================================

function renderCallers() {

  const ids =
    Object.keys(callers);


  callerCount.textContent =
    ids.length;


  if (ids.length === 0) {

    callersList.innerHTML =
      `
      <div class="empty-callers">
        📭 No callers connected.
      </div>
      `;

    return;

  }


  callersList.innerHTML =
    "";


  ids.forEach(
    (uid) => {

      const caller =
        callers[uid];


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "caller-card";


      const isMuted =
        caller.muted === true;


      const isAllowed =
        caller.allowedToSpeak === true &&
        caller.muted === false;


      let statusText =
        "⏳ Waiting";


      if (isAllowed) {

        statusText =
          "🎙️ Speaking";

      } else if (isMuted) {

        statusText =
          "🔇 Muted";

      } else if (
        caller.status ===
        "offline"
      ) {

        statusText =
          "⚫ Offline";

      }


      card.innerHTML =
        `
        <div class="caller-information">

          <div class="caller-icon">
            👤
          </div>

          <div>

            <div class="caller-phone">
              ${escapeHTML(
                caller.phone ||
                "Unknown caller"
              )}
            </div>

            <div class="caller-status">
              ${statusText}
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
            ${
              isMuted
                ? "🔊 UNMUTE"
                : "🔇 MUTE"
            }
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


      callersList.appendChild(
        card
      );

    }
  );

}


// ======================================================
// CALLER BUTTON ACTIONS
// ======================================================

callersList.addEventListener(
  "click",
  async (event) => {

    const button =
      event.target.closest(
        "button[data-action]"
      );


    if (!button) {
      return;
    }


    const uid =
      button.dataset.uid;

    const action =
      button.dataset.action;


    if (!uid) {
      return;
    }


    if (
      action ===
      "allow"
    ) {

      await allowCaller(
        uid
      );

    }


    if (
      action ===
      "mute"
    ) {

      await toggleMute(
        uid
      );

    }


    if (
      action ===
      "disconnect"
    ) {

      await disconnectCaller(
        uid
      );

    }

  }
);


// ======================================================
// GENERAL MUTE BUTTON
// ======================================================

generalMuteButton.addEventListener(
  "click",
  async () => {

    await activateGeneralMute();

  }
);


// ======================================================
// GENERAL MUTE
// ======================================================

async function activateGeneralMute() {

  try {

    generalMute =
      true;

    allowOneMode =
      false;


    const updates =
      {};


    Object.keys(callers)
      .forEach(
        (uid) => {

          updates[
            `callers/${uid}/muted`
          ] = true;


          updates[
            `callers/${uid}/allowedToSpeak`
          ] = false;


          updates[
            `callers/${uid}/status`
          ] = "muted";

        }
      );


    if (
      Object.keys(updates)
        .length > 0
    ) {

      await update(
        ref(db),
        updates
      );

    }


    if (connectedCaller) {

      try {

        await closeWebRTC(
          connectedCaller
        );

      } catch (error) {

        console.error(
          "WebRTC close error:",
          error
        );

      }


      connectedCaller =
        null;

      selectedCaller =
        null;

    }


    updateControlUI();


    showControlMessage(
      "🔇 General Mute is active. All callers are muted."
    );


  } catch (error) {

    console.error(
      "General mute error:",
      error
    );


    showControlMessage(
      "Unable to activate General Mute."
    );

  }

}


// ======================================================
// ALLOW ONE PERSON BUTTON
// ======================================================

allowOneButton.addEventListener(
  "click",
  async () => {

    allowOneMode =
      true;

    generalMute =
      true;


    updateControlUI();


    showControlMessage(
      "🎙️ GENERAL MUTE + ALLOW 1 PERSON is active. Choose ALLOW beside one caller."
    );

  }
);


// ======================================================
// ALLOW CALLER
// ======================================================

async function allowCaller(uid) {

  const caller =
    callers[uid];


  if (!caller) {

    showControlMessage(
      "Caller is no longer connected."
    );

    return;

  }


  try {

    // ==============================================
    // ALLOW ONE PERSON MODE
    // ==============================================

    if (allowOneMode) {

      const updates =
        {};


      Object.keys(callers)
        .forEach(
          (otherUid) => {

            if (
              otherUid === uid
            ) {
              return;
            }


            updates[
              `callers/${otherUid}/muted`
            ] = true;


            updates[
              `callers/${otherUid}/allowedToSpeak`
            ] = false;


            updates[
              `callers/${otherUid}/status`
            ] = "muted";

          }
        );


      updates[
        `callers/${uid}/muted`
      ] = false;


      updates[
        `callers/${uid}/allowedToSpeak`
      ] = true;


      updates[
        `callers/${uid}/status`
      ] = "speaking";


      await update(
        ref(db),
        updates
      );

    } else {

      // ============================================
      // NORMAL ALLOW
      // ============================================

      await update(
        ref(
          db,
          `callers/${uid}`
        ),
        {

          muted:
            false,

          allowedToSpeak:
            true,

          status:
            "speaking"

        }
      );

    }


    // ==============================================
    // WEBRTC HOST CONNECTION
    // ==============================================

    showControlMessage(
      "🎙️ Caller allowed. Connecting microphone..."
    );


    if (
      connectedCaller &&
      connectedCaller !== uid
    ) {

      try {

        await closeWebRTC(
          connectedCaller
        );

      } catch (error) {

        console.error(
          "Previous WebRTC close error:",
          error
        );

      }

    }


    await connectHost(
      uid
    );


    connectedCaller =
      uid;

    selectedCaller =
      uid;


    showControlMessage(
      "🎙️ Caller is allowed. Waiting for them to press PLAY LIVE AUDIO."
    );


  } catch (error) {

    console.error(
      "Allow caller error:",
      error
    );


    showControlMessage(
      "Unable to connect this caller."
    );

  }

}


// ======================================================
// MUTE / UNMUTE
// ======================================================

async function toggleMute(uid) {

  const caller =
    callers[uid];


  if (!caller) {

    showControlMessage(
      "Caller is no longer connected."
    );

    return;

  }


  const currentlyMuted =
    caller.muted === true;


  try {

    // ==============================================
    // UNMUTE
    // ==============================================

    if (currentlyMuted) {

      if (
        allowOneMode &&
        selectedCaller &&
        selectedCaller !== uid
      ) {

        showControlMessage(
          "GENERAL MUTE + ALLOW 1 PERSON allows only one caller."
        );

        return;

      }


      await update(
        ref(
          db,
          `callers/${uid}`
        ),
        {

          muted:
            false,

          allowedToSpeak:
            true,

          status:
            "speaking"

        }
      );


      if (
        connectedCaller !== uid
      ) {

        showControlMessage(
          "🎙️ Connecting caller..."
        );


        if (connectedCaller) {

          try {

            await closeWebRTC(
              connectedCaller
            );

          } catch (error) {

            console.error(
              "Previous WebRTC close error:",
              error
            );

          }

        }


        await connectHost(
          uid
        );


        connectedCaller =
          uid;

        selectedCaller =
          uid;

      }


      showControlMessage(
        "🔊 Caller microphone is unmuted."
      );


    } else {

      // ==============================================
      // MUTE
      // ==============================================

      await update(
        ref(
          db,
          `callers/${uid}`
        ),
        {

          muted:
            true,

          allowedToSpeak:
            false,

          status:
            "muted"

        }
      );


      if (
        connectedCaller === uid
      ) {

        try {

          await closeWebRTC(
            uid
          );

        } catch (error) {

          console.error(
            "WebRTC mute error:",
            error
          );

        }


        connectedCaller =
          null;

        selectedCaller =
          null;

      }


      showControlMessage(
        "🔇 Caller microphone muted."
      );

    }

  } catch (error) {

    console.error(
      "Mute/unmute error:",
      error
    );


    showControlMessage(
      "Unable to change caller microphone."
    );

  }

}


// ======================================================
// DISCONNECT CALLER
// ======================================================

async function disconnectCaller(uid) {

  try {

    await update(
      ref(
        db,
        `callers/${uid}`
      ),
      {

        online:
          false,

        status:
          "disconnected",

        muted:
          true,

        allowedToSpeak:
          false

      }
    );


    if (
      connectedCaller === uid
    ) {

      try {

        await closeWebRTC(
          uid
        );

      } catch (error) {

        console.error(
          "WebRTC disconnect error:",
          error
        );

      }


      connectedCaller =
        null;

      selectedCaller =
        null;

    }


    showControlMessage(
      "❌ Caller disconnected."
    );


  } catch (error) {

    console.error(
      "Disconnect error:",
      error
    );


    showControlMessage(
      "Unable to disconnect caller."
    );

  }

}


// ======================================================
// CONTROL BUTTON UI
// ======================================================

function updateControlUI() {

  if (generalMute) {

    generalMuteButton.classList.add(
      "active"
    );

  } else {

    generalMuteButton.classList.remove(
      "active"
    );

  }


  if (allowOneMode) {

    allowOneButton.classList.add(
      "active"
    );

  } else {

    allowOneButton.classList.remove(
      "active"
    );

  }

}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(value) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ======================================================
// INITIAL STATE
// ======================================================

generalMute =
  true;

allowOneMode =
  false;

updateControlUI();


console.log(
  "🎙️ Kulzzy Radio Live Community Admin loaded."
);
