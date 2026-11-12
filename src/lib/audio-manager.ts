import { getMicListeningSettings } from './cleanVoiceAndVad';

let globalStream: MediaStream | null = null;
let isInitializing = false;

export function setBrowserAudioSessionType(type: 'playback' | 'play-and-record') {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).audioSession) {
      (navigator as any).audioSession.type = type;
    }
  } catch {}
}

export async function stopGlobalMicStream() {
  if (globalStream) {
    globalStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    globalStream = null;
  }
}

export function pauseGlobalMicForSpeech(extraStreams?: Array<MediaStream | null | undefined>) {
  setBrowserAudioSessionType('playback');
  try {
    if (globalStream) {
      globalStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      globalStream = null;
    }
    if (Array.isArray(extraStreams)) {
      for (const s of extraStreams) {
        if (!s) continue;
        s.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      }
    }
  } catch {}
}

export function resumeGlobalMicAfterSpeech(extraStreams?: Array<MediaStream | null | undefined>) {
  setBrowserAudioSessionType('play-and-record');
}

export async function getGlobalMicStream(
  options?: MediaStreamConstraints, 
  retryCount = 0,
  onErrorToast?: (msg: string) => void
): Promise<MediaStream> {
  if (isInitializing) {
    await new Promise((r) => setTimeout(r, 400));
    return getGlobalMicStream(options, retryCount, onErrorToast);
  }

  setBrowserAudioSessionType('play-and-record');

  if (globalStream && globalStream.active) {
    const liveTracks = globalStream.getAudioTracks().filter(t => t.readyState === 'live');
    if (liveTracks.length > 0) {
      liveTracks.forEach(t => { t.enabled = true; });
      return globalStream;
    }
  }

  isInitializing = true;
  try {
    await stopGlobalMicStream();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      onErrorToast?.("মাইক পাওয়া যায়নি");
      const notFoundErr = new Error("মাইক পাওয়া যায়নি");
      notFoundErr.name = "NotFoundError";
      throw notFoundErr;
    }

    const { cleanVoice } = getMicListeningSettings();
    let audioConstraints: boolean | MediaTrackConstraints;

    if (cleanVoice) {
      audioConstraints = {
        ...(typeof options?.audio === 'object' ? options.audio : {}),
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
      };
    } else {
      audioConstraints = true;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        ...options,
        audio: audioConstraints,
      });
    } catch (webrtcErr: any) {
      if (cleanVoice) {
        console.warn('[AudioManager] WebRTC noise suppression stream failed, falling back to default mic:', webrtcErr);
        stream = await navigator.mediaDevices.getUserMedia({
          ...options,
          audio: true,
        });
      } else {
        throw webrtcErr;
      }
    }

    globalStream = stream;
    return stream;
  } catch (err: any) {
    const errName = String(err?.name || "");
    const errMsg = String(err?.message || "");

    if (errName === "NotReadableError" && retryCount < 3) {
      console.warn(`[AudioManager] NotReadableError, retrying ${retryCount + 1}/3...`);
      await new Promise((r) => setTimeout(r, 1200));
      isInitializing = false;
      return getGlobalMicStream(options, retryCount + 1, onErrorToast);
    }

    if (errName === "NotReadableError") {
      onErrorToast?.("মাইক অন্য app ব্যবহার করছে, সেটা বন্ধ করে আবার চেষ্টা করুন");
    } else if (
      errName === "NotFoundError" ||
      errName === "DevicesNotFoundError" ||
      /device not found|requested device not found/i.test(errMsg)
    ) {
      onErrorToast?.("মাইক পাওয়া যায়নি");
    }

    throw err;
  } finally {
    isInitializing = false;
  }
}

export function isMicActive() {
  return !!(globalStream && globalStream.active && globalStream.getAudioTracks().some(t => t.readyState === 'live'));
}
