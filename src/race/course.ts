import * as THREE from 'three'
import { isBiped, type DinosaurConfig } from '../game/dinosaurTypes'
import type { RaceDinosaurProfile, Terrain } from './raceTypes'

export type Point = [number, number, number]

/** Expands the full circuit while preserving the approved composition. */
export const WORLD_SCALE = 1.36
export const WORLD_LIFT = 1.04

export const COURSE_POINTS: Point[] = [
  [-17, .12, -2], [-15, .12, -8], [-8, .12, -11], [2, .12, -11.5],
  [12, .12, -9], [17, .12, -3], [16, .12, 4], [11, .12, 9],
  [3, .12, 11], [-5, .52, 10], [-12, .9, 7], [-16, .35, 3],
]

export const COURSE_CURVE = new THREE.CatmullRomCurve3(
  COURSE_POINTS.map((point) => new THREE.Vector3(...point)),
  true,
  'catmullrom',
  .34,
)

export const COURSE_SAMPLES = COURSE_CURVE.getSpacedPoints(180)
export const COURSE_LENGTH = COURSE_CURVE.getLength()

/** Half-width of the driveable ribbon; racers are kept inside this. */
export const ROAD_HALF_WIDTH = 1.46
/** Where the start gate straddles the circuit. */
export const START_T = .4

export const distanceToRoad = (x: number, z: number) => COURSE_SAMPLES.reduce((nearest, point) => {
  const distance = Math.hypot(point.x - x, point.z - z)
  return Math.min(nearest, distance)
}, Number.POSITIVE_INFINITY)

/**
 * Where each biome is centred on the field. Terrain under a racer is decided by
 * whichever of these is nearest, so the pace they get always matches the ground
 * being drawn beneath them.
 */
export const BIOME_CENTERS: Record<Terrain, [number, number]> = {
  Marsh: [-13.5, -3.6],
  Mountains: [-7.5, 8],
  Forest: [7.5, 8.2],
  Plains: [8.5, -8],
}

const BIOME_ENTRIES = Object.entries(BIOME_CENTERS) as [Terrain, [number, number]][]

export function terrainAt(x: number, z: number): Terrain {
  let best: Terrain = 'Plains'
  let bestDistance = Number.POSITIVE_INFINITY
  for (const [terrain, [cx, cz]] of BIOME_ENTRIES) {
    const distance = (x - cx) ** 2 + (z - cz) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = terrain
    }
  }
  return best
}

/** Position and heading on the circuit at lap fraction `t`, offset into a lane. */
export function courseFrame(t: number, lane: number) {
  const wrapped = ((t % 1) + 1) % 1
  const point = COURSE_CURVE.getPointAt(wrapped)
  const tangent = COURSE_CURVE.getTangentAt(wrapped).setY(0).normalize()
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
  return {
    position: point.clone().addScaledVector(side, lane),
    // The model faces +X, so align +X with the tangent rather than +Z.
    heading: Math.atan2(-tangent.z, tangent.x),
  }
}

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
