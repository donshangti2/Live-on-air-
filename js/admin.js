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

let callersUnsubscribe = null;


// ======================================================
// MESSAGE FUNCTIONS
// ======================================================

function showLoginMessage(message) {

  if (adminMessage) {
    adminMessage.textContent = message;
  }

}


function clearLoginMessage() {

  if (adminMessage) {
    adminMessage.textContent = "";
  }

}


function showControlMessage(message) {

  if (controlMessage) {
    controlMessage.textContent = message;
  }

}


// ======================================================
// LOGIN
// ======================================================

if (loginButton) {

  loginButton.addEventListener(
    "click",
    async () => {

      clearLoginMessage();

      const email =
        adminEmail
          ? adminEmail.value.trim()
          : "";

      const password =
        adminPassword
          ? adminPassword.value
          : "";


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


      loginButton.disabled = true;

      loginButton.textContent =
        "LOGGING IN...";


      try {

        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );


        console.log(
          "Firebase login successful."
        );

        console.log(
          "Admin email:",
          result.user.email
        );

        console.log(
          "Admin UID:",
          result.user.uid
        );


        /*
         * DO NOT start the database listener here.
         *
         * onAuthStateChanged() below will start it
         * after Firebase confirms the authenticated
         * session.
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

        } else {

          message =
            error.message ||
            "Unable to login.";

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

}


// ======================================================
// ENTER KEY LOGIN
// ======================================================

if (adminPassword) {

  adminPassword.addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {

        if (loginButton) {
          loginButton.click();
        }

      }

    }
  );

}


// ======================================================
// AUTHENTICATION STATE
// ======================================================

onAuthStateChanged(
  auth,
  async (user) => {

    console.log(
      "Firebase authentication state changed."
    );


    if (user) {

      console.log(
        "Authenticated admin:",
        user.email
      );

      console.log(
        "Authenticated admin UID:",
        user.uid
      );


      if (loginBox) {

        loginBox.style.display =
          "none";

      }


      if (adminPanel) {

        adminPanel.style.display =
          "block";

      }


      if (loginButton) {

        loginButton.disabled =
          false;

        loginButton.textContent =
          "LOGIN";

      }


      clearLoginMessage();


      /*
       * Wait one small moment so Firebase Auth has
       * completely established the session before
       * Realtime Database is accessed.
       */

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 150)
      );


      startCallerListener();

      updateControlUI();


    } else {

      console.log(
        "No Firebase admin user is logged in."
      );


      stopCallerListener();


      if (loginBox) {

        loginBox.style.display =
          "block";

      }


      if (adminPanel) {

        adminPanel.style.display =
          "none";

      }


      if (loginButton) {

        loginButton.disabled =
          false;

        loginButton.textContent =
          "LOGIN";

      }

    }

  }
);


// ======================================================
// START CALLER LISTENER
// ======================================================

function startCallerListener() {

  /*
   * Prevent duplicate listeners.
   */

  if (callersListenerStarted) {

    console.log(
      "Caller listener is already running."
    );

    return;

  }


  /*
   * Check Firebase Authentication again.
   */

  const user =
    auth.currentUser;


  if (!user) {

    console.error(
      "Cannot start caller listener: no authenticated Firebase user."
    );


    showDatabaseError(
      "You are not authenticated with Firebase."
    );

    return;

  }


  console.log(
    "Starting Firebase caller listener."
  );

  console.log(
    "Authenticated UID:",
    user.uid
  );

  console.log(
    "Authenticated email:",
    user.email
  );


  const callersRef =
    ref(
      db,
      "callers"
    );


  callersListenerStarted =
    true;


  callersUnsubscribe =
    onValue(
      callersRef,

      (snapshot) => {

        console.log(
          "Firebase /callers data received."
        );


        const data =
          snapshot.val() || {};


        callers = {};


        /*
         * IMPORTANT:
         *
         * Do NOT remove offline callers.
         *
         * This allows the admin panel to keep the
         * caller number visible after the caller
         * temporarily disconnects.
         */

        Object.keys(data)
          .forEach(
            (uid) => {

              const caller =
                data[uid];


              if (caller) {

                callers[uid] =
                  caller;

              }

            }
          );


        renderCallers();

      },

      (error) => {

        console.error(
          "================================"
        );

        console.error(
          "FIREBASE DATABASE ERROR"
        );

        console.error(
          "Code:",
          error.code
        );

        console.error(
          "Message:",
          error.message
        );

        console.error(
          "================================"
        );


        callersListenerStarted =
          false;


        showDatabaseError(
          error
        );

      }
    );

}


// ======================================================
// STOP CALLER LISTENER
// ======================================================

function stopCallerListener() {

  if (callersUnsubscribe) {

    try {

      callersUnsubscribe();

    } catch (error) {

      console.error(
        "Unable to stop caller listener:",
        error
      );

    }

  }


  callersUnsubscribe =
    null;

  callersListenerStarted =
    false;

}


// ======================================================
// FIREBASE DATABASE ERROR
// ======================================================

