import * as THREE from 'three'
import { isBiped, type DinosaurConfig } from '../game/dinosaurTypes'
import { calculateStats } from '../game/calculateStats'
import { TERRAIN_ORDER, type RaceDinosaurProfile, type Terrain } from './raceTypes'

export type Point = [number, number, number]

/** Shared by every course so the props and racers keep one sense of scale. */
export const WORLD_SCALE = 1.36
export const WORLD_LIFT = 1.04
/** Half-width of the driveable ribbon; racers are kept inside this. */
export const ROAD_HALF_WIDTH = 1.46

export interface BiomeLayout {
  /** Centre of the ground patch, and the point terrain is measured from. */
  center: [number, number]
  /** Ellipse radii of the painted ground. */
  patch: [number, number]
  /** Half-extent the scenery scatters over. */
  spread: [number, number]
  /** Mountain peaks, which need placing by hand to stay clear of the road. */
  peaks?: [number, number, number][]
}

/**
 * A stretch where the road divides in two and joins back up.
 *
 * The pair are always the same length as each other and as the stretch of the
 * main curve they replace, so which way a racer goes never changes how far they
 * have to run — only what they run over. That is the whole point of the choice:
 * a webbed-footed dinosaur wants the water, a clawed one wants the rock.
 */
export interface SplitDefinition {
  /** Lap fractions on the main curve where the road parts and rejoins. */
  from: number
  to: number
  /** Terrain each way runs through. Declared, not inferred from position. */
  left: Terrain
  right: Terrain
  /** Shown on the course card. */
  label: string
}

/**
 * A pool of lava, placed on the road rather than in the world: a lap fraction
 * and how far off the centre line it sits. Authoring it against the track means
 * a pool cannot drift off the road when the course shape is tweaked.
 */
export interface LavaDefinition {
  t: number
  lane: number
  radius: number
  /** Which way round the split it lies on, when it lies inside one. */
  branch?: 0 | 1
}

/** A lava pool resolved to where it actually sits in the world. */
export interface Hazard {
  x: number
  z: number
  radius: number
}

export interface CourseDefinition {
  id: string
  name: string
  blurb: string
  icon: string
  points: Point[]
  tension: number
  /** Where the start gate straddles the circuit. */
  startT: number
  biomes: Record<Terrain, BiomeLayout>
  /**
   * Height above which the road is a bridge rather than a hill, so supports get
   * built under it. Left undefined on courses that only roll over high ground.
   */
  bridgeMinY?: number
  splits?: SplitDefinition[]
  lava?: LavaDefinition[]
  /** Volcano cone, for the island. */
  volcano?: { x: number; z: number; scale: number }
}

/** A built fork: index 0 follows the main curve, index 1 the branch built for it. */
export interface CourseSplit {
  index: number
  from: number
  to: number
  label: string
  terrains: [Terrain, Terrain]
  /** The alternative way round. Index 0 is the main curve itself. */
  branch: THREE.Curve<THREE.Vector3>
  /** Sampled points of the branch, for drawing its road and scattering props. */
  samples: THREE.Vector3[]
}

/** How much of its pace a racer keeps while standing in lava. */
export const LAVA_PACE = 0.55

/** Which way a racer went at each split. 0 is the main curve, 1 the branch. */
export type Route = number[]

export interface Course {
  def: CourseDefinition
  curve: THREE.CatmullRomCurve3
  samples: THREE.Vector3[]
  length: number
  startT: number
  /** Share of the lap spent in each terrain, measured off the built curve. */
  mix: { terrain: Terrain; share: number }[]
  splits: CourseSplit[]
  lava: Hazard[]
  terrainAt(x: number, z: number): Terrain
  /** The split covering this lap fraction, if the road is divided there. */
  splitAt(t: number): CourseSplit | null
  /** Terrain at this point of the lap, honouring which way the racer went. */
  terrainOn(t: number, route?: Route): Terrain
  frameAt(t: number, lane: number, route?: Route): { position: THREE.Vector3; heading: number }
  /** 1 in the clear, less inside a lava pool. */
  paceAt(x: number, z: number): number
  /** Distance to the edge of the nearest pool; negative inside one. */
  clearanceAt(x: number, z: number): number
  /** Lap fractions between which lava can be met, so racers only look there. */
  lavaSpan: { from: number; to: number } | null
  distanceToRoad(x: number, z: number): number
}

/**
 * The alternative way round a split: a bezier leaving and rejoining the main
 * curve along its own tangents, bowed out to the opposite side from it by `bow`.
 */
