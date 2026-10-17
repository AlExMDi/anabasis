/**
 * Synthesised beep via Web Audio, so there is no audio asset to cache.
 * iOS only lets an AudioContext start inside a user gesture, so `unlockAudio`
 * is called from taps (e.g. ticking a set) and the timer reuses that context.
 */
type Ctx = AudioContext;
let ctx: Ctx | null = null;

function getCtor(): (new () => Ctx) | null {
  const w = globalThis as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function unlockAudio(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state !== 'running') void ctx.resume();
    // A silent buffer finishes the unlock on older iOS versions.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // Audio is a nicety; never break the workout over it.
  }
}

export function playRestDone(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state !== 'running') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1320 : 880;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.2);
    });
  } catch {
    // ignore
  }
}
