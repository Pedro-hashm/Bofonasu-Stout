import { getVirtmic } from "./virtualMic";

export { useVoice, VoiceContext } from "./state";

export { InRoom } from "./components/InRoom";
export { RoomAudioManager } from "./components/RoomAudioManager";
export { stoatSinkName } from "./virtualMic";

const originalMediaCall = navigator.mediaDevices.getDisplayMedia;

type OwnAudioConstraints = MediaTrackConstraints & {
  restrictOwnAudio?: boolean;
};

navigator.mediaDevices.getDisplayMedia = async function (opts) {
  // Apply the exclusion at the actual browser boundary as well as in LiveKit
  // options. Other callers may request `audio: true` instead of an options object.
  if (opts?.audio) {
    const audio: OwnAudioConstraints = {
      ...(typeof opts.audio === "object" ? opts.audio : {}),
      restrictOwnAudio: true,
    };
    opts = {
      ...opts,
      audio,
    };
  }
  // Hard overwrite the track constraints so that we -never ever- get a track
  // that is over 720p when requesting a new video track
  if (opts && opts.video && typeof opts.video === "object") {
    opts.video = {
      ...opts.video,
      frameRate: { ideal: 5, max: 5 },
      width: { ideal: 640, max: 640 },
      height: { ideal: 480, max: 480 },
    };
  }

  const stream: MediaStream = await originalMediaCall.call(this, opts);

  if (opts?.audio && (await window.native?.isWayland?.()) === true) {
    const id = await getVirtmic();

    console.debug("Virt mic acquired:", id);

    if (id) {
      const audio = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: id,
          },
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        },
      });

      stream.getAudioTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(audio.getAudioTracks()[0]);
    }
  }

  // Only route metadata is logged, never audio content or device identifiers.
  const audio = stream.getAudioTracks()[0];
  if (audio) {
    const settings = audio.getSettings() as MediaTrackSettings & {
      restrictOwnAudio?: boolean;
    };
    console.info("[Screenshare audio]", {
      desktop: !!window.native,
      ownAudioExclusionConfirmed:
        settings.deviceId === "loopbackWithoutChrome" ||
        settings.restrictOwnAudio === true,
      ownAudioConstraintSupported:
        (
          navigator.mediaDevices.getSupportedConstraints() as MediaTrackSupportedConstraints & {
            restrictOwnAudio?: boolean;
          }
        ).restrictOwnAudio === true,
    });
  }

  return stream;
};
