// Rose Clean Voice - RNNoise 48kHz (480-sample frame) AudioWorkletProcessor
// Uses local /rnnoise.wasm (@jitsi/rnnoise-wasm) with zero external CDN dependencies.

const RNNOISE_FRAME_SIZE = 480;
const PCM_SCALE = 32768.0;

class RNNoiseWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const procOpts = (options && options.processorOptions) || {};
    this.enabled = procOpts.enabled !== undefined ? Boolean(procOpts.enabled) : true;
    this.wasmReady = false;
    this.wasmMemory = null;
    this.HEAPU8 = null;
    this.HEAPF32 = null;
    this.statePtr = 0;
    this.pcmPtr = 0;
    this.pcmF32Offset = 0;
    this._rnnoise_process_frame = null;
    this._rnnoise_destroy = null;
    this._free = null;

    this.inBuffer = new Float32Array(RNNOISE_FRAME_SIZE);
    this.inWritePos = 0;

    // Ring buffer for denoised output (480 * 8 = 3840 samples)
    this.outRingLen = RNNOISE_FRAME_SIZE * 8;
    this.outRing = new Float32Array(this.outRingLen);
    this.outReadPos = 0;
    this.outWritePos = 0;
    this.outAvailable = 0;

    if (procOpts.wasmBinary) {
      this._initWasm(procOpts.wasmBinary);
    }

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'set-enabled') {
        this.enabled = Boolean(data.enabled);
      } else if (data.type === 'init-wasm' && data.wasmBinary) {
        this._initWasm(data.wasmBinary);
      } else if (data.type === 'destroy') {
        this._cleanup();
      }
    };
  }

  _initWasm(wasmBinary) {
    if (this.wasmReady) return;
    try {
      const self = this;
      const imports = {
        a: {
          // _emscripten_resize_heap
          a: () => false,
          // _emscripten_memcpy_big
          b: (dest, src, num) => {
            if (self.HEAPU8) {
              self.HEAPU8.copyWithin(dest, src, src + num);
            }
          },
        },
      };

      const mod = new WebAssembly.Module(wasmBinary);
      const instance = new WebAssembly.Instance(mod, imports);
      const exports = instance.exports;

      this.wasmMemory = exports.c || exports.memory;
      this.HEAPU8 = new Uint8Array(this.wasmMemory.buffer);
      this.HEAPF32 = new Float32Array(this.wasmMemory.buffer);

      // Initialize Emscripten runtime constructors
      const callCtors = exports.d || exports.__wasm_call_ctors;
      if (typeof callCtors === 'function') {
        callCtors();
      }

      const rnnoiseInit = exports.g || exports._rnnoise_init;
      const rnnoiseCreate = exports.h || exports._rnnoise_create;
      const malloc = exports.e || exports._malloc;

      this._rnnoise_process_frame = exports.j || exports._rnnoise_process_frame;
      this._rnnoise_destroy = exports.i || exports._rnnoise_destroy;
      this._free = exports.f || exports._free;

      if (typeof rnnoiseInit === 'function') {
        rnnoiseInit();
      }

      this.statePtr = rnnoiseCreate(0);
      this.pcmPtr = malloc(RNNOISE_FRAME_SIZE * 4);
      this.pcmF32Offset = this.pcmPtr >> 2;
      this.wasmReady = Boolean(this.statePtr && this.pcmPtr && this._rnnoise_process_frame);
      this.port.postMessage({ type: 'wasm-ready', ready: this.wasmReady });
    } catch (err) {
      this.wasmReady = false;
      this.port.postMessage({
        type: 'wasm-error',
        error: String((err && err.message) || err),
      });
    }
  }

  _cleanup() {
    try {
      if (this.wasmReady) {
        if (this.statePtr && typeof this._rnnoise_destroy === 'function') {
          this._rnnoise_destroy(this.statePtr);
        }
        if (this.pcmPtr && typeof this._free === 'function') {
          this._free(this.pcmPtr);
        }
      }
    } catch (e) {}
    this.statePtr = 0;
    this.pcmPtr = 0;
    this.wasmReady = false;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const inChannel = input[0];
    const outChannel = output[0];
    const len = inChannel.length;

    // Fallback passthrough if Clean Voice is disabled or RNNoise WASM is not ready
    if (!this.enabled || !this.wasmReady) {
      outChannel.set(inChannel);
      for (let ch = 1; ch < output.length; ch++) {
        output[ch].set(inChannel);
      }
      return true;
    }

    try {
      if (this.HEAPF32.buffer !== this.wasmMemory.buffer) {
        this.HEAPU8 = new Uint8Array(this.wasmMemory.buffer);
        this.HEAPF32 = new Float32Array(this.wasmMemory.buffer);
      }

      for (let i = 0; i < len; i++) {
        this.inBuffer[this.inWritePos++] = inChannel[i];

        if (this.inWritePos >= RNNOISE_FRAME_SIZE) {
          const baseIdx = this.pcmF32Offset;
          for (let j = 0; j < RNNOISE_FRAME_SIZE; j++) {
            this.HEAPF32[baseIdx + j] = this.inBuffer[j] * PCM_SCALE;
          }

          this._rnnoise_process_frame(this.statePtr, this.pcmPtr, this.pcmPtr);

          for (let j = 0; j < RNNOISE_FRAME_SIZE; j++) {
            let denoised = this.HEAPF32[baseIdx + j] / PCM_SCALE;
            if (denoised > 1.0) denoised = 1.0;
            else if (denoised < -1.0) denoised = -1.0;
            this.outRing[this.outWritePos] = denoised;
            this.outWritePos = (this.outWritePos + 1) % this.outRingLen;
            if (this.outAvailable < this.outRingLen) {
              this.outAvailable++;
            } else {
              this.outReadPos = (this.outReadPos + 1) % this.outRingLen;
            }
          }

          this.inWritePos = 0;
        }
      }

      if (this.outAvailable >= len) {
        for (let i = 0; i < len; i++) {
          outChannel[i] = this.outRing[this.outReadPos];
          this.outReadPos = (this.outReadPos + 1) % this.outRingLen;
        }
        this.outAvailable -= len;
      } else {
        // Warm-up frames (~8ms before first 480 samples fill)
        outChannel.set(inChannel);
      }

      for (let ch = 1; ch < output.length; ch++) {
        output[ch].set(outChannel);
      }
    } catch (err) {
      // Safe immediate fallback to raw input on any processing error
      this.wasmReady = false;
      outChannel.set(inChannel);
    }

    return true;
  }
}

registerProcessor('rnnoise-worklet-processor', RNNoiseWorkletProcessor);
