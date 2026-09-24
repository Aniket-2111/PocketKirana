/**
 * PocketKirana Picker Feedback Utility
 * 
 * Provides responsive sound tones (Web Audio API) and haptic vibrations
 * for store-floor picker interactions.
 */

export function playSuccessSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {
    // AudioContext may be restricted or unsupported
  }
}

export function playErrorSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
    osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.1); // E3

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

export function playCompleteSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.07);
      osc.stop(ctx.currentTime + idx * 0.07 + 0.3);
    });
  } catch (_) {}
}

export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'medium') {
  if (typeof window === 'undefined' || !navigator?.vibrate) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(20);
        break;
      case 'medium':
        navigator.vibrate(40);
        break;
      case 'success':
        navigator.vibrate([30, 40, 60]);
        break;
      case 'warning':
        navigator.vibrate([50, 40, 50, 40, 50]);
        break;
      case 'error':
        navigator.vibrate([100, 50, 150]);
        break;
    }
  } catch (_) {}
}
