export type PickupKind = 'star' | 'tornado'

export interface Pickup {
  /** Which way round each fork it sits on, on a course that forks. */
  route?: number[]
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

/** Tornadoes per lap, each on the track for three seconds. */
export const TORNADO_PER_LAP = 3
export const TORNADO_LIFETIME = 3
export const REVERSE_TIME = 2.2
/** How long the spin-out reads before they settle into running backwards. */
export const SPIN_TIME = 0.6

/**
 * How long a tornado holds this dinosaur, given its strength.
 *
 * Strength had no effect on a race at all until now. Shrugging off a tornado is
 * the most visible thing it could do: a strong dinosaur is back on its feet in
 * half the time a weak one takes, and a child can watch that happen.
 */
export function reverseTimeFor(strength: number) {
  const power = (Math.max(1, Math.min(5, strength)) - 1) / 4
  return REVERSE_TIME * (1 - power * 0.5)
}

/**
 * Roughly one dinosaur's footprint. Generous on purpose — these are meant to be
 * hit, and a near miss reads to a child as a hit that did not count.
 */
const HIT_ARC = 0.66
const HIT_LANE = 0.62
/**
 * The tornado box used for whoever is steering.
 *
 * Generosity helps a dinosaur the computer drives into a hazard it was never
 * aiming for, but it punishes a player who made a real dodge. Stars keep the
 * wide box — easy to collect, harder to crash into, the same bargain Star Dash
 * already makes.
 */
const PLAYER_HIT_LANE = 0.44

/** Shortest signed distance between two lap fractions, in -0.5..0.5. */
export function lapDelta(a: number, b: number) {
  let delta = (a - b) % 1
  if (delta > 0.5) delta -= 1
  if (delta < -0.5) delta += 1
  return delta
}

export function hits(racerT: number, racerLane: number, pickup: Pickup, courseLength: number, driven = false) {
  const lane = driven && pickup.kind === 'tornado' ? PLAYER_HIT_LANE : HIT_LANE
  return Math.abs(lapDelta(racerT, pickup.t)) * courseLength < HIT_ARC
    && Math.abs(racerLane - pickup.lane) < lane
}

/**
 * Places a pickup a short way in front of a reference racer.
 *
 * Callers put stars in front of the *trailing* racer and tornadoes in front of
 * the *leader*, so luck pushes the field together instead of apart. Spawning
 * both near the back punished whoever was already losing, which is exactly the
 * outcome the randomness is here to avoid.
 */
export function spawnAhead(id: number, kind: PickupKind, reference: number, elapsed: number, route?: number[]): Pickup {
  const ahead = 0.02 + Math.random() * 0.12
  return {
    id,
    kind,
    t: (reference + ahead) % 1,
    lane: (Math.random() * 2 - 1) * 0.92,
    bornAt: elapsed,
    diesAt: kind === 'tornado' ? elapsed + TORNADO_LIFETIME : null,
    route: route ? [...route] : undefined,
    taken: false,
  }
}

/**
 * When each tornado arrives, spread across the race the field is actually about
 * to run. Taking the expected duration as an argument keeps them coming for the
 * whole race instead of bunching into the first lap the moment lap count or pace
 * changes — the last one lands with about a fifth of the race still to go, so
 * there is always time to recover from it.
 */
export function scheduleTornadoes(count: number, expectedDuration: number): number[] {
  const window = expectedDuration * 0.8
  const step = window / (count + 1)
  return Array.from({ length: count }, (_, index) => (
    1.5 + step * (index + 1) + (Math.random() - 0.5) * step * 0.5
  ))
}

/**
 * Whether a pickup and a racer are on the same side of a fork.
 *
 * Without this a star sitting on the jungle branch could be collected by a
 * dinosaur running the lagoon branch, because a pickup is placed by lap
 * fraction and lane and both ways round share those.
 */
export function sameBranch(splitIndex: number | null, pickupRoute: number[] | undefined, racerRoute: number[]) {
  if (splitIndex === null || !pickupRoute) return true
  return (pickupRoute[splitIndex] === 1) === (racerRoute[splitIndex] === 1)
}
