import type { DinosaurConfig } from '../game/dinosaurTypes'
import type { Pickup, PickupKind } from './pickups'
import type { RacerState } from './raceEngine'

/**
 * A race is recorded rather than re-simulated.
 *
 * Running it again from the same starting grid would not reproduce it: the
 * pickups are placed with Math.random, and in drive mode the result depends on
 * what the player did with their thumbs. So the race writes down where everyone
 * actually was, and the replay reads it back.
 *
 * The tape is small. Twenty samples a second over a forty second race with a
 * full grid of six is a few thousand numbers — nothing worth compressing.
 */
export const REPLAY_HZ = 20

export interface ReplaySample {
  progress: number
  lane: number
  /** 1 while running backwards after a tornado, 0 otherwise. */
  flip: number
  /** 1 while a star boost is running, so the standings can show it again. */
  boost: number
  /** Extra spin-out rotation in radians, so the tornado hit reads on playback. */
  spin: number
  /** Speed over base speed, which drives the leg animation. */
  gait: number
}

export interface ReplayFrame {
  time: number
  racers: ReplaySample[]
}

/**
 * A pickup's life as a span rather than a per-frame list: they are spawned and
 * taken, not moved, so two timestamps say everything.
 */
export interface ReplayPickupSpan {
  id: number
  kind: PickupKind
  t: number
  lane: number
  from: number
  to: number
}

export interface ReplayEntry {
  id: string
  name: string
  config: DinosaurConfig
  driven: boolean
  /** Filled in when the tape is closed, so playback can rank finishers. */
  place: number | null
  finishedAt: number | null
}

export interface Replay {
  courseId: string
  entries: ReplayEntry[]
  frames: ReplayFrame[]
  pickups: ReplayPickupSpan[]
  duration: number
}

export interface ReplayRecorder {
  /** Called every frame. Sampling is throttled inside; pickups are not, so a
   * short-lived tornado cannot slip between two samples unrecorded. */
  capture(time: number, samples: ReplaySample[], live: Pickup[]): void
  /** Closes anything still on the track and hands back the finished tape. */
  finish(): Replay
  get length(): number
}

export function createRecorder(courseId: string, racers: RacerState[]): ReplayRecorder {
  const frames: ReplayFrame[] = []
  const pickups: ReplayPickupSpan[] = []
  const open = new Map<number, ReplayPickupSpan>()
  let lastSample = -Infinity
  let duration = 0

  return {
    get length() { return frames.length },

    capture(time, samples, live) {
      duration = time

      const seen = new Set<number>()
      for (const pickup of live) {
        seen.add(pickup.id)
        if (open.has(pickup.id)) continue
        const span: ReplayPickupSpan = {
          id: pickup.id,
          kind: pickup.kind,
          t: pickup.t,
          lane: pickup.lane,
          from: time,
          to: Infinity,
        }
        open.set(pickup.id, span)
        pickups.push(span)
      }
      for (const [id, span] of open) {
        if (seen.has(id)) continue
        span.to = time
        open.delete(id)
      }

      if (time - lastSample < 1 / REPLAY_HZ) return
      lastSample = time
      // Copied, not referenced: the caller reuses its sample objects each frame.
      frames.push({ time, racers: samples.map((sample) => ({ ...sample })) })
    },

    finish() {
      for (const span of open.values()) span.to = duration
      open.clear()
      // Read now rather than at creation: places are only known once they race.
      const entries: ReplayEntry[] = racers.map((racer) => ({
        id: racer.id,
        name: racer.name,
        config: racer.config,
        driven: racer.driven,
        place: racer.place,
        finishedAt: racer.finishedAt,
      }))
      return { courseId, entries, frames, pickups, duration }
    },
  }
}

/**
 * Fills `out` with every racer's position at `time`, interpolated between the
 * two samples either side of it.
 *
 * `cursor` is the frame the last call landed on. Playback normally walks
 * forwards, so starting the search there makes the common case a step or two;
 * scrubbing the bar falls back to a scan from the nearest end.
 */
export function sampleReplay(
  replay: Replay,
  time: number,
  out: ReplaySample[],
  cursor = 0,
): number {
  const { frames } = replay
  if (!frames.length) return 0

  let index = Math.min(Math.max(cursor, 0), frames.length - 1)
  if (frames[index].time > time) {
    while (index > 0 && frames[index].time > time) index--
  } else {
    while (index < frames.length - 2 && frames[index + 1].time <= time) index++
  }

  const current = frames[index]
  const next = frames[Math.min(index + 1, frames.length - 1)]
  const span = next.time - current.time
  const blend = span > 0 ? Math.min(1, Math.max(0, (time - current.time) / span)) : 0

  for (let racer = 0; racer < out.length; racer++) {
    const a = current.racers[racer]
    const b = next.racers[racer]
    if (!a || !b) continue
    const sample = out[racer]
    sample.progress = a.progress + (b.progress - a.progress) * blend
    sample.lane = a.lane + (b.lane - a.lane) * blend
    sample.gait = a.gait + (b.gait - a.gait) * blend
    sample.spin = a.spin + (b.spin - a.spin) * blend
    // Flags, not quantities: blending them would half-turn the dinosaur.
    sample.flip = blend < 0.5 ? a.flip : b.flip
    sample.boost = blend < 0.5 ? a.boost : b.boost
  }

  return index
}

export const emptySample = (): ReplaySample => ({ progress: 0, lane: 0, flip: 0, boost: 0, spin: 0, gait: 0 })

/** Playback position and transport, held in a ref so scrubbing never re-renders. */
export interface Playback {
  time: number
  playing: boolean
  speed: number
}

export const REPLAY_SPEEDS = [1, 2, 0.5] as const