function bowedBranch(curve: THREE.CatmullRomCurve3, from: number, to: number, bow: number) {
  const p0 = curve.getPointAt(from)
  const p1 = curve.getPointAt(to)
  const t0 = curve.getTangentAt(from).setY(0).normalize()
  const t1 = curve.getTangentAt(to).setY(0).normalize()

  const chord = new THREE.Vector3().subVectors(p1, p0)
  const span = chord.length()
  const side = new THREE.Vector3(-chord.z, 0, chord.x).normalize()

  // Whichever way the main stretch leans, this one leans the other, so the two
  // ways round are on opposite sides of the road rather than on top of it.
  const middle = curve.getPointAt((from + to) / 2)
  const chordMiddle = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5)
  const away = new THREE.Vector3().subVectors(middle, chordMiddle).dot(side) >= 0 ? -1 : 1

  const reach = span * 0.28
  return new THREE.CubicBezierCurve3(
    p0,
    p0.clone().addScaledVector(t0, reach).addScaledVector(side, away * bow),
    p1.clone().addScaledVector(t1, -reach).addScaledVector(side, away * bow),
    p1,
  )
}

/**
 * Solves the bow that makes the branch exactly as long as the stretch of main
 * curve it runs beside.
 *
 * Bowing further out is monotonically longer, so a bisection lands it. Matching
 * the length is what lets the rest of the game carry on treating progress as a
 * single lap fraction: both ways cover the same ground in the same parameter
 * range, so nothing downstream needs to know a choice was ever made.
 */
function matchedBranch(curve: THREE.CatmullRomCurve3, length: number, from: number, to: number) {
  const target = (to - from) * length
  let low = 0
  let high = 30
  for (let step = 0; step < 44; step++) {
    const bow = (low + high) / 2
    if (bowedBranch(curve, from, to, bow).getLength() < target) low = bow
    else high = bow
  }
  return bowedBranch(curve, from, to, (low + high) / 2)
}

export function buildCourse(def: CourseDefinition): Course {
  const curve = new THREE.CatmullRomCurve3(
    def.points.map((point) => new THREE.Vector3(...point)),
    true,
    'catmullrom',
    def.tension,
  )
  const samples = curve.getSpacedPoints(180)
  const length = curve.getLength()

  const entries = TERRAIN_ORDER.map((terrain) => [terrain, def.biomes[terrain].center] as const)

  const terrainAt = (x: number, z: number): Terrain => {
    let best: Terrain = entries[0][0]
    let bestDistance = Number.POSITIVE_INFINITY
    for (const [terrain, [cx, cz]] of entries) {
      const distance = (x - cx) ** 2 + (z - cz) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = terrain
      }
    }
    return best
  }

  const distanceToRoad = (x: number, z: number) => samples.reduce((nearest, point) => (
    Math.min(nearest, Math.hypot(point.x - x, point.z - z))
  ), Number.POSITIVE_INFINITY)

  const splits: CourseSplit[] = (def.splits ?? []).map((split, index) => {
    const branch = matchedBranch(curve, length, split.from, split.to)
    return {
      index,
      from: split.from,
      to: split.to,
      label: split.label,
      terrains: [split.left, split.right] as [Terrain, Terrain],
      branch,
      samples: branch.getSpacedPoints(48),
    }
  })

  const splitAt = (t: number) => {
    const wrapped = ((t % 1) + 1) % 1
    for (const split of splits) {
      if (wrapped >= split.from && wrapped < split.to) return split
    }
    return null
  }

  const terrainOn = (t: number, route?: Route) => {
    const split = splitAt(t)
    if (split) return split.terrains[route?.[split.index] === 1 ? 1 : 0]
    const wrapped = ((t % 1) + 1) % 1
    const point = curve.getPointAt(wrapped)
    return terrainAt(point.x, point.z)
  }

  const frameAt = (t: number, lane: number, route?: Route) => {
    const wrapped = ((t % 1) + 1) % 1
    const split = splitAt(wrapped)
    // Both ways round are the same length, so the same lap fraction maps
    // straight onto the branch's own arc length with nothing to rescale.
    const taken = split && route?.[split.index] === 1
      ? { curve: split.branch, at: (wrapped - split.from) / (split.to - split.from) }
      : { curve, at: wrapped }

    const point = taken.curve.getPointAt(taken.at)
    const tangent = taken.curve.getTangentAt(taken.at).clone().setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    return {
      position: point.clone().addScaledVector(side, lane),
      // The model faces +X, so align +X with the tangent rather than +Z.
      heading: Math.atan2(-tangent.z, tangent.x),
    }
  }

  // Resolved once against the road they were authored on, so a pool sits where
  // it was placed however the course shape is tweaked around it.
  const lava: Hazard[] = (def.lava ?? []).map((pool) => {
    const onBranch = pool.branch === 1
    const route = onBranch ? splits.map((split) => (split === splitAt(pool.t) ? 1 : 0)) : undefined
    const spot = frameAt(pool.t, pool.lane, route).position
    return { x: spot.x, z: spot.z, radius: pool.radius }
  })

  const paceAt = (x: number, z: number) => {
    for (const pool of lava) {
      if ((x - pool.x) ** 2 + (z - pool.z) ** 2 < pool.radius ** 2) return LAVA_PACE
    }
    return 1
  }

  // The stretch lava lives on, with room either side for the run in and out.
  // Everywhere else the racers can skip looking for it entirely.
  const lavaTs = (def.lava ?? []).map((pool) => pool.t)
  const lavaSpan = lavaTs.length
    ? { from: Math.min(...lavaTs) - .06, to: Math.max(...lavaTs) + .04 }
    : null

  const clearanceAt = (x: number, z: number) => {
    let nearest = Number.POSITIVE_INFINITY
    for (const pool of lava) {
      nearest = Math.min(nearest, Math.hypot(x - pool.x, z - pool.z) - pool.radius)
    }
    return nearest
  }

  // Measured rather than declared, so the course card always matches the track.
  const counts = {} as Record<Terrain, number>
  for (const terrain of TERRAIN_ORDER) counts[terrain] = 0
  const STEPS = 240
  for (let step = 0; step < STEPS; step++) {
    const point = curve.getPointAt(step / STEPS)
    counts[terrainAt(point.x, point.z)] += 1
  }
  const mix = TERRAIN_ORDER
    .map((terrain) => ({ terrain, share: Math.round((counts[terrain] / STEPS) * 100) }))
    .filter((entry) => entry.share > 0)
    .sort((a, b) => b.share - a.share)

  return {
    def, curve, samples, length, startT: def.startT, mix, splits, lava,
    terrainAt, splitAt, terrainOn, frameAt, paceAt, clearanceAt, lavaSpan, distanceToRoad,
  }
}

