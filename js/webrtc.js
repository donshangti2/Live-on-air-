// ======================================================
// KULZZY RADIO LIVE COMMUNITY
// WEBRTC ENGINE
// VERSION 4.0
//
// IMPORTANT:
// This file works with:
//   - public/index.html
//   - public/admin.html
//   - js/admin.js
//   - js/firebase.js
//
// DO NOT CHANGE THE Firebase paths.
// ======================================================

import { db } from "./firebase.js";

import {
  ref,
  set,
  onValue,
  onChildAdded,
  remove
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


// ======================================================
// ICE SERVERS
// ======================================================

const ICE_SERVERS = {

  iceServers: [

    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302"
      ]
    }

  ],

  iceCandidatePoolSize: 10

};


// ======================================================
// GLOBAL VARIABLES
// ======================================================

let peerConnection = null;

let localStream = null;

let currentCallerId = null;

let answerListener = null;

let hostCandidateListener = null;

let callerCandidateListener = null;

let connectionTimeout = null;


// ======================================================
// LOG HELPER
// ======================================================

function log(...args) {

  console.log(
    "🎙️ [KULZZY WEBRTC]",
    ...args
  );

}


// ======================================================
// ERROR HELPER
// ======================================================

function webRTCError(message, error = null) {

  console.error(
    "❌ [KULZZY WEBRTC]",
    message,
    error || ""
  );

}


// ======================================================
// WAIT FOR ICE GATHERING
// ======================================================

function waitForIceGatheringComplete(
  pc
) {

  return new Promise(
    function(resolve) {

      if (
        pc.iceGatheringState ===
        "complete"
      ) {

        resolve();

        return;

      }


      const checkState =
        function() {

          if (
            pc.iceGatheringState ===
            "complete"
          ) {

            pc.removeEventListener(
              "icegatheringstatechange",
              checkState
            );

            resolve();

          }

        };


      pc.addEventListener(
        "icegatheringstatechange",
        checkState
      );


      // Safety timeout.
      setTimeout(
        function() {

          pc.removeEventListener(
            "icegatheringstatechange",
            checkState
          );

          resolve();

        },
        8000
      );

    }
  );

}


// ======================================================
// CLEAR TIMEOUT
// ======================================================

function clearConnectionTimeout() {

  if (connectionTimeout) {

    clearTimeout(
      connectionTimeout
    );

    connectionTimeout =
      null;

  }

}


// ======================================================
// CREATE PEER CONNECTION
// ======================================================

function createConnection(
  callerId,
  role
) {

  log(
    "Creating WebRTC connection:",
    role,
    callerId
  );


  const pc =
    new RTCPeerConnection(
      ICE_SERVERS
    );


  // ====================================================
  // CONNECTION STATE
  // ====================================================

  pc.onconnectionstatechange =
    function() {

      log(
        "Connection state:",
        pc.connectionState
      );


      if (
        pc.connectionState ===
        "connected"
      ) {

        clearConnectionTimeout();

        log(
          "✅ WEBRTC CONNECTION ESTABLISHED"
        );

      }


      if (
        pc.connectionState ===
          "failed" ||
        pc.connectionState ===
          "disconnected" ||
        pc.connectionState ===
          "closed"
      ) {

        webRTCError(
          "WebRTC connection state:",
          pc.connectionState
        );

      }

    };


  // ====================================================
  // ICE CONNECTION STATE
  // ====================================================

  pc.oniceconnectionstatechange =
    function() {

      log(
        "ICE connection state:",
        pc.iceConnectionState
      );

    };


  // ====================================================
  // ICE GATHERING STATE
  // ====================================================

  pc.onicegatheringstatechange =
    function() {

      log(
        "ICE gathering state:",
        pc.iceGatheringState
      );

    };


  // ====================================================
  // SIGNALING STATE
  // ====================================================

  pc.onsignalingstatechange =
    function() {

      log(
        "Signaling state:",
        pc.signalingState
      );

    };


  // ====================================================
  // ICE CANDIDATES
  // ====================================================

  pc.onicecandidate =
    async function(event) {

      if (
        !event.candidate
      ) {

        return;

      }


      const path =

        role === "caller"

          ? `webrtc/${callerId}/callerCandidates`

          : `webrtc/${callerId}/hostCandidates`;


      const candidateId =

        Date.now() +

        "-" +

        Math.random()
          .toString(36)
          .substring(2, 10);


      try {

        await set(

          ref(
            db,
            `${path}/${candidateId}`
          ),

          event.candidate.toJSON()

        );


        log(
          "ICE candidate saved:",
          role
        );

      }

      catch (error) {

        webRTCError(
          "Unable to save ICE candidate.",
          error
        );

      }

    };


  // ====================================================
  // RECEIVE REMOTE AUDIO ON HOST
  // ====================================================

  pc.ontrack =
    function(event) {

      log(
        "🔊 Remote caller audio received."
      );


      let audio =
        document.getElementById(
          "webrtcRemoteAudio"
        );


      if (!audio) {

        audio =
          document.createElement(
            "audio"
          );


        audio.id =
          "webrtcRemoteAudio";


        audio.autoplay =
          true;


        audio.playsInline =
          true;


        audio.controls =
          false;


        audio.style.display =
          "none";


        document.body.appendChild(
          audio
        );

      }


      if (
        event.streams &&
        event.streams[0]
      ) {

        audio.srcObject =
          event.streams[0];


        audio.play()
          .catch(
            function(error) {

              log(
                "Browser waiting for audio permission:",
                error
              );

            }
          );

      }

    };


  return pc;

}


