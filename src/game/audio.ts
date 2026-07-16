// spec/04 §5: synth-only Web Audio, no sample files. AudioContext is created
// lazily (iOS Safari's autoplay policy requires the first construction/resume
// to happen inside a user gesture) and muted via the master GainNode rather
// than skipped, so settings.sound can toggle without tearing the context down.
const PENTATONIC_HZ = [261.63, 293.66, 329.63, 392.0, 440.0];
const LASER_SWEEP_MS = 300;
const STOP_TAIL_SECONDS = 0.05;
// A5 + E6, a clean perfect fifth - the "澄んだチャイム音" prism plays
// (spec/01 §4.3), distinct from the laser's descending sweep.
const PRISM_CHIME_HZ = [880, 1318.51];
const PRISM_CHIME_RELEASE_SECONDS = 0.4;

export interface AudioEngine {
  unlock(): void;
  setEnabled(enabled: boolean): void;
  playMatch(comboStep: number): void;
  playLaser(): void;
  playPrism(): void;
}

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = true;

  function ensureContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") {
      return null;
    }
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = enabled ? 1 : 0;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  // A sine oscillator wired straight to the master gain, stopped a short
  // tail after its envelope finishes - the shared shape behind both voices
  // below, which otherwise only differ in frequency/gain envelope.
  function createVoice(
    context: AudioContext,
    gainNode: GainNode,
    now: number,
    duration: number,
  ): { osc: OscillatorNode; gain: GainNode } {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(gainNode);
    osc.start(now);
    osc.stop(now + duration + STOP_TAIL_SECONDS);
    return { osc, gain };
  }

  function playTone(freq: number, releaseSeconds: number): void {
    const context = ensureContext();
    if (!context || !master) {
      return;
    }
    const attack = 0.005;
    const now = context.currentTime;
    const { osc, gain } = createVoice(
      context,
      master,
      now,
      attack + releaseSeconds,
    );
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + attack);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + attack + releaseSeconds,
    );
  }

  return {
    unlock() {
      const context = ensureContext();
      if (context?.state === "suspended") {
        context.resume();
      }
    },
    setEnabled(value) {
      enabled = value;
      if (master) {
        master.gain.value = value ? 1 : 0;
      }
    },
    playMatch(comboStep) {
      const freq =
        PENTATONIC_HZ[Math.max(0, comboStep - 1) % PENTATONIC_HZ.length];
      playTone(freq, 0.3);
    },
    playLaser() {
      const context = ensureContext();
      if (!context || !master) {
        return;
      }
      const now = context.currentTime;
      const duration = LASER_SWEEP_MS / 1000;
      const { osc, gain } = createVoice(context, master, now, duration);
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(80, now + duration);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    },
    playPrism() {
      for (const freq of PRISM_CHIME_HZ) {
        playTone(freq, PRISM_CHIME_RELEASE_SECONDS);
      }
    },
  };
}
