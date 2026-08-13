/**
 * Every sound in Dino Lab is synthesised when it plays, so the game ships no
 * audio files and a cue costs nothing until it is heard.
 *
 * Browsers refuse to start an AudioContext outside a real gesture, so nothing is
 * built until `unlock()` runs inside a click or key handler. Every entry point
 * is safe to call before that happens — it simply makes no sound.
 *
 * Mute lives in memory only. It deliberately does not touch storage, so nothing
 * here has to care where a phone keeps its site data.
 */

/** Kept low: several cues can overlap during a busy race. */
const MASTER_GAIN = 0.22

let context: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = false

const listeners = new Set<() => void>()

interface Note {
  /** Hertz at the start of the note. */
  freq: number
  /** Hertz to glide to across the note, for swoops. */
  to?: number
  /** Seconds from now the note begins. */
  at?: number
  duration?: number
  wave?: OscillatorType
  /** Relative to the master gain, so 1 is a normal note. */
  gain?: number
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }

function audio(): AudioContext | null {
  if (context) return context
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
    master = context.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(context.destination)
  } catch {
    // No audio hardware, or a policy that blocks it outright. Stay silent.
    context = null
    master = null
  }
  return context
}

/**
 * Call from inside a real click or keypress. The first race start does this, so
 * every later cue already has a running context to play into.
 */
export function unlock() {
  const ctx = audio()
  if (ctx?.state === 'suspended') void ctx.resume()
}

export const isMuted = () => muted

export function setMuted(next: boolean) {
  muted = next
  for (const listener of listeners) listener()
}

export function subscribeToMute(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function play(notes: Note[]) {
  if (muted) return
  const ctx = audio()
  if (!ctx || !master) return
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  for (const note of notes) {
    const start = now + (note.at ?? 0)
    const duration = note.duration ?? 0.16
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()

    oscillator.type = note.wave ?? 'triangle'
    oscillator.frequency.setValueAtTime(note.freq, start)
    if (note.to !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, note.to), start + duration)
    }

    // Fast attack, exponential tail. A linear release ends on an audible click.
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(note.gain ?? 1, start + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    oscillator.connect(envelope).connect(master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }
}

/** A band-limited hiss, used for the grit inside the tornado. */
function playNoise(duration: number, gain: number) {
  if (muted) return
  const ctx = audio()
  if (!ctx || !master) return

  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
    const samples = noiseBuffer.getChannelData(0)
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
  }

  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const envelope = ctx.createGain()

  source.buffer = noiseBuffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1400, now)
  filter.frequency.exponentialRampToValueAtTime(320, now + duration)
  filter.Q.value = 1.1

  envelope.gain.setValueAtTime(0.0001, now)
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.03)
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  source.connect(filter).connect(envelope).connect(master)
  source.start(now)
  source.stop(now + duration)
}

/** One tick of the starting countdown. */
export const playCountBeep = () => play([
  { freq: 587, duration: 0.17, wave: 'square', gain: 0.5 },
])

/** The green light: the countdown tick an octave up, answered by a chord. */
export const playGo = () => play([
  { freq: 784, duration: 0.14, wave: 'square', gain: 0.6 },
  { freq: 988, duration: 0.16, wave: 'square', gain: 0.55, at: 0.09 },
  { freq: 1319, duration: 0.42, wave: 'triangle', gain: 0.8, at: 0.18 },
  { freq: 659, duration: 0.42, wave: 'triangle', gain: 0.5, at: 0.18 },
])

/** Collecting a star: a bright two-note lift. */
export const playStar = () => play([
  { freq: 1047, duration: 0.09, wave: 'triangle', gain: 0.7 },
  { freq: 1568, duration: 0.22, wave: 'triangle', gain: 0.6, at: 0.07 },
])

/** Catching a tornado: a falling swoop with grit under it. */
export function playTornado() {
  play([{ freq: 420, to: 90, duration: 0.5, wave: 'sawtooth', gain: 0.45 }])
  playNoise(0.45, 0.3)
}

/** Crossing the line. Rises for a win, settles for anyone else. */
export const playFinish = (won: boolean) => play(won
  ? [
    { freq: 784, duration: 0.13, gain: 0.7 },
    { freq: 988, duration: 0.13, gain: 0.7, at: 0.12 },
    { freq: 1175, duration: 0.13, gain: 0.7, at: 0.24 },
    { freq: 1568, duration: 0.5, gain: 0.8, at: 0.36 },
  ]
  : [
    { freq: 659, duration: 0.14, gain: 0.55 },
    { freq: 880, duration: 0.34, gain: 0.55, at: 0.13 },
  ])

/** Running out of time in Star Dash. */
export const playTimeUp = () => play([
  { freq: 523, duration: 0.16, gain: 0.6 },
  { freq: 440, duration: 0.16, gain: 0.6, at: 0.15 },
  { freq: 349, duration: 0.4, gain: 0.6, at: 0.3 },
])

/** A small confirmation for buttons that start or change something. */
export const playTap = () => play([
  { freq: 880, duration: 0.07, wave: 'triangle', gain: 0.35 },
])
