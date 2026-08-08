import type { HeadType } from '../game/dinosaurTypes'
import type { BodyDims, SweptProfile } from './dinoGeometry'

/**
 * Skull shapes, swept back-of-head (u = -1) to snout tip (u = +1).
 *
 * Each head used to be one scaled sphere plus a flattened sphere for a muzzle,
 * which made every dinosaur bulbous and gave the carnivores a duck bill. A
 * profile per family gives the raptor a narrow tapering snout, the T-Rex a deep
 * heavy jaw, and the triceratops a beak.
 */
export interface HeadShape {
  skull: SweptProfile
  /** Lower jaw, swept the same way and hung under the skull. */
  jaw: SweptProfile
  dims: BodyDims
  jawDims: BodyDims
  jawDrop: number
  /** Where along the jaw the teeth sit, in local units. */
  toothRow: { from: number; spread: number; count: number; size: number } | null
  nostril: { x: number; y: number; spread: number }
  eye: { x: number; y: number; depth: number; size: number }
}

const HEADS: Record<HeadType, HeadShape> = {
  Raptor: {
    skull: {
      height: [0.5, 0.92, 1.0, 0.9, 0.78, 0.68, 0.6, 0.52, 0.42, 0.24],
      width: [0.56, 0.94, 1.0, 0.88, 0.74, 0.62, 0.54, 0.46, 0.36, 0.2],
      rise: [0.06, 0.02, 0.0, -0.02, -0.05, -0.08, -0.11, -0.14, -0.17, -0.2],
    },
    jaw: {
      height: [0.3, 0.55, 0.6, 0.56, 0.5, 0.44, 0.38, 0.32, 0.24, 0.12],
      width: [0.4, 0.8, 0.86, 0.78, 0.68, 0.58, 0.5, 0.42, 0.32, 0.18],
      rise: [0.0, 0.0, -0.02, -0.05, -0.08, -0.12, -0.16, -0.2, -0.24, -0.28],
    },
    dims: { halfLength: 0.72, halfHeight: 0.34, halfWidth: 0.3 },
    jawDims: { halfLength: 0.68, halfHeight: 0.34, halfWidth: 0.28 },
    jawDrop: -0.2,
    toothRow: { from: 0.1, spread: 0.2, count: 4, size: 0.075 },
    nostril: { x: 0.6, y: 0.02, spread: 0.09 },
    eye: { x: -0.16, y: 0.14, depth: 0.27, size: 0.14 },
  },

  'T-Rex': {
    skull: {
      height: [0.6, 1.0, 1.06, 1.0, 0.95, 0.9, 0.86, 0.8, 0.7, 0.48],
      width: [0.62, 0.98, 1.0, 0.93, 0.86, 0.8, 0.75, 0.7, 0.6, 0.4],
      rise: [0.08, 0.03, 0.0, -0.02, -0.04, -0.06, -0.08, -0.11, -0.14, -0.18],
    },
    jaw: {
      height: [0.34, 0.62, 0.68, 0.66, 0.62, 0.58, 0.54, 0.48, 0.38, 0.2],
      width: [0.45, 0.86, 0.92, 0.86, 0.8, 0.74, 0.68, 0.6, 0.48, 0.26],
      rise: [0.0, -0.01, -0.03, -0.06, -0.09, -0.12, -0.15, -0.18, -0.22, -0.26],
    },
    dims: { halfLength: 0.86, halfHeight: 0.44, halfWidth: 0.38 },
    jawDims: { halfLength: 0.82, halfHeight: 0.44, halfWidth: 0.36 },
    jawDrop: -0.24,
    toothRow: { from: 0.16, spread: 0.27, count: 5, size: 0.1 },
    nostril: { x: 0.7, y: 0.04, spread: 0.12 },
    eye: { x: -0.2, y: 0.2, depth: 0.34, size: 0.16 },
  },

  Triceratops: {
    skull: {
      height: [0.68, 1.0, 1.0, 0.9, 0.78, 0.68, 0.6, 0.52, 0.42, 0.26],
      width: [0.78, 1.0, 0.95, 0.84, 0.72, 0.6, 0.5, 0.4, 0.3, 0.16],
      rise: [0.0, 0.0, -0.02, -0.06, -0.1, -0.15, -0.2, -0.25, -0.3, -0.36],
    },
    jaw: {
      height: [0.3, 0.5, 0.54, 0.5, 0.44, 0.38, 0.32, 0.26, 0.2, 0.1],
      width: [0.4, 0.72, 0.76, 0.68, 0.58, 0.48, 0.4, 0.32, 0.24, 0.12],
      rise: [0.0, -0.02, -0.05, -0.09, -0.14, -0.19, -0.24, -0.29, -0.34, -0.4],
    },
    dims: { halfLength: 0.74, halfHeight: 0.4, halfWidth: 0.36 },
    jawDims: { halfLength: 0.7, halfHeight: 0.4, halfWidth: 0.34 },
    jawDrop: -0.16,
    toothRow: null,
    nostril: { x: 0.5, y: -0.1, spread: 0.1 },
    eye: { x: -0.12, y: 0.16, depth: 0.34, size: 0.14 },
  },

  Brachiosaurus: {
    skull: {
      height: [0.5, 0.88, 1.0, 0.98, 0.9, 0.82, 0.74, 0.66, 0.54, 0.32],
      width: [0.56, 0.9, 1.0, 0.95, 0.87, 0.79, 0.71, 0.62, 0.5, 0.3],
      rise: [0.06, 0.04, 0.0, -0.03, -0.06, -0.08, -0.1, -0.12, -0.14, -0.16],
    },
    jaw: {
      height: [0.28, 0.5, 0.56, 0.54, 0.5, 0.46, 0.4, 0.34, 0.26, 0.14],
      width: [0.38, 0.72, 0.8, 0.76, 0.7, 0.64, 0.56, 0.48, 0.36, 0.2],
      rise: [0.0, -0.01, -0.03, -0.05, -0.08, -0.1, -0.13, -0.16, -0.19, -0.22],
    },
    dims: { halfLength: 0.56, halfHeight: 0.3, halfWidth: 0.27 },
    jawDims: { halfLength: 0.53, halfHeight: 0.3, halfWidth: 0.25 },
    jawDrop: -0.15,
    toothRow: null,
    nostril: { x: 0.34, y: 0.16, spread: 0.09 },
    eye: { x: -0.1, y: 0.12, depth: 0.25, size: 0.13 },
  },

  Parasaurolophus: {
    skull: {
      height: [0.56, 0.94, 1.0, 0.9, 0.8, 0.72, 0.66, 0.62, 0.56, 0.4],
      width: [0.6, 0.94, 1.0, 0.9, 0.8, 0.73, 0.68, 0.65, 0.6, 0.42],
      rise: [0.06, 0.02, 0.0, -0.03, -0.07, -0.11, -0.15, -0.19, -0.23, -0.28],
    },
    jaw: {
      height: [0.3, 0.52, 0.58, 0.54, 0.48, 0.44, 0.4, 0.38, 0.34, 0.22],
      width: [0.4, 0.76, 0.84, 0.78, 0.7, 0.65, 0.62, 0.6, 0.56, 0.38],
      rise: [0.0, -0.02, -0.04, -0.08, -0.12, -0.16, -0.2, -0.24, -0.28, -0.33],
    },
    dims: { halfLength: 0.8, halfHeight: 0.34, halfWidth: 0.3 },
    jawDims: { halfLength: 0.76, halfHeight: 0.34, halfWidth: 0.29 },
    jawDrop: -0.17,
    toothRow: null,
    nostril: { x: 0.66, y: -0.04, spread: 0.1 },
    eye: { x: -0.14, y: 0.14, depth: 0.27, size: 0.14 },
  },
}

export const headShape = (type: HeadType) => HEADS[type]
