// ======================================================
// KULZZY RADIO LIVE COMMUNITY
// WebRTC Voice Connection Engine
// ======================================================
//
// This file handles the private audio connection between
// the caller and the host.
//
// IMPORTANT:
// The caller's microphone is NOT broadcast to the public
// website by this file.
//
// Firebase Realtime Database is used for WebRTC signaling.
//
// ======================================================


import { db } from "./firebase.js";

import {
  ref,
  set,
  update,
  onValue,
  onChildAdded,
  remove
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


// ======================================================
// WEBRTC CONFIGURATION
// ======================================================

const ICE_SERVERS = {

  iceServers: [

    {
      urls: "stun:stun.l.google.com:19302"
    },

    {
      urls: "stun:stun1.l.google.com:19302"
    }

  ]

};


// ======================================================
// VARIABLES
// ======================================================

let peerConnection = null;

let localStream = null;

let currentCallerId = null;

let currentHostId = null;

let isHost = false;

let isMuted = true;


// ======================================================
// CREATE PEER CONNECTION
// ======================================================

function createPeerConnection() {

  const connection =
    new RTCPeerConnection(
      ICE_SERVERS
    );


  // --------------------------------------------
  // ICE CANDIDATE
  // --------------------------------------------

  connection.onicecandidate =
    async (event) => {

      if (!event.candidate) {
        return;
      }


      if (!currentCallerId) {
        return;
      }


      const candidateRef =
        ref(
          db,
          `webrtc/${currentCallerId}/candidates`
        );


      const candidateId =
        Date.now().toString() +
        "-" +
        Math.random()
          .toString(36)
          .substring(2, 8);


      try {

        await set(
          ref(
            db,
            `webrtc/${currentCallerId}/candidates/${candidateId}`
          ),
          event.candidate.toJSON()
        );

      } catch (error) {

        console.error(
          "Unable to save ICE candidate:",
          error
        );

      }

    };


  // --------------------------------------------
  // CONNECTION STATE
  // --------------------------------------------

  connection.onconnectionstatechange =
    () => {

      console.log(
        "WebRTC connection:",
        connection.connectionState
      );


      if (
        connection.connectionState ===
        "failed"
      ) {

        console.error(
          "WebRTC connection failed."
        );

      }


      if (
        connection.connectionState ===
        "disconnected"
      ) {

        console.log(
          "WebRTC connection disconnected."
        );

      }

    };


  // --------------------------------------------
  // REMOTE AUDIO
  // --------------------------------------------

  connection.ontrack =
    (event) => {

      console.log(
        "Remote audio received."
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

      }

    };


  return connection;

}


// ======================================================
// CALLER: GET MICROPHONE
// ======================================================

export async function getCallerMicrophone() {

  try {

    if (localStream) {

      return localStream;

    }


    localStream =
      await navigator.mediaDevices
        .getUserMedia({

          audio: {

            echoCancellation: true,

            noiseSuppression: true,

            autoGainControl: true

          },

          video: false

        });


    console.log(
      "Caller microphone obtained."
    );


    // Start muted.

    setMicrophoneMuted(
      true
    );


    return localStream;

  } catch (error) {

    console.error(
      "Microphone permission error:",
      error
    );


    throw error;

  }

}


// ======================================================
// MUTE MICROPHONE
// ======================================================

export function setMicrophoneMuted(
  muted
) {

  isMuted =
    muted;


  if (!localStream) {
    return;
  }


  localStream
    .getAudioTracks()
    .forEach(
      (track) => {

        track.enabled =
          !muted;

      }
    );


  console.log(
    muted
      ? "Microphone muted."
      : "Microphone unmuted."
  );

}


// ======================================================
// GET MICROPHONE STATUS
// ======================================================

export function microphoneIsMuted() {

  return isMuted;

}


// ======================================================
// CALLER: CONNECT TO HOST
// ======================================================

export async function connectCaller(
  callerId
) {

  currentCallerId =
    callerId;

  isHost =
    false;


  // Get microphone

  const stream =
    await getCallerMicrophone();


  peerConnection =
    createPeerConnection();


  // --------------------------------------------
  // ADD MICROPHONE TRACKS
  // --------------------------------------------

  stream
    .getTracks()
    .forEach(
      (track) => {

        peerConnection.addTrack(
          track,
          stream
        );

      }
    );


  // --------------------------------------------
  // CREATE OFFER
  // --------------------------------------------

  const offer =
    await peerConnection.createOffer();


  await peerConnection.setLocalDescription(
    offer
  );


  // --------------------------------------------
  // SAVE OFFER
  // --------------------------------------------

  await set(
    ref(
      db,
      `webrtc/${callerId}/offer`
    ),
    {

      type:
        offer.type,

      sdp:
        offer.sdp

    }
  );


  // --------------------------------------------
  // LISTEN FOR ANSWER
  // --------------------------------------------

  onValue(
    ref(
      db,
      `webrtc/${callerId}/answer`
    ),

    async (snapshot) => {

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
        peerConnection
          .signalingState !==
        "stable"
      ) {

        try {

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              answer
            )
          );

          console.log(
            "Host answer received."
          );

        } catch (error) {

          console.error(
            "Unable to set host answer:",
            error
          );

        }

      }

    }

  );


  // --------------------------------------------
  // LISTEN FOR HOST ICE
  // --------------------------------------------

  onChildAdded(
    ref(
      db,
      `webrtc/${callerId}/hostCandidates`
    ),

    async (snapshot) => {

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

      } catch (error) {

        console.error(
          "Unable to add host ICE candidate:",
          error
        );

      }

    }

  );


  console.log(
    "Caller WebRTC offer created."
  );


  return peerConnection;

}