// ======================================================
// GET MICROPHONE
// ======================================================

async function getMicrophone() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Microphone access is not supported by this browser."
    );

  }


  log(
    "Requesting microphone permission..."
  );


  try {

    const stream =

      await navigator.mediaDevices
        .getUserMedia({

          audio: {

            echoCancellation:
              true,

            noiseSuppression:
              true,

            autoGainControl:
              true

          },

          video:
            false

        });


    log(
      "✅ Microphone permission granted."
    );


    return stream;

  }

  catch (error) {

    webRTCError(
      "Microphone permission failed.",
      error
    );


    throw error;

  }

}


// ======================================================
// CALLER CONNECT
// ======================================================

export async function connectCaller(
  callerId
) {

  log(
    "======================================"
  );

  log(
    "CALLER CONNECTION STARTING"
  );

  log(
    "Caller ID:",
    callerId
  );

  log(
    "======================================"
  );


  if (!callerId) {

    throw new Error(
      "Caller ID is missing."
    );

  }


  currentCallerId =
    callerId;


  // ====================================================
  // CLOSE OLD CONNECTION
  // ====================================================

  if (peerConnection) {

    try {

      peerConnection.close();

    }

    catch (error) {

      console.warn(
        "Old WebRTC connection could not close:",
        error
      );

    }

    peerConnection =
      null;

  }


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        function(track) {

          track.stop();

        }
      );


    localStream =
      null;

  }


  clearConnectionTimeout();


  // ====================================================
  // GET MICROPHONE
  // ====================================================

  localStream =
    await getMicrophone();


  // ====================================================
  // CREATE PEER CONNECTION
  // ====================================================

  peerConnection =
    createConnection(
      callerId,
      "caller"
    );


  // ====================================================
  // ADD MICROPHONE TRACKS
  // ====================================================

  localStream
    .getTracks()
    .forEach(
      function(track) {

        peerConnection.addTrack(
          track,
          localStream
        );

      }
    );


  log(
    "Microphone tracks added."
  );


  // ====================================================
  // CREATE OFFER
  // ====================================================

  const offer =
    await peerConnection.createOffer({

      offerToReceiveAudio:
        false,

      offerToReceiveVideo:
        false

    });


  await peerConnection.setLocalDescription(
    offer
  );


  log(
    "Caller offer created."
  );


  // ====================================================
  // WAIT FOR ICE
  // ====================================================

  await waitForIceGatheringComplete(
    peerConnection
  );


  const localDescription =
    peerConnection.localDescription;


  if (!localDescription) {

    throw new Error(
      "Unable to create WebRTC local description."
    );

  }


  // ====================================================
  // SAVE OFFER
  // ====================================================

  await set(

    ref(
      db,
      `webrtc/${callerId}/offer`
    ),

    {

      type:
        localDescription.type,

      sdp:
        localDescription.sdp

    }

  );


  log(
    "✅ Caller offer sent to Firebase."
  );


  // ====================================================
  // WAIT FOR HOST ANSWER
  // ====================================================

  answerListener =

    onValue(

      ref(
        db,
        `webrtc/${callerId}/answer`
      ),

      async function(snapshot) {

        const answer =
          snapshot.val();


        if (!answer) {

          return;

        }


        if (
          !peerConnection
        ) {

          return;

        }


        if (
          peerConnection.signalingState !==
          "have-local-offer"
        ) {

          return;

        }


        try {

          await peerConnection.setRemoteDescription(

            new RTCSessionDescription(
              answer
            )

          );


          log(
            "✅ Host answer received."
          );

        }

        catch (error) {

          webRTCError(
            "Unable to set host answer.",
            error
          );

        }

      }

    );


  // ====================================================
  // RECEIVE HOST ICE CANDIDATES
  // ====================================================

  hostCandidateListener =

    onChildAdded(

      ref(
        db,
        `webrtc/${callerId}/hostCandidates`
      ),

      async function(snapshot) {

        const candidate =
          snapshot.val();


        if (
          !candidate ||
          !peerConnection
        ) {

          return;

        }


        try {

          await peerConnection.addIceCandidate(

            new RTCIceCandidate(
              candidate
            )

          );


          log(
            "Host ICE candidate added."
          );

        }

        catch (error) {

          webRTCError(
            "Unable to add host ICE candidate.",
            error
          );

        }

      }

    );


  // ====================================================
  // CONNECTION TIMEOUT
  // ====================================================

  connectionTimeout =

    setTimeout(
      function() {

        if (
          peerConnection &&
          peerConnection.connectionState !==
            "connected"
        ) {

          webRTCError(
            "WebRTC connection timed out."
          );

        }

      },
      30000
    );


  log(
    "🎙️ Caller WebRTC setup complete."
  );


  return peerConnection;

}