const WILD_CIRCUIT: CourseDefinition = {
  id: 'circuit',
  name: 'The Wild Circuit',
  blurb: 'One long loop through four wild biomes, a quarter of the lap each.',
  icon: '🏞️',
  tension: .34,
  startT: .4,
  points: [
    [-17, .12, -2], [-15, .12, -8], [-8, .12, -11], [2, .12, -11.5],
    [12, .12, -9], [17, .12, -3], [16, .12, 4], [11, .12, 9],
    [3, .12, 11], [-5, .52, 10], [-12, .9, 7], [-16, .35, 3],
  ],
  biomes: {
    Marsh: { center: [-13.5, -3.6], patch: [7.4, 6.7], spread: [6, 5.5] },
    Mountains: {
      center: [-7.5, 8.8], patch: [9.4, 7.4], spread: [6.5, 4.5],
      peaks: [[-7.5, 15.2, 1.4], [-17.8, 12.5, 1.05]],
    },
    Forest: { center: [7.5, 8.2], patch: [10.1, 6.4], spread: [8.5, 5] },
    Plains: { center: [8.5, -8], patch: [13.4, 7], spread: [11, 5.5] },
  },
}

/**
 * A crossed figure eight. The two lobes run in opposite directions, and the
 * second pass over the middle rides a bridge so the paths never meet on the
 * ground. Terrain is deliberately lopsided here: forest takes the whole outer
 * right lobe while plains own the crossing, which races very differently from
 * the even quarters of the Wild Circuit.
 */
