export type NoiseGateSensitivity = 'Low' | 'Medium' | 'High';

export interface NoiseGateFrameResult {
  isOpen: boolean;
  rmsDb: number;
  noiseFloorDb: number;
  thresholdDb: number;
}

export class NoiseGateEngine {
  private lastLogTime = 0;
  private noiseFloorDb = -60;
  private history: number[] = [];
  private hangoverMsLeft = 0;
  private lastProcessTime = Date.now();
  private isOpen = false;

  public processFrame(
    samples: Float32Array | Int16Array,
    isEnabled: boolean,
    sensitivity: NoiseGateSensitivity = 'Medium'
  ): NoiseGateFrameResult {
    if (!isEnabled) {
      this.isOpen = true;
      return { isOpen: true, rmsDb: -30, noiseFloorDb: -60, thresholdDb: -50 };
    }

    try {
      const now = Date.now();
      const dt = Math.max(1, now - this.lastProcessTime);
      this.lastProcessTime = now;

      const len = samples.length;
      if (len === 0) {
        return { isOpen: this.isOpen, rmsDb: -90, noiseFloorDb: this.noiseFloorDb, thresholdDb: -50 };
      }

      // Calculate RMS
      let sumSq = 0;
      if (samples instanceof Float32Array) {
        for (let i = 0; i < len; i++) {
          const val = samples[i];
          sumSq += val * val;
        }
      } else {
        for (let i = 0; i < len; i++) {
          const norm = samples[i] / 32768;
          sumSq += norm * norm;
        }
      }

      const rms = Math.sqrt(sumSq / len);
      const rmsDb = 20 * Math.log10(rms + 1e-6);

      // Noise floor estimation: rolling history over ~3 seconds (up to 60 frames)
      this.history.push(rmsDb);
      if (this.history.length > 60) {
        this.history.shift();
      }

      // 15th percentile as noise floor estimate
      const sorted = [...this.history].sort((a, b) => a - b);
      const p15Idx = Math.floor(sorted.length * 0.15);
      const estimatedFloor = sorted[p15Idx] !== undefined ? sorted[p15Idx] : -60;

      // Smooth noise floor adaptation
      this.noiseFloorDb = this.noiseFloorDb * 0.95 + estimatedFloor * 0.05;

      // Determine margin based on sensitivity setting
      let marginDb = 10;
      if (sensitivity === 'Low') marginDb = 6;
      else if (sensitivity === 'High') marginDb = 14;

      const thresholdDb = this.noiseFloorDb + marginDb;

      // Check threshold and hangover time
      if (rmsDb > thresholdDb) {
        this.isOpen = true;
        this.hangoverMsLeft = 300;
      } else {
        this.hangoverMsLeft = Math.max(0, this.hangoverMsLeft - dt);
        this.isOpen = this.hangoverMsLeft > 0;
      }

      // Throttled logging (once per second)
      if (now - this.lastLogTime >= 1000) {
        this.lastLogTime = now;
        console.log(
          `[NoiseGate] Floor: ${this.noiseFloorDb.toFixed(1)} dB | Threshold: ${thresholdDb.toFixed(1)} dB | Level: ${rmsDb.toFixed(1)} dB | State: ${this.isOpen ? 'OPEN' : 'CLOSED'}`
        );
      }

      // If gate is closed, replace mic audio frames with digital silence (0s)
      if (!this.isOpen) {
        if (samples instanceof Float32Array) {
          samples.fill(0);
        } else if (samples instanceof Int16Array) {
          samples.fill(0);
        }
      }

      return {
        isOpen: this.isOpen,
        rmsDb,
        noiseFloorDb: this.noiseFloorDb,
        thresholdDb,
      };
    } catch (err) {
      // Graceful error recovery: bypass noise gate on error
      this.isOpen = true;
      return { isOpen: true, rmsDb: 0, noiseFloorDb: -60, thresholdDb: -50 };
    }
  }

  public getStatus() {
    return {
      noiseFloorDb: this.noiseFloorDb,
      isOpen: this.isOpen,
    };
  }

  public reset() {
    this.noiseFloorDb = -60;
    this.history = [];
    this.hangoverMsLeft = 0;
    this.isOpen = false;
  }
}

export const globalNoiseGateEngine = new NoiseGateEngine();
