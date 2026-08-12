// ======================================================
// KULZZY RADIO LIVE COMMUNITY
// WEBRTC ENGINE
// VERSION 5.0
//
// IMPORTANT
//
// This file works with:
//
//   public/index.html
//   public/admin.html
//   js/admin.js
//   js/firebase.js
//
// Firebase paths remain:
//
//   webrtc/{callerId}/offer
//   webrtc/{callerId}/answer
//   webrtc/{callerId}/callerCandidates
//   webrtc/{callerId}/hostCandidates
//
// ======================================================


import { db } from "./firebase.js";


import {
  ref,
  set,
  get,
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
      urls:
        "stun:stun.l.google.com:19302"
    },

    {
      urls:
        "stun:stun1.l.google.com:19302"
    },

    {
      urls:
        "stun:stun2.l.google.com:19302"
    },

    {
      urls:
        "stun:stun3.l.google.com:19302"
    },

    {
      urls:
        "stun:stun4.l.google.com:19302"
    }

  ],

  iceCandidatePoolSize: 10

};



// ======================================================
// GLOBAL VARIABLES
// ======================================================

let peerConnection =
  null;


let localStream =
  null;


let currentCallerId =
  null;


let answerListener =
  null;


let hostCandidateListener =
  null;


let callerCandidateListener =
  null;


let connectionTimeout =
  null;



// ======================================================
// REMOTE DESCRIPTION READY
// ======================================================

let remoteDescriptionReady =
  false;



// ======================================================
// WAITING ICE CANDIDATES
// ======================================================

let pendingRemoteCandidates =
  [];



// ======================================================
// LOG
// ======================================================

function log(...args) {

  console.log(
    "🎙️ [KULZZY WEBRTC]",
    ...args
  );

}



// ======================================================
// ERROR LOG
// ======================================================

function webRTCError(
  message,
  error = null
) {

  console.error(
    "❌ [KULZZY WEBRTC]",
    message,
    error || ""
  );

}



// ======================================================
// CLEAR TIMEOUT
// ======================================================

function clearConnectionTimeout() {

  if (
    connectionTimeout
  ) {

    clearTimeout(
      connectionTimeout
    );

    connectionTimeout =
      null;

  }

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


      let finished =
        false;


      function finish() {

        if (
          finished
        ) {

          return;

        }


        finished =
          true;


        pc.removeEventListener(
          "icegatheringstatechange",
          checkState
        );


        resolve();

      }


      function checkState() {

        if (
          pc.iceGatheringState ===
          "complete"
        ) {

          finish();

        }

      }


      pc.addEventListener(
        "icegatheringstatechange",
        checkState
      );


      setTimeout(
        finish,
        10000
      );

    }
  );

}



// ======================================================
// ADD REMOTE ICE CANDIDATE
// ======================================================

async function addRemoteCandidate(
  candidate
) {

  if (
    !candidate
  ) {

    return;

  }


  if (
    !peerConnection
  ) {

    pendingRemoteCandidates.push(
      candidate
    );

    return;

  }


  if (
    !remoteDescriptionReady
  ) {

    pendingRemoteCandidates.push(
      candidate
    );


    log(
      "ICE candidate queued until remote description is ready."
    );


    return;

  }


  try {

    await peerConnection.addIceCandidate(

      new RTCIceCandidate(
        candidate
      )

    );


    log(
      "✅ Remote ICE candidate added."
    );

  }

  catch (error) {

    webRTCError(
      "Unable to add remote ICE candidate.",
      error
    );

  }

}



// ======================================================
// FLUSH QUEUED ICE CANDIDATES
// ======================================================