function showDatabaseError(error) {

  let message =
    "Unable to read callers from Firebase.";


  if (
    error &&
    error.code
  ) {

    message =
      `❌ Firebase Database Error\n\nCode: ${error.code}\n${error.message || ""}`;

  } else if (
    typeof error === "string"
  ) {

    message =
      error;

  }


  console.error(
    message
  );


  if (callersList) {

    callersList.innerHTML =
      `
      <div class="empty-callers">
        ❌ Firebase Database Error
        <br><br>
        ${escapeHTML(
          error && error.code
            ? "Code: " + error.code
            : ""
        )}
        <br>
        ${escapeHTML(
          error && error.message
            ? error.message
            : "Unable to read callers from Firebase."
        )}
      </div>
      `;

  }


  if (callerCount) {

    callerCount.textContent =
      "0";

  }


  showControlMessage(
    "❌ Firebase cannot read the callers database. Check the Firebase Rules and authenticated admin UID."
  );

}


// ======================================================
// RENDER CALLERS
// ======================================================

function renderCallers() {

  if (!callerCount || !callersList) {
    return;
  }


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


      if (!caller) {
        return;
      }


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "caller-card";


      const isMuted =
        caller.muted === true;


      const isOnline =
        caller.online !== false &&
        caller.status !== "disconnected";


      const isAllowed =
        caller.allowedToSpeak === true &&
        caller.muted === false;


      let statusText =
        "⏳ WAITING";


      if (!isOnline) {

        statusText =
          "⚫ OFFLINE";

      } else if (isAllowed) {

        statusText =
          "🎙️ SPEAKING";

      } else if (isMuted) {

        statusText =
          "🔇 MUTED";

      } else if (
        caller.status === "waiting"
      ) {

        statusText =
          "⏳ WAITING";

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
            data-uid="${escapeHTML(uid)}"
          >
            🎙️ ALLOW
          </button>


          <button
            class="mute-button"
            data-action="mute"
            data-uid="${escapeHTML(uid)}"
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
            data-uid="${escapeHTML(uid)}"
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

if (callersList) {

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
        action === "allow"
      ) {

        await allowCaller(
          uid
        );

      }


      if (
        action === "mute"
      ) {

        await toggleMute(
          uid
        );

      }


      if (
        action === "disconnect"
      ) {

        await disconnectCaller(
          uid
        );

      }

    }
  );

}


// ======================================================
// GENERAL MUTE BUTTON
// ======================================================

if (generalMuteButton) {

  generalMuteButton.addEventListener(
    "click",
    async () => {

      await activateGeneralMute();

    }
  );

}


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
      Object.keys(updates).length > 0
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
      "❌ Unable to activate General Mute."
    );

  }

}


// ======================================================
// ALLOW ONE PERSON BUTTON
// ======================================================

if (allowOneButton) {

  allowOneButton.addEventListener(
    "click",
    async () => {

      allowOneMode =
        true;

      generalMute =
        true;


      updateControlUI();


      showControlMessage(
        "🎙️ GENERAL MUTE + ALLOW 1 PERSON is active. Choose ALLOW beside one online caller."
      );

    }
  );

}


// ======================================================
// ALLOW CALLER
// ======================================================

async function allowCaller(uid) {

  const caller =
    callers[uid];


  if (!caller) {

    showControlMessage(
      "❌ Caller is no longer available."
    );

    return;

  }


  try {

    /*
     * If caller is offline, don't try to connect
     * WebRTC yet. Keep their number in the panel.
     */

    if (
      caller.online === false ||
      caller.status === "disconnected"
    ) {

      showControlMessage(
        "📱 This caller is currently offline. They can join again when they receive the notification."
      );

      return;

    }


    // ==================================================
    // ALLOW ONE PERSON MODE
    // ==================================================

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


            /*
             * Only mute other callers.
             * Do NOT delete them.
             */

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

      // ==============================================
      // NORMAL ALLOW
      // ==============================================

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
            "speaking",

          online:
            true

        }
      );

    }


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
      "❌ Unable to connect this caller."
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
      "❌ Caller is no longer available."
    );

    return;

  }


  const currentlyMuted =
    caller.muted === true;


  try {

    // ==================================================
    // UNMUTE
    // ==================================================
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

      // ==================================================
      // MUTE
      // ==================================================

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
      "❌ Unable to change caller microphone."
    );

  }

}


// ======================================================
// DISCONNECT CALLER
// ======================================================

async function disconnectCaller(uid) {

  try {

    /*
     * IMPORTANT:
     *
     * We do NOT delete the caller.
     *
     * We simply mark them disconnected so
     * their phone number stays in the panel.
     */

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
      "❌ Caller disconnected. Their number remains in the caller list."
    );


  } catch (error) {

    console.error(
      "Disconnect error:",
      error
    );


    showControlMessage(
      "❌ Unable to disconnect caller."
    );

  }

}


// ======================================================
// LOGOUT
// ======================================================

if (logoutButton) {

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


        stopCallerListener();


        await signOut(
          auth
        );


      } catch (error) {

        console.error(
          "Logout error:",
          error
        );


        showControlMessage(
          "❌ Unable to logout."
        );

      }

    }
  );

}


// ======================================================
// CONTROL BUTTON UI
// ======================================================

function updateControlUI() {

  if (
    generalMuteButton
  ) {

    if (generalMute) {

      generalMuteButton.classList.add(
        "active"
      );

    } else {

      generalMuteButton.classList.remove(
        "active"
      );

    }

  }


  if (
    allowOneButton
  ) {

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

console.log(
  "Waiting for Firebase Authentication..."
);
      if (
        allowOneMode &&
        selectedCaller &&
        selectedCaller !== uid
      ) {

        showControlMessage(
