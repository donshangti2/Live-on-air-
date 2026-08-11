// ======================================================
// KULZZY RADIO LIVE COMMUNITY
// WEBRTC ENGINE
// ======================================================

import { db } from "./firebase.js";

import {
  ref,
  set,
  onValue,
  onChildAdded,
  remove
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


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


let peerConnection = null;
let localStream = null;
let currentCallerId = null;


// ======================================================
// CREATE CONNECTION
// ======================================================

function createConnection(callerId, role) {

  const pc =
    new RTCPeerConnection(ICE_SERVERS);


  pc.onconnectionstatechange = () => {

    console.log(
      "WebRTC:",
      role,
      pc.connectionState
    );

  };


  // ====================================================
  // ICE CANDIDATES
  // ====================================================

  pc.onicecandidate = async (event) => {

    if (!event.candidate) {
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
        .substring(2, 8);


    try {

      await set(
        ref(
          db,
          `${path}/${candidateId}`
        ),
        event.candidate.toJSON()
      );

    } catch (error) {

      console.error(
        "ICE candidate error:",
        error
      );

    }

  };


  // ====================================================
  // RECEIVE CALLER AUDIO ON HOST
  // ====================================================

  pc.ontrack = (event) => {

    console.log(
      "Caller audio received."
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

      audio.play()
        .catch(
          (error) => {

            console.log(
              "Audio autoplay waiting for user interaction:",
              error
            );

          }
        );

    }

  };


  return pc;

}


// ======================================================
// CALLER CONNECT
// ======================================================

export async function connectCaller(
  callerId
) {

  currentCallerId =
    callerId;


  // ====================================================
  // GET MICROPHONE
  // ====================================================

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


  peerConnection =
    createConnection(
      callerId,
      "caller"
    );


  localStream
    .getTracks()
    .forEach(
      (track) => {

        peerConnection.addTrack(
          track,
          localStream
        );

      }
    );


  const offer =
    await peerConnection.createOffer();


  await peerConnection.setLocalDescription(
    offer
  );


  await set(
    ref(
      db,
      `webrtc/${callerId}/offer`
    ),
    {
      type: offer.type,
      sdp: offer.sdp
    }
  );


  // ====================================================
  // WAIT FOR HOST ANSWER
  // ====================================================

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
        peerConnection &&
        peerConnection.signalingState ===
        "have-local-offer"
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
            "Answer error:",
            error
          );

        }

      }

    }
  );


  // ====================================================
  // HOST ICE CANDIDATES
  // ====================================================

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
          "Host ICE error:",
          error
        );

      }

    }
  );


  return peerConnection;

}


// ======================================================
// HOST CONNECT
// ======================================================

export async function connectHost(
  callerId
) {

  currentCallerId =
    callerId;


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
      (resolve) => {

        const offerRef =
          ref(
            db,
            `webrtc/${callerId}/offer`
          );


        const unsubscribe =
          onValue(
            offerRef,
            (snapshot) => {

              const offer =
                snapshot.val();


              if (offer) {

                unsubscribe();

                resolve(
                  offer
                );

              }

            }
          );

      }
    );


  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(
      offer
    )
  );


  // ====================================================
  // CREATE ANSWER
  // ====================================================

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
      type: answer.type,
      sdp: answer.sdp
    }
  );


  // ====================================================
  // CALLER ICE CANDIDATES
  // ====================================================

  onChildAdded(
    ref(
      db,
      `webrtc/${callerId}/callerCandidates`
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
          "Caller ICE error:",
          error
        );

      }

    }
  );


  console.log(
    "Host connected to caller."
  );


  return peerConnection;

}


// ======================================================
// CLOSE WEBRTC
// ======================================================

export async function closeWebRTC(
  callerId
) {

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) => track.stop()
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

}


// ======================================================
// MUTE LOCAL MICROPHONE
// ======================================================

export function muteLocalMicrophone(
  muted
) {

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

  }
