// ======================================================
// KULZZY RADIO NETWORK
// LIVE COMMUNITY ADMIN CONTROL
// js/admin.js
// VERSION 2.0.0
//
// PURPOSE OF THIS VERSION:
// - Keep caller records permanently visible
// - Offline callers remain in the admin panel
// - Phone numbers remain private from the public website
// - Keep Firebase Authentication working
// - Keep General Mute working
// - Keep General Mute + Allow 1 Person working
// - Keep Allow / Mute / Unmute / Disconnect working
// - Do NOT delete caller records when they leave
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

if (loginButton) {

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

}


// ======================================================
// ENTER KEY LOGIN
// ======================================================

if (adminPassword) {

  adminPassword.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
        "Enter"
      ) {

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
  (user) => {

    if (user) {

      console.log(
        "Admin logged in:",
        user.email
      );

      console.log(
        "Admin UID:",
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


      startCallerListener();


      updateControlUI();


    } else {

      console.log(
        "No admin user logged in."
      );


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

}


// ======================================================
// FIREBASE CALLER LISTENER
//
// IMPORTANT:
//
// This version DOES NOT remove callers when:
//
// online === false
//
// Every caller stored inside:
//
// /callers
//
// remains visible in the Admin Panel.
//
// This is the main change in Version 2.0.0.
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


      // ==================================================
      // KEEP ALL CALLERS
      //
      // DO NOT CHECK:
      //
      // caller.online !== false
      //
      // because that would hide offline callers.
      // ==================================================

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
        "Firebase Database Error:",
        error
      );


      console.error(
        "Firebase Error Code:",
        error.code
      );


      console.error(
        "Firebase Error Message:",
        error.message
      );


      if (callersList) {

        callersList.innerHTML =
          `
          <div class="empty-callers">
            ❌ Firebase Database Error
            <br><br>
            Code: ${escapeHTML(
              error.code ||
              "unknown"
            )}
            <br>
            ${escapeHTML(
              error.message ||
              "Unable to read callers."
            )}
          </div>
          `;

      }


      if (callerCount) {

        callerCount.textContent =
          "0";

      }

    }
  );

}


// ======================================================
// RENDER CALLERS
// ======================================================

function renderCallers() {

  const ids =
    Object.keys(callers);


  if (callerCount) {

    callerCount.textContent =
      ids.length;

  }


  if (!callersList) {
    return;
  }


  if (ids.length === 0) {

    callersList.innerHTML =
      `
      <div class="empty-callers">
        📭 No callers have joined yet.
      </div>
      `;

    return;

  }


  callersList.innerHTML =
    "";


  // ====================================================
  // SORT CALLERS
  //
  // Online callers appear first.
  // Offline callers remain underneath.
  // ====================================================

  ids.sort(
    (a, b) => {

      const callerA =
        callers[a];

      const callerB =
        callers[b];


      const onlineA =
        callerA.online === true;

      const onlineB =
        callerB.online === true;


      if (
        onlineA &&
        !onlineB
      ) {

        return -1;

      }


      if (
        !onlineA &&
        onlineB
      ) {

        return 1;

      }


      const joinedA =
        Number(
          callerA.joinedAt ||
          0
        );


      const joinedB =
        Number(
          callerB.joinedAt ||
          0
        );


      return joinedB - joinedA;

    }
  );


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


      // ==================================================
      // CALLER STATE
      // ==================================================

      const isOnline =
        caller.online === true;


      const isMuted =
        caller.muted === true;


      const isAllowed =
        caller.allowedToSpeak === true &&
        caller.muted === false &&
        isOnline;


      let statusText =
        "";


      if (!isOnline) {

        statusText =
          "⚫ OFFLINE";

      } else if (isAllowed) {

        statusText =
          "🎙️ SPEAKING";

      } else if (isMuted) {

        statusText =
          "🔇 MUTED";

      } else {

        statusText =
          "⏳ WAITING";

      }


      // ==================================================
      // PHONE NUMBER
      // ==================================================

      const phone =
        caller.phone ||
        "Unknown caller";


      // ==================================================
      // BUTTON STATE
      // ==================================================

      const allowDisabled =
        !isOnline;


      const muteDisabled =
        !isOnline;


      // ==================================================
      // CARD
      // ==================================================

      card.innerHTML =
        `
        <div class="caller-information">

          <div class="caller-icon">
            👤
          </div>

          <div>

            <div class="caller-phone">
              ${escapeHTML(
                phone
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
            ${allowDisabled ? "disabled" : ""}
          >
            🎙️ ALLOW
          </button>


          <button
            class="mute-button"
            data-action="mute"
            data-uid="${escapeHTML(uid)}"
            ${muteDisabled ? "disabled" : ""}
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


      if (
        button.disabled
      ) {
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


    // ==================================================
    // MUTE ALL SAVED CALLERS
    //
    // Including offline callers.
    //
    // Their records are NOT deleted.
    // ==================================================

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
// GENERAL MUTE + ALLOW ONE PERSON
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
      "Caller record was not found."
    );

    return;

  }


  // ==================================================
  // DO NOT ALLOW OFFLINE CALLERS
  // ==================================================

  if (
    caller.online !== true
  ) {

    showControlMessage(
      "⚫ This caller is offline. They must join the website again before they can be allowed."
    );

    return;

  }


  try {

    // ==================================================
    // GENERAL MUTE + ALLOW ONE PERSON
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


            // Only change active callers.
            if (
              callers[otherUid].online === true
            ) {

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

      // ==================================================
      // NORMAL ALLOW
      // ==================================================

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


    // ==================================================
    // WEBRTC HOST CONNECTION
    // ==================================================

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
      "Caller record was not found."
    );

    return;

  }


  // ==================================================
  // OFFLINE CALLER
  // ==================================================

  if (
    caller.online !== true
  ) {

    showControlMessage(
      "⚫ This caller is offline."
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
      "Unable to change caller microphone."
    );

  }

}


// ======================================================
// DISCONNECT CALLER
//
// IMPORTANT:
//
// DISCONNECT DOES NOT DELETE THE CALLER.
//
// The record remains in Firebase.
//
// The caller will remain visible as OFFLINE.
// ======================================================

async function disconnectCaller(uid) {

  const caller =
    callers[uid];


  if (!caller) {

    showControlMessage(
      "Caller record was not found."
    );

    return;

  }


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
      "❌ Caller disconnected. Their record remains saved."
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

  if (
    !generalMuteButton ||
    !allowOneButton
  ) {

    return;

  }


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
  "🎙️ Kulzzy Radio Live Community Admin Version 2.0.0 loaded."
);

console.log(
  "📱 Caller records are now persistent."
);

console.log(
  "⚠️ Offline callers will remain visible in the Admin Panel."
);
