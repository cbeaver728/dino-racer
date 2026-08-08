export type PickupKind = 'star' | 'tornado'

export interface Pickup {
  id: number
  kind: PickupKind
  /** Lap fraction, matching a racer's own position along the circuit. */
  t: number
  lane: number
  bornAt: number
  /** Elapsed time this pickup disappears at; stars stay until taken. */
  diesAt: number | null
  taken: boolean
}

/**
 * Stars: keep arriving through the race and wait to be collected. Tuned so a
 * lucky run shaves a few seconds rather than halving the lap — at 1.6x for two
 * and a half seconds the leader simply ran away with it.
 */
export const STAR_BOOST = 1.45
export const STAR_BOOST_TIME = 1.8
export const STAR_INTERVAL = 2.6
export const MAX_LIVE_STARS = 7

/** Tornadoes: three a race, each on the track for three seconds. */
export const TORNADO_COUNT = 3
export const TORNADO_LIFETIME = 3
export const REVERSE_TIME = 2.2
/** How long the spin-out reads before they settle into running backwards. */
export const SPIN_TIME = 0.6

/**
 * Roughly one dinosaur's footprint. Generous on purpose — these are meant to be
 * hit, and a near miss reads to a child as a hit that did not count.
 */
const HIT_ARC = 0.66
const HIT_LANE = 0.62

/** Shortest signed distance between two lap fractions, in -0.5..0.5. */
export function lapDelta(a: number, b: number) {
  let delta = (a - b) % 1
  if (delta > 0.5) delta -= 1
  if (delta < -0.5) delta += 1
  return delta
}

export function hits(racerT: number, racerLane: number, pickup: Pickup, courseLength: number) {
  return Math.abs(lapDelta(racerT, pickup.t)) * courseLength < HIT_ARC
    && Math.abs(racerLane - pickup.lane) < HIT_LANE
}

/**
 * Places a pickup a short way in front of a reference racer.
 *
 * Callers put stars in front of the *trailing* racer and tornadoes in front of
 * the *leader*, so luck pushes the field together instead of apart. Spawning
 * both near the back punished whoever was already losing, which is exactly the
 * outcome the randomness is here to avoid.
 */
export function spawnAhead(id: number, kind: PickupKind, reference: number, elapsed: number): Pickup {
  const ahead = 0.02 + Math.random() * 0.12
  return {
    id,
    kind,
    t: (reference + ahead) % 1,
    lane: (Math.random() * 2 - 1) * 0.92,
    bornAt: elapsed,
    diesAt: kind === 'tornado' ? elapsed + TORNADO_LIFETIME : null,
    taken: false,
  }
}

/**
 * Three tornado times, packed early enough that all three still land even when a
 * fast field finishes the lap in well under twenty seconds.
 */
export function scheduleTornadoes(): number[] {
  return [0, 1, 2].map((index) => 2 + index * 3.4 + Math.random() * 1.8)
}
