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
// START AFTER HTML IS READY
// ======================================================

function startAdmin() {

  console.log("🎙️ Starting Kulzzy Radio Admin...");


  // ====================================================
  // ELEMENTS
  // ====================================================

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


  // ====================================================
  // CHECK IMPORTANT ELEMENTS
  // ====================================================

  console.log("Login button:", loginButton);
  console.log("Email field:", adminEmail);
  console.log("Password field:", adminPassword);


  if (!loginButton) {

    console.error(
      "❌ loginButton was not found in admin.html"
    );

    return;

  }


  if (!adminEmail) {

    console.error(
      "❌ adminEmail was not found in admin.html"
    );

    return;

  }


  if (!adminPassword) {

    console.error(
      "❌ adminPassword was not found in admin.html"
    );

    return;

  }


  // ====================================================
  // VARIABLES
  // ====================================================

  /*
   * IMPORTANT
   *
   * We DO NOT clear this object every time
   * Firebase sends a new snapshot.
   *
   * This allows previously seen callers to remain
   * visible if another caller joins.
   */

  let callers = {};

  let generalMute = true;

  let allowOneMode = false;

  let selectedCaller = null;

  let connectedCaller = null;

  let callersListenerStarted = false;

  let callersUnsubscribe = null;


  // ====================================================
  // LOGIN MESSAGE
  // ====================================================

  function showLoginMessage(message) {

    if (adminMessage) {

      adminMessage.textContent =
        message;

    }

  }


  function clearLoginMessage() {

    if (adminMessage) {

      adminMessage.textContent =
        "";

    }

  }


  // ====================================================
  // CONTROL MESSAGE
  // ====================================================

  function showControlMessage(message) {

    if (controlMessage) {

      controlMessage.textContent =
        message;

    }

  }


  // ====================================================
  // LOGIN
  // ====================================================

  loginButton.addEventListener(
    "click",
    async function () {

      console.log(
        "🔐 LOGIN BUTTON CLICKED"
      );


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

        console.log(
          "Attempting Firebase login..."
        );


        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );


        console.log(
          "✅ Firebase login successful."
        );

        console.log(
          "Admin email:",
          result.user.email
        );

        console.log(
          "Admin UID:",
          result.user.uid
        );


      } catch (error) {

        console.error(
          "❌ Firebase login error:",
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

        }

        else if (
          error.code ===
          "auth/invalid-email"
        ) {

          message =
            "Please enter a valid email address.";

        }

        else if (
          error.code ===
          "auth/user-not-found"
        ) {

          message =
            "Admin account was not found.";

        }

        else if (
          error.code ===
          "auth/wrong-password"
        ) {

          message =
            "Incorrect password.";

        }

        else if (
          error.code ===
          "auth/too-many-requests"
        ) {

          message =
            "Too many login attempts. Please try again later.";

        }

        else if (
          error.code ===
          "auth/user-disabled"
        ) {

          message =
            "This admin account has been disabled.";

        }

        else {

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


  // ====================================================
  // ENTER KEY LOGIN
  // ====================================================

  adminPassword.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        loginButton.click();

      }

    }
  );


  // ====================================================
  // AUTHENTICATION STATE
  // ====================================================

  onAuthStateChanged(
    auth,
    async function (user) {

      console.log(
        "Firebase Auth state:",
        user
          ? "LOGGED IN"
          : "LOGGED OUT"
      );


      if (user) {

        console.log(
          "Admin email:",
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


        loginButton.disabled =
          false;

        loginButton.textContent =
          "LOGIN";


        clearLoginMessage();


        await new Promise(
          function (resolve) {

            setTimeout(
              resolve,
              200
            );

          }
        );


        startCallerListener();

        updateControlUI();


      }

      else {

        console.log(
          "No admin user logged in."
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


        loginButton.disabled =
          false;

        loginButton.textContent =
          "LOGIN";

      }

    }
  );


  // ====================================================
  // FIREBASE CALLER LISTENER
  // ====================================================

  function startCallerListener() {

    if (
      callersListenerStarted
    ) {

      return;

    }


    const user =
      auth.currentUser;


    if (!user) {

      console.error(
        "❌ Cannot read callers because no Firebase user is logged in."
      );

      return;

    }


    console.log(
      "📡 Starting /callers listener..."
    );

    console.log(
      "Authenticated UID:",
      user.uid
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

        function (snapshot) {

          console.log(
            "✅ Firebase /callers data received."
          );


          const data =
            snapshot.val() || {};


          /*
           * ==================================================
           * IMPORTANT FIX
           * ==================================================
           *
           * DO NOT DO:
           *
           * callers = {};
           *
           * anymore.
           *
           * We merge Firebase records into the existing
           * caller list.
           *
           * This prevents the admin panel from wiping
           * previously displayed callers whenever Firebase
           * sends another update.
           */

          Object.keys(data)
            .forEach(
              function (uid) {

                const caller =
                  data[uid];


                if (caller) {

                  /*
                   * Update the existing caller.
                   */

                  callers[uid] =
                    {
                      ...(callers[uid] || {}),
                      ...caller
                    };

                }

              }
            );


          /*
           * If Firebase currently contains no callers,
           * we DO NOT clear the local list.
           *
           * Previously seen callers remain displayed.
           */


          renderCallers();

        },

        function (error) {

          console.error(
            "❌ FIREBASE DATABASE ERROR"
          );

          console.error(
            "Code:",
            error.code
          );

          console.error(
            "Message:",
            error.message
          );


          callersListenerStarted =
            false;


          if (callersList) {

            callersList.innerHTML =
              `
              <div class="empty-callers">

                ❌ Firebase Database Error

                <br><br>

                Code:
                ${escapeHTML(
                  error.code ||
                  ""
                )}

                <br>

                ${escapeHTML(
                  error.message ||
                  ""
                )}

              </div>
              `;

          }


          /*
           * IMPORTANT:
           *
           * We do NOT clear callers here.
           */

          renderCallers();


          showControlMessage(
            "❌ Firebase cannot read the callers database."
          );

        }

      );

  }


  // ====================================================
  // STOP CALLER LISTENER
  // ====================================================

  function stopCallerListener() {

    if (
      callersUnsubscribe
    ) {

      try {

        callersUnsubscribe();

      }

      catch (error) {

        console.error(
          "Unable to stop Firebase listener:",
          error
        );

      }

    }


    callersUnsubscribe =
      null;

    callersListenerStarted =
      false;

  }


  // ====================================================
  // RENDER CALLERS
  // ====================================================

  function renderCallers() {

    if (
      !callersList ||
      !callerCount
    ) {

      return;

    }


    const ids =
      Object.keys(callers);


    callerCount.textContent =
      ids.length;


    if (
      ids.length === 0
    ) {

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
      function (uid) {

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
          caller.status !==
            "disconnected";


        const isAllowed =
          caller.allowedToSpeak === true &&
          caller.muted === false;


        let statusText =
          "⏳ WAITING";


        if (!isOnline) {

          statusText =
            "⚫ OFFLINE";

        }

        else if (isAllowed) {

          statusText =
            "🎙️ SPEAKING";

        }

        else if (isMuted) {

          statusText =
            "🔇 MUTED";

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


  // ====================================================
  // CALLER BUTTON ACTIONS
  // ====================================================

  if (callersList) {

    callersList.addEventListener(
      "click",
      async function (event) {

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


        else if (
          action ===
          "mute"
        ) {

          await toggleMute(
            uid
          );

        }


        else if (
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


  // ====================================================
  // GENERAL MUTE
  // ====================================================

  if (generalMuteButton) {

    generalMuteButton.addEventListener(
      "click",
      async function () {

        await activateGeneralMute();

      }
    );

  }


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
          function (uid) {

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

        }

        catch (error) {

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

    }

    catch (error) {

      console.error(
        "General mute error:",
        error
      );


      showControlMessage(
        "❌ Unable to activate General Mute."
      );

    }

  }


  // ====================================================
  // ALLOW ONE PERSON
  // ====================================================

  if (allowOneButton) {

    allowOneButton.addEventListener(
      "click",
      function () {

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

  }


  // ====================================================
  // ALLOW CALLER
  // ====================================================

async function allowCaller(uid) {

  const caller =
    callers[uid];

  if (!caller) {

    showControlMessage(
      "❌ Caller is no longer available."
    );

    return;

  }

  if (
    caller.online === false ||
    caller.status === "disconnected"
  ) {

    showControlMessage(
      "📱 This caller is offline. Their number remains in the list."
    );

    return;

  }

  try {

    // ==================================================
    // ALLOW THIS CALLER TO SPEAK
    // ==================================================

    if (allowOneMode) {

      const updates = {};

      Object.keys(callers).forEach(
        function (otherUid) {

          if (otherUid === uid) {
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

    }

    else {

      await update(
        ref(
          db,
          `callers/${uid}`
        ),
        {

          muted: false,

          allowedToSpeak: true,

          status: "speaking",

          online: true

        }
      );

    }

    // ==================================================
    // CONNECT WEBRTC TO THIS CALLER
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

      }

      catch (error) {

        console.error(
          "Previous WebRTC close error:",
          error
        );

      }

    }

    await connectHost(uid);

    connectedCaller = uid;

    selectedCaller = uid;

    showControlMessage(
      "🎙️ Caller is allowed. They can now allow microphone access and talk on-air."
    );

  }

  catch (error) {

    console.error(
      "Allow caller error:",
      error
    );

    showControlMessage(
      "❌ Unable to connect this caller."
    );

  }

}


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

      }

      else {

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

        }

        catch (error) {

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

    }

    catch (error) {

      console.error(
        "Allow caller error:",
        error
      );


      showControlMessage(
        "❌ Unable to connect this caller."
      );

    }

  }


  // ====================================================
  // MUTE / UNMUTE
  // ====================================================

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

            }

            catch (error) {

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

      }

      else {

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

          }

          catch (error) {

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

    }

    catch (error) {

      console.error(
        "Mute/unmute error:",
        error
      );


      showControlMessage(
        "❌ Unable to change caller microphone."
      );

    }

  }


  // ====================================================
  // DISCONNECT CALLER
  // ====================================================

  async function disconnectCaller(uid) {

    try {

      /*
       * IMPORTANT:
       *
       * NEVER DELETE THE CALLER.
       *
       * The caller remains in Firebase.
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

        }

        catch (error) {

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

    }

    catch (error) {

      console.error(
        "Disconnect error:",
        error
      );


      showControlMessage(
        "❌ Unable to disconnect caller."
      );

    }

  }


  // ====================================================
  // LOGOUT
  // ====================================================

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      async function () {

        try {

          if (connectedCaller) {

            try {

              await closeWebRTC(
                connectedCaller
              );

            }

            catch (error) {

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


        }

        catch (error) {

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


  // ====================================================
  // CONTROL UI
  // ====================================================

  function updateControlUI() {

    if (generalMuteButton) {

      if (generalMute) {

        generalMuteButton.classList.add(
          "active"
        );

      }

      else {

        generalMuteButton.classList.remove(
          "active"
        );

      }

    }


    if (allowOneButton) {

      if (allowOneMode) {

        allowOneButton.classList.add(
          "active"
        );

      }

      else {

        allowOneButton.classList.remove(
          "active"
        );

      }

    }

  }


  // ====================================================
  // ESCAPE HTML
  // ====================================================

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


  // ====================================================
  // INITIAL STATE
  // ====================================================

  generalMute =
    true;

  allowOneMode =
    false;


  updateControlUI();


  console.log(
    "✅ Kulzzy Radio Live Community Admin loaded."
  );

}


// ======================================================
// DOM READY
// ======================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    startAdmin
  );

}

else {

  startAdmin();

}
