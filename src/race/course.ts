import * as THREE from 'three'
import { isBiped, type DinosaurConfig } from '../game/dinosaurTypes'
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
}

export interface Course {
  def: CourseDefinition
  curve: THREE.CatmullRomCurve3
  samples: THREE.Vector3[]
  length: number
  startT: number
  /** Share of the lap spent in each terrain, measured off the built curve. */
  mix: { terrain: Terrain; share: number }[]
  terrainAt(x: number, z: number): Terrain
  frameAt(t: number, lane: number): { position: THREE.Vector3; heading: number }
  distanceToRoad(x: number, z: number): number
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

  const frameAt = (t: number, lane: number) => {
    const wrapped = ((t % 1) + 1) % 1
    const point = curve.getPointAt(wrapped)
    const tangent = curve.getTangentAt(wrapped).setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    return {
      position: point.clone().addScaledVector(side, lane),
      // The model faces +X, so align +X with the tangent rather than +Z.
      heading: Math.atan2(-tangent.z, tangent.x),
    }
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

  return { def, curve, samples, length, startT: def.startT, mix, terrainAt, frameAt, distanceToRoad }
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

export const COURSE_DEFS = [WILD_CIRCUIT, FIGURE_EIGHT]
export const COURSES = COURSE_DEFS.map(buildCourse)
export const defaultCourse = COURSES[0]
export const courseById = (id: string) => COURSES.find((course) => course.def.id === id) ?? defaultCourse

/** The racing traits the simulation reads out of a built dinosaur. */
export function toRaceProfile(config: DinosaurConfig): RaceDinosaurProfile {
  return {
    size: config.body,
    legLength: config.hindLegs,
    footType: config.feet,
    tailType: config.tail,
    stance: isBiped(config) ? 'Biped' : 'Quadruped',
    hasWings: config.feature === 'Wings',
  }
}
