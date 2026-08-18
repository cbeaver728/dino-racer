import type { DinosaurConfig, SavedDinosaur } from '../game/dinosaurTypes'
import { toRaceProfile, type Course, type CourseSplit, type Route } from './course'
import { evaluateTerrain, staminaPace } from './raceSimulation'
import { STAR_BOOST } from './pickups'
import { BASE_SPEED, LAP_COUNT, TERRAIN_ORDER, type RaceDinosaurProfile, type Terrain } from './raceTypes'

export { BASE_SPEED, LAP_COUNT }

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
  /** How long the current spin lasts, which strength shortens. Drives the spin-out. */
  reverseSpan: number
  /** What the standings should show is happening to them right now. */
  effect: 'boost' | 'reverse' | null
  /** True for the dinosaur the player is steering, if any. */
  driven: boolean
  /** Which way they went at each fork; -1 until they reach one. */
  route: Route
  finishedAt: number | null
  place: number | null
}

export function createRacers(entries: SavedDinosaur[], course: Course, drivenId?: string | null): RacerState[] {
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
      reverseSpan: 0,
      effect: null,
      driven: entry.id === drivenId,
      route: course.splits.map(() => -1),
      finishedAt: null,
      place: null,
    }
  })
}

/**
 * Which way this racer goes at a fork.
 *
 * The player picks by steering: whichever side of the road they are on as they
 * reach the fork is the way they take, so the choice is made with their thumbs
 * and not from a menu. Everyone else reads their own terrain paces and takes
 * the ground that suits them, which is what makes a webbed-footed rival head
 * for the water while a clawed one climbs.
 */
function chooseBranch(racer: RacerState, split: CourseSplit) {
  if (racer.driven) return racer.lane > 0 ? 1 : 0
  const left = racer.paces[split.terrains[0]]
  const right = racer.paces[split.terrains[1]]
  if (left === right) return racer.seed % 2 < 1 ? 0 : 1
  return right > left ? 1 : 0
}

/** How far ahead a computer racer looks for lava, in world units. */
const LAVA_LOOKAHEAD = 4.6
/** Lane units per second it edges aside to miss a pool. */
const LAVA_DODGE = 6.5
/** Room a racer wants beside a pool before it stops correcting. */
const LAVA_MARGIN = 0.45
const LANE_LIMIT = 1.05

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
  const lapT = ((t % 1) + 1) % 1

  /*
   * Lock in a way round on arrival at each fork, and forget it once past, so
   * the second lap is a fresh choice. Latching matters for the player: without
   * it, steering across the road halfway down a branch would teleport them onto
   * the other one.
   */
  for (const split of course.splits) {
    const inside = lapT >= split.from && lapT < split.to
    if (!inside) racer.route[split.index] = -1
    else if (racer.route[split.index] < 0) racer.route[split.index] = chooseBranch(racer, split)
  }

  racer.terrain = course.terrainOn(lapT, racer.route)

  /*
   * Computer racers pick their way around lava.
   *
   * Both the trigger and the target are the same measurement — how much room a
   * lane leaves along the whole run in. Triggering on a single point ahead did
   * not work: the moment a racer edged far enough to clear that one point it
   * stopped correcting, and a pool is a circle, so a hair outside where you
   * looked is inside it by the time you arrive. Steering until they actually
   * have room keeps them out of it.
   */
  const nearLava = course.lavaSpan !== null
    && lapT >= course.lavaSpan.from && lapT <= course.lavaSpan.to
  if (!racer.driven && nearLava) {
    const roomOn = (lane: number) => {
      let room = Infinity
      for (const reach of [0.4, 0.7, 1]) {
        const probe = course.frameAt(t + (LAVA_LOOKAHEAD * reach) / course.length, lane, racer.route).position
        room = Math.min(room, course.clearanceAt(probe.x, probe.z))
      }
      return room
    }

    if (roomOn(racer.lane) < LAVA_MARGIN) {
      let target = racer.lane
      let best = -Infinity
      for (let lane = -LANE_LIMIT; lane <= LANE_LIMIT + 1e-6; lane += 0.25) {
        // Room past the margin is no better than the margin, so a racer takes
        // the closest good line rather than hugging the far verge.
        const score = Math.min(roomOn(lane), LAVA_MARGIN) - Math.abs(lane - racer.lane) * 0.25
        if (score > best) { best = score; target = lane }
      }
      const gap = target - racer.lane
      if (Math.abs(gap) > 1e-4) {
        const step = Math.sign(gap) * LAVA_DODGE * delta
        const moved = Math.abs(step) > Math.abs(gap) ? target : racer.lane + step
        racer.lane = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, moved))
      }
    }
  }

  // A slow surge unique to each racer so the field trades places on the way
  // round instead of settling into a fixed order in the first second.
  const surge = 1 + Math.sin(elapsed * 1.3 + racer.seed * 7) * 0.05
  const boost = elapsed < racer.boostUntil ? STAR_BOOST : 1
  // Tiring is measured against the whole race, so the sprinter who led lap one
  // is visibly coming back to the field on lap two.
  const fade = staminaPace(racer.profile.stamina, racer.progress / LAP_COUNT)
  // Wading through a lava pool costs a chunk of pace for as long as they are in it.
  const here = course.frameAt(t, racer.lane, racer.route).position
  const molten = course.paceAt(here.x, here.z)
  racer.speed = BASE_SPEED * racer.paces[racer.terrain] * surge * boost * fade * molten

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