async function flushPendingCandidates() {

  if (
    !peerConnection ||
    !remoteDescriptionReady
  ) {

    return;

  }


  if (
    pendingRemoteCandidates.length ===
    0
  ) {

    return;

  }


  const candidates =
    [
      ...pendingRemoteCandidates
    ];


  pendingRemoteCandidates =
    [];


  log(
    "Adding queued ICE candidates:",
    candidates.length
  );


  for (
    const candidate of candidates
  ) {

    try {

      await peerConnection.addIceCandidate(

        new RTCIceCandidate(
          candidate
        )

      );


      log(
        "✅ Queued ICE candidate added."
      );

    }

    catch (error) {

      webRTCError(
        "Unable to add queued ICE candidate.",
        error
      );

    }

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
          "======================================"
        );


        log(
          "✅ WEBRTC CONNECTION ESTABLISHED"
        );


        log(
          "======================================"
        );

      }


      if (
        pc.connectionState ===
        "failed"
      ) {

        webRTCError(
          "WebRTC connection FAILED."
        );

      }


      if (
        pc.connectionState ===
        "disconnected"
      ) {

        log(
          "⚠️ WebRTC temporarily disconnected."
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


      if (
        pc.iceConnectionState ===
        "failed"
      ) {

        webRTCError(
          "ICE connection failed."
        );

      }

    };



  // ====================================================
  // ICE GATHERING
  // ====================================================

  pc.onicegatheringstatechange =
    function() {

      log(
        "ICE gathering:",
        pc.iceGatheringState
      );

    };



  // ====================================================
  // SIGNALING
  // ====================================================

  pc.onsignalingstatechange =
    function() {

      log(
        "Signaling state:",
        pc.signalingState
      );

    };



  // ====================================================
  // LOCAL ICE CANDIDATE
  // ====================================================

  pc.onicecandidate =
    async function(event) {

      if (
        !event.candidate
      ) {

        return;

      }


      const path =

        role ===
        "caller"

          ?

        `webrtc/${callerId}/callerCandidates`

          :

        `webrtc/${callerId}/hostCandidates`;


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
          "📡 ICE candidate saved:",
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
  // REMOTE AUDIO
  // ====================================================

  pc.ontrack =
    function(event) {

      log(
        "🔊 Remote audio received."
      );


      let audio =
        document.getElementById(
          "webrtcRemoteAudio"
        );


      if (
        !audio
      ) {

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
                "Browser did not automatically play remote audio:",
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

  log(
    "🎙️ Requesting microphone permission..."
  );


  if (
    !navigator.mediaDevices
  ) {

    throw new Error(
      "Browser does not provide mediaDevices."
    );

  }


  if (
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Browser does not support microphone access."
    );

  }


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
              true,

            channelCount:
              1

          },

          video:
            false

        });


    log(
      "✅ MICROPHONE ACCESS GRANTED"
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
// CALLER
// ======================================================

export async function connectCaller(
  callerId
) {

  log(
    "======================================"
  );


  log(
    "🎙️ CALLER CONNECTION STARTING"
  );


  log(
    "Caller ID:",
    callerId
  );


  log(
    "======================================"
  );


  if (
    !callerId
  ) {

    throw new Error(
      "Caller ID is missing."
    );

  }


  currentCallerId =
    callerId;


  remoteDescriptionReady =
    false;


  pendingRemoteCandidates =
    [];



  // ====================================================
  // CLOSE OLD CONNECTION
  // ====================================================

  if (
    peerConnection
  ) {

    try {

      peerConnection.close();

    }

    catch (error) {

      console.warn(
        "Unable to close previous connection:",
        error
      );

    }


    peerConnection =
      null;

  }



  // ====================================================
  // STOP OLD MICROPHONE
  // ====================================================

  if (
    localStream
  ) {

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
  // CREATE CONNECTION
  // ====================================================

  peerConnection =
    createConnection(
      callerId,
      "caller"
    );



  // ====================================================
  // ADD AUDIO
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
    "🎙️ Microphone track added."
  );



  // ====================================================
  // CREATE OFFER
  // ====================================================

  const offer =
    await peerConnection.createOffer();


  await peerConnection.setLocalDescription(
    offer
  );


  log(
    "📡 Caller offer created."
  );



  // ====================================================
  // WAIT FOR ICE
  // ====================================================

  await waitForIceGatheringComplete(
    peerConnection
  );


  const description =
    peerConnection.localDescription;


  if (
    !description
  ) {

    throw new Error(
      "Caller local description was not created."
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
        description.type,

      sdp:
        description.sdp

    }

  );


  log(
    "✅ CALLER OFFER SENT TO FIREBASE"
  );



  // ====================================================
  // LISTEN FOR HOST ANSWER
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


        if (
          !answer
        ) {

          return;

        }


        if (
          !peerConnection
        ) {

          return;

        }


        if (
          remoteDescriptionReady
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

          await peerConnection
            .setRemoteDescription(

              new RTCSessionDescription(
                answer
              )

            );


          remoteDescriptionReady =
            true;


          log(
            "✅ HOST ANSWER RECEIVED"
          );


          await flushPendingCandidates();

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
  // HOST ICE CANDIDATES
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


        await addRemoteCandidate(
          candidate
        );

      }

    );



  // ====================================================
  // TIMEOUT
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
            "Caller WebRTC connection timed out."
          );

          log(
            "ICE state:",
            peerConnection.iceConnectionState
          );

          log(
            "Connection state:",
            peerConnection.connectionState
          );

        }

      },
      30000
    );


  log(
    "🎙️ CALLER WEBRTC READY"
  );


  return peerConnection;

}



// ======================================================
// HOST
// ======================================================

