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
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  ref,
  onValue,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  connectHost,
  closeWebRTC
} from "./webrtc.js";


// ======================================================
// VARIABLES
// ======================================================

let callers = {};

let generalMute = true;

let allowOneMode = false;

let selectedCaller = null;

let connectedCaller = null;


// ======================================================
// ELEMENTS
// ======================================================

const callersContainer =
  document.getElementById(
    "callersContainer"
  );

const callerCount =
  document.getElementById(
    "callerCount"
  );

const generalMuteBtn =
  document.getElementById(
    "generalMuteBtn"
  );

const allowOneBtn =
  document.getElementById(
    "allowOneBtn"
  );

const generalMuteStatus =
  document.getElementById(
    "generalMuteStatus"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


// ======================================================
// OPTIONAL MESSAGE ELEMENT
// ======================================================

function showMessage(message) {

  let messageBox =
    document.getElementById(
      "adminMessage"
    );


  if (!messageBox) {

    messageBox =
      document.createElement(
        "div"
      );

    messageBox.id =
      "adminMessage";

    messageBox.style.margin =
      "12px 0";

    messageBox.style.padding =
      "10px";

    messageBox.style.borderRadius =
      "8px";

    messageBox.style.background =
      "#10284d";

    messageBox.style.color =
      "#ffffff";

    messageBox.style.textAlign =
      "center";

    const parent =
      callersContainer?.parentElement ||
      document.body;

    parent.prepend(
      messageBox
    );

  }


  messageBox.textContent =
    message;

}


// ======================================================
// AUTHENTICATION
// ======================================================

onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {

      window.location.href =
        "admin.html";

      return;

    }


    console.log(
      "Admin authenticated:",
      user.uid
    );

    startCallerListener();

  }
);


// ======================================================
// LISTEN FOR CALLERS
// ======================================================