const FIGURE_EIGHT: CourseDefinition = {
  id: 'figure8',
  name: 'The Twisted Eight',
  blurb: 'Two lobes that cross in the middle, with a bridge over the tangle.',
  icon: '🎀',
  tension: .3,
  startT: .28,
  bridgeMinY: .7,
  points: [
    [0, .12, 0],
    [6, .12, -5.5], [13, .12, -7.5], [18.5, .12, -3.5],
    [18.5, .12, 3.5], [13, .12, 7.5], [6, .35, 5.5],
    [3, 1.15, 2.7], [0, 1.75, 0], [-3, 1.15, -2.7],
    [-6, .35, -5.5], [-13, .12, -7.5], [-18.5, .12, -3.5],
    [-18.5, .12, 3.5], [-13, .12, 7.5], [-6, .12, 5.5],
  ],
  biomes: {
    Forest: { center: [13.5, 0], patch: [8, 9], spread: [6.5, 7] },
    Plains: { center: [0, 0], patch: [6.5, 5.2], spread: [5.5, 4] },
    Marsh: { center: [-13, -6.5], patch: [8, 6], spread: [7, 4] },
    Mountains: {
      center: [-13, 6.5], patch: [8, 7], spread: [7, 4.5],
      peaks: [[-13, 13.5, 1.4], [-19.5, 10, 1.05]],
    },
  },
}

/**
 * A tropical island lap around a live volcano, and the only course where the
 * road forks. Three times a lap it splits in two and joins back up, and the two
 * ways round are always the same length — the only thing that differs is what
 * is underfoot. A webbed-footed dinosaur wants the lagoon; a clawed one wants
 * the rock. The volcano fork is the quick way round for a sure-footed build and
 * the most punishing for anyone who cannot dodge, because its lava pools sit on
 * the racing line.
 */
const VOLCANO_ISLAND: CourseDefinition = {
  id: 'island',
  name: 'Smoking Isle',
  blurb: 'A longer island lap that forks three times. Same distance either way — pick the ground that suits your dinosaur.',
  icon: '🌋',
  tension: .32,
  startT: .04,
  points: [
    [-20, .12, -2], [-18.5, .12, -8], [-13, .12, -12.5], [-6, .12, -14.5],
    [2, .12, -14.5], [9, .12, -13], [15, .12, -9.5], [19, .12, -4],
    [20, .12, 2], [18, .12, 8], [13, .12, 12], [6, .12, 14],
    [-2, .12, 14], [-9, .12, 12.5], [-15, .12, 9], [-19, .12, 4],
  ],
  splits: [
    { from: .17, to: .31, left: 'Forest', right: 'Marsh', label: 'Jungle or lagoon' },
    { from: .43, to: .57, left: 'Mountains', right: 'Plains', label: 'Volcano or beach' },
    { from: .69, to: .83, left: 'Marsh', right: 'Forest', label: 'Mangrove or palms' },
  ],
  /*
   * Staggered left and right along the volcano fork, so there is always a way
   * past but never a straight one. Anyone who cannot steer pays for taking the
   * quick road.
   */
  /*
   * Two pools down the left of the road, then two down the right, so the clear
   * line is one long sweep across rather than a zigzag. Staggering them left and
   * right and left again looked more dangerous but read as noise: there was a
   * way past every pool and no way to see it coming, which punished the
   * attentive as much as the careless.
   */
  lava: [
    { t: .452, lane: -.62, radius: .8 },
    { t: .482, lane: -.62, radius: .8 },
    { t: .532, lane: .62, radius: .8 },
    { t: .562, lane: .62, radius: .8 },
  ],
  volcano: { x: 13, z: 1, scale: 1.5 },
  biomes: {
    Forest: { center: [-1, -8], patch: [11, 6.5], spread: [9, 5] },
    Mountains: { center: [13, 1], patch: [8.5, 8], spread: [5.5, 5.5] },
    Marsh: { center: [-13, 4], patch: [7.5, 7], spread: [5.5, 5] },
    Plains: { center: [1, 17], patch: [13, 6], spread: [11, 4.5] },
  },
}

export const COURSE_DEFS = [WILD_CIRCUIT, FIGURE_EIGHT, VOLCANO_ISLAND]
export const COURSES = COURSE_DEFS.map(buildCourse)
export const defaultCourse = COURSES[0]
export const courseById = (id: string) => COURSES.find((course) => course.def.id === id) ?? defaultCourse

/**
 * The racing traits the simulation reads out of a built dinosaur. Strength and
 * stamina come from the same `calculateStats` the builder's panel shows, so the
 * bars a child fills in are the numbers the race actually runs on.
 */
export function toRaceProfile(config: DinosaurConfig): RaceDinosaurProfile {
  const stats = calculateStats(config)
  return {
    head: config.head,
    size: config.body,
    legLength: config.hindLegs,
    footType: config.feet,
    tailType: config.tail,
    stance: isBiped(config) ? 'Biped' : 'Quadruped',
    hasWings: config.feature === 'Wings',
    strength: stats.strength,
    stamina: stats.stamina,
  }
}