export async function connectHost(
  callerId
) {

  log(
    "======================================"
  );


  log(
    "🎧 HOST CONNECTION STARTING"
  );


  log(
    "Caller ID:",
    callerId
  );


  log(
    "======================================"
  );


  if (
    !callerId
  ) {

    throw new Error(
      "Caller ID is missing."
    );

  }


  currentCallerId =
    callerId;


  remoteDescriptionReady =
    false;


  pendingRemoteCandidates =
    [];



  // ====================================================
  // CLOSE OLD CONNECTION
  // ====================================================

  if (
    peerConnection
  ) {

    try {

      peerConnection.close();

    }

    catch (error) {

      console.warn(
        "Unable to close previous host connection:",
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
  // WAIT FOR OFFER
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

              if (
                finished
              ) {

                return;

              }


              finished =
                true;


              unsubscribe();


              reject(
                error
              );

            }

          );


        setTimeout(
          function() {

            if (
              finished
            ) {

              return;

            }


            finished =
              true;


            unsubscribe();


            reject(

              new Error(
                "Timed out waiting for caller offer."
              )

            );

          },
          30000
        );

      }
    );



  log(
    "✅ CALLER OFFER RECEIVED"
  );



  // ====================================================
  // SET REMOTE DESCRIPTION
  // ====================================================

  await peerConnection
    .setRemoteDescription(

      new RTCSessionDescription(
        offer
      )

    );


  remoteDescriptionReady =
    true;


  log(
    "✅ CALLER OFFER ACCEPTED"
  );


  await flushPendingCandidates();



  // ====================================================
  // CREATE ANSWER
  // ====================================================

  const answer =
    await peerConnection.createAnswer();


  await peerConnection.setLocalDescription(
    answer
  );


  log(
    "📡 Host answer created."
  );



// ====================================================
  // WAIT FOR ICE
  // ====================================================

  await waitForIceGatheringComplete(
    peerConnection
  );


  const description =
    peerConnection.localDescription;


  if (
    !description
  ) {

    throw new Error(
      "Host local description was not created."
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
        description.type,

      sdp:
        description.sdp

    }

  );


  log(
    "✅ HOST ANSWER SENT"
  );



  // ====================================================
  // CALLER ICE
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


        await addRemoteCandidate(
          candidate
        );

      }

    );// ====================================================
  // TIMEOUT
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


          log(
            "ICE state:",
            peerConnection.iceConnectionState
          );


          log(
            "Connection state:",
            peerConnection.connectionState
          );

        }

      },
      30000
    );


  log(
    "🎧 HOST WEBRTC READY"
  );


  return peerConnection;

}



// ======================================================
// MUTE MICROPHONE
// ======================================================

export function muteLocalMicrophone(
  muted
) {

  if (
    !localStream
  ) {

    log(
      "No local microphone stream."
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

      ?

    "🔇 MICROPHONE MUTED"

      :

    "🎙️ MICROPHONE ON"

  );

}



// ======================================================
// CLOSE WEBRTC
// ======================================================

export async function closeWebRTC(
  callerId
) {

  log(
    "Closing WebRTC..."
  );


  clearConnectionTimeout();


// ====================================================
  // STOP MICROPHONE
  // ====================================================

  if (
    localStream
  ) {

    localStream
      .getTracks()
      .forEach(
        function(track) {

          try {

            track.stop();

          }

          catch (error) {

            console.warn(
              "Unable to stop microphone track:",
              error
            );

          }

        }
      );


    localStream =
      null;

  }



  // ====================================================
  // CLOSE PEER
  // ====================================================

  if (
    peerConnection
  ) {

    try {

      peerConnection.close();

    }

    catch (error) {

      console.warn(
        "Unable to close peer connection:",
        error
      );

    }


    peerConnection =
      null;

  }



  // ====================================================
  // REMOVE SIGNALING DATA
  // ====================================================

  if (
    callerId
  ) {

    try {

      await remove(

        ref(
          db,
          `webrtc/${callerId}`
        )

      );


      log(
        "✅ WebRTC Firebase data removed."
      );

    }

    catch (error) {

      webRTCError(
        "Unable to remove WebRTC Firebase data.",
        error
      );

    }

  }



  // ====================================================
  // RESET
  // ====================================================

  answerListener =
    null;


  hostCandidateListener =
    null;


  callerCandidateListener =
    null;


  currentCallerId =
    null;


  remoteDescriptionReady =
    false;


  pendingRemoteCandidates =
    [];


  log(
    "✅ WEBRTC CLOSED"
  );

}


// ======================================================
// GET PEER CONNECTION
// ======================================================

export function getPeerConnection() {

  return peerConnection;

}



// ======================================================
// GET LOCAL STREAM
// ======================================================

export function getLocalStream() {

  return localStream;

}



// ======================================================
// INITIAL MESSAGE
// ======================================================

log(
  "======================================"
);


log(
  "KULZZY RADIO WEBRTC ENGINE"
);


log(
  "VERSION 5.0"
);


log(
  "ICE candidate queue enabled."
);


log(
  "Remote-description protection enabled."
);


log(
  "STUN servers enabled."
);


log(
  "======================================"
);