// ======================================================
// HOST CONNECT
// ======================================================

export async function connectHost(
  callerId
) {

  log(
    "======================================"
  );

  log(
    "HOST CONNECTION STARTING"
  );

  log(
    "Caller ID:",
    callerId
  );

  log(
    "======================================"
  );


  if (!callerId) {

    throw new Error(
      "Caller ID is missing."
    );

  }


  currentCallerId =
    callerId;


  // ====================================================
  // CLOSE OLD CONNECTION
  // ====================================================

  if (peerConnection) {

    try {

      peerConnection.close();

    }

    catch (error) {

      console.warn(
        "Unable to close old host connection:",
        error
      );

    }

    peerConnection =
      null;

  }


  clearConnectionTimeout();


  // ====================================================
  // CREATE HOST CONNECTION
  // ====================================================

  peerConnection =
    createConnection(
      callerId,
      "host"
    );


  // ====================================================
  // WAIT FOR CALLER OFFER
  // ====================================================

  const offer =

    await new Promise(
      function(resolve, reject) {

        let finished =
          false;


        const offerRef =
          ref(
            db,
            `webrtc/${callerId}/offer`
          );


        const unsubscribe =

          onValue(

            offerRef,

            function(snapshot) {

              const data =
                snapshot.val();


              if (
                data &&
                !finished
              ) {

                finished =
                  true;


                unsubscribe();


                resolve(
                  data
                );

              }

            },

            function(error) {

              if (!finished) {

                finished =
                  true;


                unsubscribe();


                reject(
                  error
                );

              }

            }

          );


        setTimeout(
          function() {

            if (!finished) {

              finished =
                true;


              unsubscribe();


              reject(
                new Error(
                  "Timed out waiting for caller offer."
                )
              );

            }

          },
          30000
        );

      }
    );


  log(
    "Caller offer received."
  );


  // ====================================================
  // SET REMOTE DESCRIPTION
  // ====================================================

  await peerConnection.setRemoteDescription(

    new RTCSessionDescription(
      offer
    )

  );


  log(
    "Caller offer accepted."
  );


  // ====================================================
  // CREATE ANSWER
  // ====================================================

  const answer =
    await peerConnection.createAnswer();


  await peerConnection.setLocalDescription(
    answer
  );


  // ====================================================
  // WAIT FOR ICE
  // ====================================================

  await waitForIceGatheringComplete(
    peerConnection
  );


  const localDescription =
    peerConnection.localDescription;


  if (!localDescription) {

    throw new Error(
      "Unable to create host local description."
    );

  }


  // ====================================================
  // SAVE ANSWER
  // ====================================================

  await set(

    ref(
      db,
      `webrtc/${callerId}/answer`
    ),

    {

      type:
        localDescription.type,

      sdp:
        localDescription.sdp

    }

  );


  log(
    "✅ Host answer sent to caller."
  );


  // ====================================================
  // RECEIVE CALLER ICE
  // ====================================================

  callerCandidateListener =

    onChildAdded(

      ref(
        db,
        `webrtc/${callerId}/callerCandidates`
      ),

      async function(snapshot) {

        const candidate =
          snapshot.val();


        if (
          !candidate ||
          !peerConnection
        ) {

          return;

        }


        try {

          await peerConnection.addIceCandidate(

            new RTCIceCandidate(
              candidate
            )

          );


          log(
            "Caller ICE candidate added."
          );

        }

        catch (error) {

          webRTCError(
            "Unable to add caller ICE candidate.",
            error
          );

        }

      }

    );


  // ====================================================
  // HOST CONNECTION TIMEOUT
  // ====================================================

  connectionTimeout =

    setTimeout(
      function() {

        if (
          peerConnection &&
          peerConnection.connectionState !==
            "connected"
        ) {

          webRTCError(
            "Host WebRTC connection timed out."
          );

        }

      },
      30000
    );


  log(
    "🎙️ Host WebRTC setup complete."
  );


  return peerConnection;

}