function startCallerListener() {

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


      Object.keys(data).forEach(
        (uid) => {

          const caller =
            data[uid];


          /*
           * Only display callers who are
           * currently online.
           */

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


      if (callersContainer) {

        callersContainer.innerHTML =
          `
          <div style="
            padding:20px;
            text-align:center;
            color:#ff7777;
          ">
            Unable to read callers from Firebase.
          </div>
          `;

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


  if (!callersContainer) {

    return;

  }


  if (ids.length === 0) {

    callersContainer.innerHTML =
      `
      <div style="
        padding:25px;
        text-align:center;
        color:#9aa9c2;
      ">
        📭 No callers connected.
      </div>
      `;

    return;

  }


  callersContainer.innerHTML =
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


      const status =
        caller.status ||
        "waiting";


      // ==========================================
      // STATUS TEXT
      // ==========================================

      let statusText =
        "⏳ Waiting";


      if (isAllowed) {

        statusText =
          "🎙️ Speaking";

      } else if (isMuted) {

        statusText =
          "🔇 Muted";

      } else if (
        status === "offline"
      ) {

        statusText =
          "⚫ Offline";

      }


      // ==========================================
      // CARD
      // ==========================================

      card.innerHTML =
        `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          margin-bottom:10px;
        ">

          <div>

            <div style="
              font-size:16px;
              font-weight:bold;
            ">
              👤 ${escapeHTML(
                caller.phone ||
                "Unknown caller"
              )}
            </div>

            <div style="
              margin-top:5px;
              font-size:13px;
              color:#cbd6e8;
            ">
              ${statusText}
            </div>

          </div>

        </div>


        <div style="
          display:flex;
          flex-wrap:wrap;
          gap:7px;
        ">

          <button
            class="caller-action allow-button"
            data-action="allow"
            data-uid="${uid}"
          >
            🎙️ ALLOW
          </button>


          <button
            class="caller-action mute-button"
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
            class="caller-action disconnect-button"
            data-action="disconnect"
            data-uid="${uid}"
          >
            ❌ DISCONNECT
          </button>

        </div>
        `;


      // ==========================================
      // CARD STYLING
      // ==========================================

      card.style.background =
        "#0b2144";

      card.style.border =
        "1px solid #29456d";

      card.style.borderRadius =
        "14px";

      card.style.padding =
        "15px";

      card.style.marginBottom =
        "10px";


      callersContainer.appendChild(
        card
      );

    }
  );

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
// CALLER BUTTON ACTIONS
// ======================================================

if (callersContainer) {

  callersContainer.addEventListener(
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


      if (action === "allow") {

        await allowCaller(
          uid
        );

      }


      if (action === "mute") {

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
// GENERAL MUTE
// ======================================================

if (generalMuteBtn) {

  generalMuteBtn.addEventListener(
    "click",
    async () => {

      await activateGeneralMute();

    }
  );

}


// ======================================================
// GENERAL MUTE FUNCTION
// ======================================================

async function activateGeneralMute() {

  try {

    generalMute =
      true;


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


    /*
     * If there is an active WebRTC caller,
     * close the host connection.
     */

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

    }


    selectedCaller =
      null;


    updateGeneralMuteUI();


    showMessage(
      "🔇 General Mute is active. All callers are muted."
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


// ======================================================
// GENERAL MUTE + ALLOW ONE PERSON
// ======================================================

if (allowOneBtn) {

  allowOneBtn.addEventListener(
    "click",
    async () => {

      await activateAllowOneMode();

    }
  );

}


// ======================================================
// ACTIVATE ALLOW ONE MODE
// ======================================================

async function activateAllowOneMode() {

  try {

    allowOneMode =
      true;

    generalMute =
      true;


    updateGeneralMuteUI();


    showMessage(
      "🎙️ Allow 1 Person mode is active. Choose ALLOW on one caller."
    );


  } catch (error) {

    console.error(
      "Allow one mode error:",
      error
    );

  }

}


// ======================================================
// ALLOW CALLER
// ======================================================

async function allowCaller(uid) {

  const caller =
    callers[uid];


  if (!caller) {

    showMessage(
      "Caller is no longer connected."
    );

    return;

  }


  try {

    // ==========================================
    // ALLOW 1 PERSON MODE
    // ==========================================

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

      // ========================================
      // NORMAL ALLOW
      // ========================================

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


    // ==========================================
    // CONNECT HOST TO CALLER
    // ==========================================

    showMessage(
      "🎙️ Caller allowed. Connecting microphone..."
    );


    await connectHost(
      uid
    );


    connectedCaller =
      uid;


    selectedCaller =
      uid;


    showMessage(
      "🎙️ Caller is connected to your control device."
    );


  } catch (error) {

    console.error(
      "Allow caller error:",
      error
    );


    showMessage(
      "Unable to connect this caller."
    );

  }

}


// ======================================================
// MUTE / UNMUTE CALLER
// ======================================================

async function toggleMute(uid) {

  const caller =
    callers[uid];


  if (!caller) {

    showMessage(
      "Caller is no longer connected."
    );

    return;

  }


  const currentlyMuted =
    caller.muted === true;


  try {

    if (currentlyMuted) {

      // ========================================
      // UNMUTE
      // ========================================

      if (
        allowOneMode &&
        selectedCaller &&
        selectedCaller !== uid
      ) {

        showMessage(
          "Only one caller can be allowed in this mode."
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


      // ========================================
      // CONNECT IF NOT ALREADY CONNECTED
      // ========================================

      if (
        connectedCaller !== uid
      ) {

        showMessage(
          "🎙️ Connecting caller microphone..."
        );


        await connectHost(
          uid
        );


        connectedCaller =
          uid;

        selectedCaller =
          uid;

      }


      showMessage(
        "🔊 Caller microphone is unmuted."
      );


    } else {

      // ========================================
      // MUTE
      // ========================================

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


      /*
       * Close the current WebRTC host
       * connection when the caller is muted.
       */

      if (
        connectedCaller === uid
      ) {

        try {

          await closeWebRTC(
            uid
          );

        } catch (error) {

          console.error(
            "WebRTC mute close error:",
            error
          );

        }


        connectedCaller =
          null;

        selectedCaller =
          null;

      }


      showMessage(
        "🔇 Caller microphone muted."
      );

    }


  } catch (error) {

    console.error(
      "Mute/unmute error:",
      error
    );


    showMessage(
      "Unable to change caller microphone."
    );

  }

}


// ======================================================
// DISCONNECT CALLER
// ======================================================

async function disconnectCaller(
  uid
) {

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
// GENERAL MUTE UI
// ======================================================

function updateGeneralMuteUI() {

  if (
    generalMuteStatus
  ) {

    if (
      allowOneMode
    ) {

      generalMuteStatus.textContent =
        "🎙️ Allow 1 Person mode is active. Choose ALLOW for one caller.";

    } else if (
      generalMute
    ) {

      generalMuteStatus.textContent =
        "🔇 General Mute is active. All callers are muted.";

    } else {

      generalMuteStatus.textContent =
        "🎙️ General Mute is off.";

    }

  }


  if (
    generalMuteBtn
  ) {

    generalMuteBtn.style.opacity =
      generalMute
        ? "1"
        : "0.7";

  }


  if (
    allowOneBtn
  ) {

    allowOneBtn.style.opacity =
      allowOneMode
        ? "1"
        : "0.7";

  }

}


// ======================================================
// LOGOUT
// ======================================================

if (logoutBtn) {

  logoutBtn.addEventListener(
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
              "Logout WebRTC error:",
              error
            );

          }

        }


        await signOut(
          auth
        );


        window.location.href =
          "admin.html";


      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

      }

    }
  );

}


// ======================================================
// INITIAL UI
// ======================================================

updateGeneralMuteUI();


console.log(
  "Kulzzy Radio Live Community Admin loaded."
);
