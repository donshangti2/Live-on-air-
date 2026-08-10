// Kulzzy Radio Live Community
// Admin Control Panel

import { auth, db } from "./firebase.js";

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


// ======================================================
// YOUR ADMIN EMAIL
// ======================================================

const ADMIN_EMAIL = "dstnewz.ng@gmail.com";


// ======================================================
// PAGE ELEMENTS
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

const controlMessage =
  document.getElementById("controlMessage");

const callerCount =
  document.getElementById("callerCount");


// ======================================================
// VARIABLES
// ======================================================

let callers = {};

let generalMute = true;

let allowOneMode = false;

let selectedCaller = null;


// ======================================================
// MESSAGE
// ======================================================

function showMessage(message) {

  if (adminMessage) {
    adminMessage.textContent = message;
  }

  if (controlMessage) {
    controlMessage.textContent = message;
  }

}


// ======================================================
// LOGIN
// ======================================================

if (loginButton) {

  loginButton.addEventListener("click", async () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value;


    if (!email || !password) {

      showMessage(
        "Please enter your admin email and password."
      );

      return;

    }


    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {

      showMessage(
        "This email is not authorized."
      );

      return;

    }


    loginButton.disabled = true;
    loginButton.textContent = "LOGGING IN...";


    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage(
        "Login successful."
      );

    } catch (error) {

      console.error("Login error:", error);

      showMessage(
        "Login failed. Check your email and password."
      );

    }


    loginButton.disabled = false;
    loginButton.textContent = "LOGIN";

  });

}


// ======================================================
// AUTH STATE
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


  // Make sure only your admin email can use the panel

  if (
    !user.email ||
    user.email.toLowerCase() !==
    ADMIN_EMAIL.toLowerCase()
  ) {

    showMessage(
      "Unauthorized account."
    );

    signOut(auth);

    return;

  }


  // Hide login

  if (loginBox) {
    loginBox.style.display = "none";
  }


  // Show admin panel

  if (adminPanel) {
    adminPanel.style.display = "block";
  }


  // Start listening for callers

  startCallerListener();

});


// ======================================================
// LOGOUT
// ======================================================

if (logoutButton) {

  logoutButton.addEventListener("click", async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

    }

  });

}


// ======================================================
// LISTEN FOR CALLERS
// ======================================================

function startCallerListener() {

  const callersRef =
    ref(db, "callers");


  onValue(
    callersRef,

    (snapshot) => {

      callers =
        snapshot.val() || {};


      renderCallers();

    },

    (error) => {

      console.error(
        "Database listener error:",
        error
      );

      showMessage(
        "Unable to read callers from Firebase."
      );

    }

  );

}


// ======================================================
// DISPLAY CALLERS
// ======================================================

function renderCallers() {

  if (!callersList) return;


  callersList.innerHTML = "";


  const entries =
    Object.entries(callers);


  const onlineCallers =
    entries.filter(([uid, caller]) => {

      return (
        caller &&
        caller.online !== false &&
        caller.status !== "offline"
      );

    });


  if (callerCount) {

    callerCount.textContent =
      onlineCallers.length;

  }


  if (onlineCallers.length === 0) {

    callersList.innerHTML = `

      <div class="empty-callers">

        📭 No callers connected.

      </div>

    `;

    return;

  }


  onlineCallers.forEach(
    ([uid, caller]) => {

      const card =
        document.createElement("div");


      card.className =
        "caller-card";


      const phone =
        caller.phone || "Unknown";


      const muted =
        caller.muted === true;


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

              ${getStatus(
                caller.status,
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
            ${
              muted
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


      callersList.appendChild(card);

    }
  );


  attachCallerButtons();

}


// ======================================================
// CALLER STATUS
// ======================================================

function getStatus(
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
// BUTTON EVENTS
// ======================================================

function attachCallerButtons() {

  const buttons =
    callersList.querySelectorAll(
      "button[data-action]"
    );


  buttons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        async () => {

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

        }
      );

    }
  );

}


// ======================================================
// ALLOW CALLER
// ======================================================

async function allowCaller(uid) {

  if (
    generalMute &&
    !allowOneMode
  ) {

    showMessage(
      "GENERAL MUTE is active. Choose ALLOW 1 PERSON first."
    );

    return;

  }


  try {

    selectedCaller = uid;


    // In Allow-1 mode, make sure everyone else stays muted

    if (allowOneMode) {

      const updates = {};


      Object.keys(callers).forEach(
        (otherUid) => {

          if (
            otherUid === uid
          ) return;


          const caller =
            callers[otherUid];


          if (!caller) return;


          if (caller.online === false) return;


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

      await update(
        ref(
          db,
          `callers/${uid}`
        ),
        {

          muted: false,

          allowedToSpeak: true,

          status: "speaking"

        }
      );

    }


    showMessage(
      "🎙️ Caller is now allowed to speak."
    );


  } catch (error) {

    console.error(
      "Allow caller error:",
      error
    );

    showMessage(
      "Unable to allow this caller."
    );

  }

}


// ======================================================
// MUTE / UNMUTE
// ======================================================

async function toggleMute(uid) {

  const caller =
    callers[uid];


  if (!caller) return;


  const isMuted =
    caller.muted === true;


  try {

    await update(
      ref(
        db,
        `callers/${uid}`
      ),
      {

        muted: !isMuted,

        allowedToSpeak:
          isMuted,

        status:
          isMuted
            ? "speaking"
            : "muted"

      }
    );


    showMessage(
      isMuted
        ? "🎙️ Caller microphone allowed."
        : "🔇 Caller muted."
    );


  } catch (error) {

    console.error(
      "Mute error:",
      error
    );

    showMessage(
      "Unable to change microphone status."
    );

  }

}


// ======================================================
// DISCONNECT
// ======================================================

async function disconnectCaller(uid) {

  try {

    await update(
      ref(
        db,
        `callers/${uid}`
      ),
      {

        status: "disconnected",

        muted: true,

        allowedToSpeak: false,

        online: false

      }
    );


    showMessage(
      "❌ Caller disconnected."
    );


  } catch (error) {

    console.error(
      "Disconnect error:",
      error
    );

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


        Object.keys(callers).forEach(
          (uid) => {

            const caller =
              callers[uid];


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

          }
        );


        if (
          Object.keys(updates).length
        ) {

          await update(
            ref(db),
            updates
          );

        }


        generalMuteButton.classList.add(
          "active"
        );


        allowOneButton.classList.remove(
          "active"
        );


        showMessage(
          "🔇 GENERAL MUTE activated. Everyone is muted."
        );


      } catch (error) {

        console.error(
          "General mute error:",
          error
        );

        showMessage(
          "Unable to activate General Mute."
        );

      }

    }
  );

}


// ======================================================
// GENERAL MUTE + ALLOW ONE
// ======================================================

if (allowOneButton) {

  allowOneButton.addEventListener(
    "click",
    async () => {

      try {

        generalMute = true;

        allowOneMode = true;

        selectedCaller = null;


        const updates = {};


        Object.keys(callers).forEach(
          (uid) => {

            const caller =
              callers[uid];


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

          }
        );


        if (
          Object.keys(updates).length
        ) {

          await update(
            ref(db),
            updates
          );

        }


        generalMuteButton.classList.remove(
          "active"
        );


        allowOneButton.classList.add(
          "active"
        );


        showMessage(
          "🔇 Everyone is muted. Select ALLOW for one person."
        );


      } catch (error) {

        console.error(
          "Allow-one error:",
          error
        );

        showMessage(
          "Unable to activate Allow 1 Person mode."
        );

      }

    }
  );

}


// ======================================================
// HTML SECURITY
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