// ======================================================
// MUTE LOCAL MICROPHONE
// ======================================================

export function muteLocalMicrophone(
  muted
) {

  if (!localStream) {

    log(
      "No microphone stream available."
    );

    return;

  }


  localStream
    .getAudioTracks()
    .forEach(
      function(track) {

        track.enabled =
          !muted;

      }
    );


  log(
    muted
      ? "🔇 Microphone muted."
      : "🎙️ Microphone unmuted."
  );

}


// ======================================================
// CLOSE WEBRTC
// ======================================================

export async function closeWebRTC(
  callerId
) {

  log(
    "Closing WebRTC connection..."
  );


  clearConnectionTimeout();


  // ====================================================
  // STOP MICROPHONE
  // ====================================================

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        function(track) {

          track.stop();

        }
      );


    localStream =
      null;

  }


  // ====================================================
  // CLOSE PEER
  // ====================================================

if (peerConnection) {

    try {

      peerConnection.close();

    }

    catch (error) {

      console.warn(
        "Peer connection close error:",
        error
      );

    }


    peerConnection =
      null;

  }


  // ====================================================
  // REMOVE WEBRTC SIGNALING DATA
  // ====================================================

  if (callerId) {

    try {

      await remove(

        ref(
          db,
          `webrtc/${callerId}`
        )

      );


      log(
        "WebRTC Firebase data removed."
      );

    }

    catch (error) {

      webRTCError(
        "Unable to remove WebRTC Firebase data.",
        error
      );

    }

  }


  answerListener =
    null;

  hostCandidateListener =
    null;

  callerCandidateListener =
    null;

  currentCallerId =
    null;


  log(
    "✅ WebRTC closed."
  );

}


// ======================================================
// EXPORT CURRENT CONNECTION
// ======================================================

export function getPeerConnection() {

  return peerConnection;

}


// ======================================================
// EXPORT MICROPHONE STREAM
// ======================================================

export function getLocalStream() {

  return localStream;

}


// ======================================================
// INITIAL MESSAGE
// ======================================================

log(
  "WebRTC Engine Version 4.0 loaded."
);

log(
  "STUN + ICE gathering protection enabled."
);
