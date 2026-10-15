/* Reminder sounds — synthesized with WebAudio (no bundled audio files).
 * Four presets + silent. playSound() is a no-op where WebAudio is missing,
 * so the app never breaks on old WebViews or in tests. */

export const SOUNDS = {
  bell:    { label: 'Bell',    desc: 'Soft two-tone bell' },
  chime:   { label: 'Chime',   desc: 'Three rising notes' },
  classic: { label: 'Classic', desc: 'Double alarm beep' },
  gentle:  { label: 'Gentle',  desc: 'Quiet rising sweep' },
  silent:  { label: 'Silent',  desc: 'Visual alert only' },
}
export const SOUND_IDS = Object.keys(SOUNDS)

let ctx = null
function getCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume?.()
    return ctx
  } catch { return null }
}

const tone = (c, { freq, end = freq, type = 'sine', start = 0, dur = 0.5, gain = 0.3 }) => {
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (end !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
  osc.connect(g); g.connect(c.destination)
  osc.start(t0); osc.stop(t0 + dur + 0.05)
}

/* returns true if a sound was actually produced */
export function playSound(name = 'bell', volume = 0.7) {
  if (!name || name === 'silent') return true
  const c = getCtx()
  if (!c) return false
  const v = Math.max(0, Math.min(1, volume)) * 0.5
  try {
    if (name === 'bell') {
      tone(c, { freq: 830, type: 'triangle', dur: 1.1, gain: v })
      tone(c, { freq: 1245, type: 'sine', dur: 0.9, gain: v * 0.5, start: 0.02 })
    } else if (name === 'chime') {
      ;[523, 659, 784].forEach((f, i) => tone(c, { freq: f, type: 'sine', start: i * 0.16, dur: 0.55, gain: v * 0.8 }))
    } else if (name === 'classic') {
      tone(c, { freq: 880, type: 'square', dur: 0.18, gain: v * 0.55 })
      tone(c, { freq: 880, type: 'square', start: 0.26, dur: 0.18, gain: v * 0.55 })
    } else if (name === 'gentle') {
      tone(c, { freq: 392, end: 523, type: 'sine', dur: 0.8, gain: v * 0.7 })
      tone(c, { freq: 587, type: 'sine', start: 0.55, dur: 0.6, gain: v * 0.5 })
    }
    return true
  } catch { return false }
}

export function testRing(name = 'bell', volume = 0.7) {
  const played = playSound(name, volume)
  try { navigator.vibrate?.([80, 40, 80]) } catch { /* unsupported */ }
  return played
}