// ======================================================
// HOST: LISTEN FOR CALLER
// ======================================================

export function listenForCaller(
  callerId
) {

  currentCallerId =
    callerId;

  currentHostId =
    "host";

  isHost =
    true;


  console.log(
    "Listening for caller:",
    callerId
  );


  onValue(
    ref(
      db,
      `webrtc/${callerId}/offer`
    ),

    async (snapshot) => {

      const offer =
        snapshot.val();


      if (!offer) {

        return;

      }


      await acceptCallerOffer(
        callerId,
        offer
      );

    }

  );

}


// ======================================================
// HOST: ACCEPT CALLER OFFER
// ======================================================

export async function acceptCallerOffer(
  callerId,
  offer
) {

  currentCallerId =
    callerId;

  isHost =
    true;


  if (!peerConnection) {

    peerConnection =
      createPeerConnection();

  }


  try {

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(
        offer
      )
    );


    const answer =
      await peerConnection.createAnswer();


    await peerConnection.setLocalDescription(
      answer
    );


    await set(
      ref(
        db,
        `webrtc/${callerId}/answer`
      ),
      {

        type:
          answer.type,

        sdp:
          answer.sdp

      }
    );


    console.log(
      "Host answer sent."
    );


  } catch (error) {

    console.error(
      "Unable to accept caller:",
      error
    );

  }

}


// ======================================================
// HOST: MUTE CALLER
// ======================================================
//
// This function changes the caller's Firebase
// permission state AND can be used by the host
// to control the received audio.
//
// ======================================================

export async function muteCaller(
  callerId
) {

  await update(
    ref(
      db,
      `callers/${callerId}`
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


  console.log(
    "Caller muted:",
    callerId
  );

}


// ======================================================
// HOST: ALLOW CALLER
// ======================================================

export async function allowCaller(
  callerId
) {

  await update(
    ref(
      db,
      `callers/${callerId}`
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


  console.log(
    "Caller allowed to speak:",
    callerId
  );

}


// ======================================================
// CLOSE CONNECTION
// ======================================================

export async function closeWebRTC(
  callerId
) {

  try {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(
          (track) => {

            track.stop();

          }
        );

      localStream =
        null;

    }


    if (peerConnection) {

      peerConnection.close();

      peerConnection =
        null;

    }


    if (callerId) {

      await remove(
        ref(
          db,
          `webrtc/${callerId}`
        )
      );

    }


    currentCallerId =
      null;

    currentHostId =
      null;


    console.log(
      "WebRTC connection closed."
    );

  } catch (error) {

    console.error(
      "Error closing WebRTC:",
      error
    );

  }

}


// ======================================================
// EXPORT CURRENT CONNECTION
// ======================================================

export function getPeerConnection() {

  return peerConnection;

}


// ======================================================
// EXPORT CURRENT CALLER
// ======================================================

export function getCurrentCallerId() {

  return currentCallerId;

}


// ======================================================
// INITIAL MESSAGE
// ======================================================

console.log(
  "Kulzzy Radio WebRTC engine loaded."
);
