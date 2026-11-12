class RoseAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 48000;
    // Target ~40ms chunk size (never > 100ms)
    this.targetSamples = Math.max(128, Math.min(Math.round(sr * 0.1), Math.round(sr * 0.04)));
    this._buffer = new Float32Array(this.targetSamples);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        let i = 0;
        while (i < channelData.length) {
          const remaining = this.targetSamples - this._offset;
          const toCopy = Math.min(remaining, channelData.length - i);
          this._buffer.set(channelData.subarray(i, i + toCopy), this._offset);
          this._offset += toCopy;
          i += toCopy;

          if (this._offset >= this.targetSamples) {
            const out = new Float32Array(this._buffer);
            this.port.postMessage(out, [out.buffer]);
            this._offset = 0;
          }
        }
      }
    }
    return true;
  }
}

registerProcessor('rose-audio-processor', RoseAudioProcessor);
