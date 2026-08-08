import type { DinosaurConfig, SavedDinosaur } from '../game/dinosaurTypes'
import { toRaceProfile, type Course } from './course'
import { evaluateTerrain } from './raceSimulation'
import { STAR_BOOST } from './pickups'
import { TERRAIN_ORDER, type RaceDinosaurProfile, type Terrain } from './raceTypes'

/** One lap of the circuit. Long enough to feel like a race, short enough to watch. */
export const LAP_COUNT = 1
/** Local units per second at neutral pace; a lap lands around twenty seconds. */
export const BASE_SPEED = 5
/** Most dinosaurs that fit across the road without overlapping. */
export const MAX_RACERS = 6
/** How far from the centre line the outermost lanes sit. */
const LANE_SPREAD = 1

export interface RacerState {
  id: string
  name: string
  config: DinosaurConfig
  profile: RaceDinosaurProfile
  /** Pace multiplier per terrain, resolved once so no work happens per frame. */
  paces: Record<Terrain, number>
  lane: number
  seed: number
  /** Laps completed, 0 to LAP_COUNT. */
  progress: number
  speed: number
  terrain: Terrain
  /** Elapsed time a star boost runs until. */
  boostUntil: number
  /** Elapsed time this racer keeps running backwards until, after a tornado. */
  reverseUntil: number
  /** What the standings should show is happening to them right now. */
  effect: 'boost' | 'reverse' | null
  finishedAt: number | null
  place: number | null
}

export function createRacers(entries: SavedDinosaur[], course: Course): RacerState[] {
  const count = Math.min(entries.length, MAX_RACERS)
  return entries.slice(0, count).map((entry, index) => {
    const profile = toRaceProfile(entry.config)
    const paces = {} as Record<Terrain, number>
    for (const terrain of TERRAIN_ORDER) paces[terrain] = evaluateTerrain(profile, terrain).pace

    const start = course.curve.getPointAt(course.startT)
    return {
      id: entry.id,
      name: entry.config.name,
      config: entry.config,
      profile,
      paces,
      // Spread evenly across the road so the grid lines up without overlap.
      lane: count === 1 ? 0 : ((index + 0.5) / count - 0.5) * 2 * LANE_SPREAD,
      seed: index * 2.399963,
      progress: 0,
      speed: 0,
      terrain: course.terrainAt(start.x, start.z),
      boostUntil: 0,
      reverseUntil: 0,
      effect: null,
      finishedAt: null,
      place: null,
    }
  })
}

/**
 * Advances one racer. Terrain is sampled from where the racer actually is, so
 * the pace bonus always matches the ground being drawn under them.
 */
export function stepRacer(racer: RacerState, delta: number, elapsed: number, course: Course) {
  if (racer.finishedAt !== null) {
    racer.speed = 0
    racer.effect = null
    return
  }

  racer.effect = elapsed < racer.reverseUntil ? 'reverse'
    : elapsed < racer.boostUntil ? 'boost'
      : null

  const t = course.startT + racer.progress
  const point = course.curve.getPointAt(((t % 1) + 1) % 1)
  racer.terrain = course.terrainAt(point.x, point.z)

  // A slow surge unique to each racer so the field trades places on the way
  // round instead of settling into a fixed order in the first second.
  const surge = 1 + Math.sin(elapsed * 1.3 + racer.seed * 7) * 0.05
  const boost = elapsed < racer.boostUntil ? STAR_BOOST : 1
  racer.speed = BASE_SPEED * racer.paces[racer.terrain] * surge * boost

  // A tornado sends them back down the track; never past the start line, so the
  // standings cannot read as a negative lap.
  const direction = elapsed < racer.reverseUntil ? -1 : 1
  racer.progress = Math.max(0, racer.progress + (racer.speed * direction * delta) / course.length)
}

/** Leader first; finishers are ranked by their finishing order. */
export function standingsOf(racers: RacerState[]): RacerState[] {
  return [...racers].sort((a, b) => {
    if (a.place !== null && b.place !== null) return a.place - b.place
    if (a.place !== null) return -1
    if (b.place !== null) return 1
    return b.progress - a.progress
  })
}

export const PLACE_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th']
export const PLACE_MEDAL = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣']
