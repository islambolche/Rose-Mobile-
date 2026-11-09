let globalStream: MediaStream | null = null;
let isInitializing = false;

export async function stopGlobalMicStream() {
  if (globalStream) {
    globalStream.getTracks().forEach((track) => {
      track.stop();
    });
    globalStream = null;
  }
}

export async function getGlobalMicStream(
  options?: MediaStreamConstraints, 
  retryCount = 0,
  onErrorToast?: (msg: string) => void
): Promise<MediaStream> {
  // If already initializing, wait a bit
  if (isInitializing) {
    await new Promise((r) => setTimeout(r, 500));
    return getGlobalMicStream(options, retryCount, onErrorToast);
  }

  // Check if existing stream is alive
  if (globalStream && globalStream.active) {
    const hasLiveTrack = globalStream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);
    if (hasLiveTrack) return globalStream;
  }

  isInitializing = true;
  try {
    // Ensure old tracks are stopped before requesting new ones to avoid NotReadableError on some devices
    await stopGlobalMicStream();

    const stream = await navigator.mediaDevices.getUserMedia(options || {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    globalStream = stream;
    return stream;
  } catch (err: any) {
    const errName = String(err?.name || "");
    const errMsg = String(err?.message || err || "");

    // Point 2: NotReadableError retry logic
    if (errName === "NotReadableError" && retryCount < 3) {
      console.warn(`[AudioManager] NotReadableError, retrying ${retryCount + 1}/3...`);
      await new Promise((r) => setTimeout(r, 1500));
      isInitializing = false;
      return getGlobalMicStream(options, retryCount + 1, onErrorToast);
    }

    if (errName === "NotReadableError") {
      onErrorToast?.("মাইক অন্য app ব্যবহার করছে, সেটা বন্ধ করে আবার চেষ্টা করুন");
    }

    throw err;
  } finally {
    isInitializing = false;
  }
}

export function isMicActive() {
  return !!(globalStream && globalStream.active && globalStream.getAudioTracks().some(t => t.readyState === 'live'));
}
