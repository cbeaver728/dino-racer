import * as THREE from 'three'
import { TERRAIN_ORDER, type Terrain } from './raceTypes'
// Re-exported so the race modules can keep importing it from the course.
export { toRaceProfile } from './raceSimulation'

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
  /**
   * How far each way bows off the straight line between the fork and the
   * merge. Set for how clearly the two roads should read as separate, since
   * nothing else constrains it.
   */
  bow?: number
}

/**
 * Lava is grown from the volcano rather than placed by hand.
 *
 * Every stretch of road within `reach` of the cone gets some, and the closer it
 * runs the more it gets and the wider the flows are — so the far side of the
 * island stays clean, the coast road catches a few strays, and the road that
 * squeezes past the crater is a mess. Placing pools one at a time could not
 * express that, and left the lava confined to a single stretch.
 */
export interface LavaField {
  /** How far the flows reach from the cone. */
  reach: number
  /** Widest a flow gets, right beside the cone. */
  maxRadius: number
  /** Road samples between attempts; larger is sparser. */
  spacing: number
  /**
   * Clear road between one flow and the next. They are obstacles to be picked
   * through for a faster lap, not a lake — so they are kept apart far enough
   * that a driver can always see the gap and take it.
   */
  gap: number
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
  lava?: LavaField
  /** Volcano cone, for the island. */
  volcano?: { x: number; z: number; scale: number }
  /**
   * Turns the world tropical: the ground plane becomes open water and a sand
   * landmass is laid on top for the circuit to sit on.
   */
  sea?: { water: string; sky: string; sand: string; radius: [number, number] }
  /**
   * Road surface and default shoulder. The stock sandy road vanishes against a
   * sand island, so a course laid on pale ground names a darker one.
   */
  road?: { surface: string; shoulder: string }
}

/** A built fork. Neither way is the main circuit: the road parts in two. */
export interface CourseSplit {
  index: number
  /** Lap fractions, in the lap's own space rather than the main curve's. */
  from: number
  to: number
  label: string
  terrains: [Terrain, Terrain]
  branches: [THREE.Curve<THREE.Vector3>, THREE.Curve<THREE.Vector3>]
  /** Sampled points of each way, for drawing the roads and placing props. */
  samples: [THREE.Vector3[], THREE.Vector3[]]
}

/**
 * One stretch of a lap: a slice of the main circuit, or a fork with two ways
 * round. Each owns a slice of the lap fraction proportional to its length.
 */
export interface CourseLeg {
  kind: 'shared' | 'split'
  splitIndex: number
  curves: THREE.Curve<THREE.Vector3>[]
  /** For a shared leg, the slice of the main curve it covers. */
  uFrom: number
  uTo: number
  length: number
  tFrom: number
  tTo: number
  /** Points along this leg, for drawing its road. A fork holds only its first
   * way here; both are on the split itself. */
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
  legs: CourseLeg[]
  /** How far the track reaches from the middle, so the camera can frame it. */
  extent: number
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
 * One way round a fork: a path that leaves the road along the road's own
 * direction, bows out to `bow` at its midpoint, and rejoins pointing the way the
 * road goes.
 *
 * Built as two cubic segments meeting at the bowed midpoint, because a single
 * cubic cannot both match a tangent at each end and be pushed sideways in the
 * middle. Matching those tangents is the whole point: bending the control
 * points sideways instead put a thirty degree corner at every fork, which is
 * what tore triangular gaps between the road ribbons and snapped the racers
 * round as they entered and left.
 */
function forkPath(curve: THREE.CatmullRomCurve3, from: number, to: number, bow: number) {
  const p0 = curve.getPointAt(from)
  const p1 = curve.getPointAt(to)
  const t0 = curve.getTangentAt(from).clone().setY(0).normalize()
  const t1 = curve.getTangentAt(to).clone().setY(0).normalize()

  const chord = new THREE.Vector3().subVectors(p1, p0)
  const span = chord.length()
  const along = chord.clone().normalize()
  const side = new THREE.Vector3(-along.z, 0, along.x)
  const middle = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5).addScaledVector(side, bow)
  const reach = span * 0.27

  const path = new THREE.CurvePath<THREE.Vector3>()
  path.add(new THREE.CubicBezierCurve3(
    p0,
    p0.clone().addScaledVector(t0, reach),
    middle.clone().addScaledVector(along, -reach),
    middle,
  ))
  path.add(new THREE.CubicBezierCurve3(
    middle,
    middle.clone().addScaledVector(along, reach),
    p1.clone().addScaledVector(t1, -reach),
    p1,
  ))
  return path
}

/**
 * Both ways round one fork, exactly equal in length.
 *
 * Tangent continuity costs the mirror symmetry that used to make the pair equal
 * for free, so the shorter way is bowed out further until it matches. Bowing
 * further is monotonically longer, so a bisection lands it, and both ways still
 * bow at least as far as asked — which is what keeps them visibly two roads.
 */
function forkPair(curve: THREE.CatmullRomCurve3, from: number, to: number, wanted: number) {
  const lengthAt = (bow: number) => forkPath(curve, from, to, bow).getLength()
  const target = Math.max(lengthAt(-wanted), lengthAt(wanted))

  const matched = (sign: number) => {
    let low = wanted
    let high = wanted + 24
    for (let step = 0; step < 40; step++) {
      const bow = (low + high) / 2
      if (lengthAt(sign * bow) < target) low = bow
      else high = bow
    }
    return forkPath(curve, from, to, sign * ((low + high) / 2))
  }
  return [matched(-1), matched(1)] as const
}

const drift = (seed: number) => {
  const value = Math.sin(seed * 975.31) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Flows down one stretch of road. They are banked to one side at a time, so
 * however thick the lava gets there is always a clear line down the other side
 * — the road is meant to be threaded, not blocked.
 */
function flowsAlong(points: THREE.Vector3[], volcano: { x: number; z: number }, field: LavaField, seed: number) {
  const pools: Hazard[] = []
  let previous: THREE.Vector3 | null = null
  for (let index = 1; index < points.length - 1; index += field.spacing) {
    const point = points[index]
    const range = Math.hypot(point.x - volcano.x, point.z - volcano.z)
    if (range > field.reach) continue

    // Only the half of the island the cone stands on. Flows creeping round the
    // far side read as scattered accidents rather than as coming from anywhere.
    if (point.x * volcano.x + point.z * volcano.z <= 0) continue

    const closeness = 1 - range / field.reach
    if (closeness < 0.12) continue
    if (drift(seed + index * 7.3) > closeness * 1.15) continue

    const tangent = points[index + 1].clone().sub(points[index - 1]).setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const bank = Math.floor(index / field.spacing) % 2 ? 1 : -1
    // Placed across the racing line, not beside it. Banked off to one verge they
    // could all be missed by holding the middle, which is no test of anything;
    // straddling the line means a straight run catches some and a driver who
    // picks their way through catches none.
    const lane = bank * (0.12 + drift(seed + index * 3.1) * 0.55)
    const spot = point.clone().addScaledVector(side, lane)
    // Keep them spotty: a flow too close behind the last one makes a wall.
    if (previous && previous.distanceTo(spot) < field.gap) continue
    previous = spot
    pools.push({ x: spot.x, z: spot.z, radius: field.maxRadius * (0.5 + closeness * 0.5) })
  }
  return pools
}

/** Evenly spaced points along one slice of a curve. */
function sliceOfCurve(curve: THREE.Curve<THREE.Vector3>, from: number, to: number, steps = 40) {
  return Array.from({ length: steps + 1 }, (_, i) => curve.getPointAt(from + ((to - from) * i) / steps))
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

  let roadForClearance: THREE.Vector3[] = samples
  const distanceToRoad = (x: number, z: number) => roadForClearance.reduce((nearest, point) => (
    Math.min(nearest, Math.hypot(point.x - x, point.z - z))
  ), Number.POSITIVE_INFINITY)

  /*
   * A lap is a chain of legs: stretches of the main circuit, with a forked leg
   * wherever the road divides. Each leg owns a slice of the lap fraction sized
   * by its own length, so t still runs 0..1 round the lap and still maps evenly
   * onto distance — which is what lets progress, pickups and the replay carry on
   * knowing nothing about forks.
   *
   * Both ways round a fork are the same length, so the lap is the same length
   * whichever way a racer goes.
   */
  const defs = (def.splits ?? []).slice().sort((a, b) => a.from - b.from)
  const legs: CourseLeg[] = []
  let cursor = 0

  defs.forEach((split, index) => {
    if (split.from > cursor) {
      legs.push({ kind: 'shared', splitIndex: -1, curves: [curve], uFrom: cursor, uTo: split.from,
        length: (split.from - cursor) * length, tFrom: 0, tTo: 0,
        samples: sliceOfCurve(curve, cursor, split.from) })
    }
    const arcs = forkPair(curve, split.from, split.to, split.bow ?? 6)
    legs.push({ kind: 'split', splitIndex: index, curves: [arcs[0], arcs[1]], uFrom: split.from, uTo: split.to,
      length: arcs[0].getLength(), tFrom: 0, tTo: 0, samples: arcs[0].getSpacedPoints(40) })
    cursor = split.to
  })
  if (cursor < 1) {
    legs.push({ kind: 'shared', splitIndex: -1, curves: [curve], uFrom: cursor, uTo: 1,
      length: (1 - cursor) * length, tFrom: 0, tTo: 0,
      samples: sliceOfCurve(curve, cursor, 1) })
  }

  // Every drivable metre, so scenery clearance and the dashed centre line cover
  // the forks as well as the circuit.
  const roadPoints = legs.flatMap((leg) => (
    leg.kind === 'split' ? [...leg.curves[0].getSpacedPoints(40), ...leg.curves[1].getSpacedPoints(40)] : leg.samples
  ))

  const extent = roadPoints.reduce((far, point) => Math.max(far, Math.hypot(point.x, point.z)), 0)
  roadForClearance = roadPoints
  const lapLength = legs.reduce((total, leg) => total + leg.length, 0)
  let walked = 0
  for (const leg of legs) {
    leg.tFrom = walked / lapLength
    walked += leg.length
    leg.tTo = walked / lapLength
  }

  const splits: CourseSplit[] = defs.map((split, index) => {
    const leg = legs.find((entry) => entry.splitIndex === index)!
    return {
      index,
      from: leg.tFrom,
      to: leg.tTo,
      label: split.label,
      terrains: [split.left, split.right] as [Terrain, Terrain],
      branches: [leg.curves[0], leg.curves[1]],
      samples: [leg.curves[0].getSpacedPoints(40), leg.curves[1].getSpacedPoints(40)],
    }
  })

  const legAt = (t: number) => {
    const wrapped = ((t % 1) + 1) % 1
    for (const leg of legs) if (wrapped >= leg.tFrom && wrapped < leg.tTo) return leg
    return legs[legs.length - 1]
  }

  const splitAt = (t: number) => {
    const leg = legAt(t)
    return leg.splitIndex >= 0 ? splits[leg.splitIndex] : null
  }

  const terrainOn = (t: number, route?: Route) => {
    const split = splitAt(t)
    if (split) return split.terrains[route?.[split.index] === 1 ? 1 : 0]
    return terrainAt(frameAt(t, 0).position.x, frameAt(t, 0).position.z)
  }

  const frameAt = (t: number, lane: number, route?: Route) => {
    const wrapped = ((t % 1) + 1) % 1
    const leg = legAt(wrapped)
    const local = leg.tTo > leg.tFrom ? (wrapped - leg.tFrom) / (leg.tTo - leg.tFrom) : 0

    let target: THREE.Curve<THREE.Vector3>
    let at: number
    if (leg.kind === 'split') {
      target = leg.curves[route?.[leg.splitIndex] === 1 ? 1 : 0]
      at = local
    } else {
      target = curve
      // A shared leg is a slice of the main circuit, so its local fraction maps
      // back onto that slice of the circuit's own arc length.
      at = leg.uFrom + local * (leg.uTo - leg.uFrom)
    }

    const point = target.getPointAt(Math.min(1, Math.max(0, at)))
    const tangent = target.getTangentAt(Math.min(1, Math.max(0, at))).clone().setY(0).normalize()
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)
    return {
      position: point.clone().addScaledVector(side, lane),
      // The model faces +X, so align +X with the tangent rather than +Z.
      heading: Math.atan2(-tangent.z, tangent.x),
    }
  }

  // Grown from the cone once the roads exist, so every stretch within reach of
  // it gets flows sized by how close it runs.
  const lava: Hazard[] = []
  if (def.lava && def.volcano) {
    legs.forEach((leg, index) => {
      const strands = leg.kind === 'split'
        ? [leg.curves[0].getSpacedPoints(70), leg.curves[1].getSpacedPoints(70)]
        : [leg.samples]
      strands.forEach((strand, side) => {
        lava.push(...flowsAlong(strand, def.volcano!, def.lava!, index * 137 + side * 61))
      })
    })
  }

  /*
   * Clears any flow that would close a road outright.
   *
   * The flows are banked to one side at a time so a line should always exist,
   * but where the bank changes two of them can meet across the middle. Rather
   * than tune the scatter until that never happens, the road is walked and the
   * offending flow removed: the track is meant to be threaded, and a wall of
   * lava is not a choice.
   */
  const openTheLine = (strand: THREE.Vector3[]) => {
    for (let index = 0; index < strand.length - 1; index++) {
      const point = strand[index]
      const tangent = strand[index + 1].clone().sub(point).setY(0)
      if (tangent.lengthSq() < 1e-6) continue
      tangent.normalize()
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x)

      for (let attempt = 0; attempt < 4; attempt++) {
        let clear = 0
        for (let lane = -1.05; lane <= 1.06; lane += 0.15) {
          const x = point.x + side.x * lane
          const z = point.z + side.z * lane
          if (!lava.some((pool) => (x - pool.x) ** 2 + (z - pool.z) ** 2 < pool.radius ** 2)) clear++
        }
        if (clear > 0) break
        // Drop whichever flow sits closest to the middle of the road here.
        let worst = -1
        let nearest = Number.POSITIVE_INFINITY
        lava.forEach((pool, at) => {
          const range = Math.hypot(pool.x - point.x, pool.z - point.z)
          if (range < nearest) { nearest = range; worst = at }
        })
        if (worst < 0) break
        lava.splice(worst, 1)
      }
    }
  }
  for (const leg of legs) {
    if (leg.kind === 'split') {
      openTheLine(leg.curves[0].getSpacedPoints(70))
      openTheLine(leg.curves[1].getSpacedPoints(70))
    } else openTheLine(leg.samples)
  }

  const paceAt = (x: number, z: number) => {
    for (const pool of lava) {
      if ((x - pool.x) ** 2 + (z - pool.z) ** 2 < pool.radius ** 2) return LAVA_PACE
    }
    return 1
  }

  // The stretch lava lives on, with room either side for the run in and out.
  // Everywhere else the racers can skip looking for it entirely.
  const lavaSpan = lava.length ? { from: 0, to: 1 } : null

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
    def, curve, samples: roadPoints, length: lapLength, startT: def.startT, mix, splits, legs, extent, lava,
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
  startT: .02,
  points: [
    [-20, .12, -2], [-18.5, .12, -8], [-13, .12, -12.5], [-6, .12, -14.5],
    [2, .12, -14.5], [9, .12, -13], [15, .12, -9.5], [19, .12, -4],
    [20, .12, 2], [18, .12, 8], [13, .12, 12], [6, .12, 14],
    [-2, .12, 14], [-9, .12, 12.5], [-15, .12, 9], [-19, .12, 4],
  ],
  /*
   * Bowed wide enough that each fork is unmistakably two roads with ground
   * between them. The left way bows out toward the sea and the right way in
   * toward the middle of the island, so the coastal terrain is named first and
   * the inland one second.
   */
  splits: [
    { from: .17, to: .31, bow: 4.6, left: 'Marsh', right: 'Forest', label: 'Lagoon or jungle' },
    { from: .43, to: .57, bow: 4.6, left: 'Plains', right: 'Mountains', label: 'Beach or volcano' },
    { from: .69, to: .83, bow: 4.6, left: 'Forest', right: 'Marsh', label: 'Palms or mangrove' },
  ],
  /*
   * Lava spreads out from the cone across the whole eastern half of the island:
   * thick and wide on the road that squeezes past the crater, thinning to the
   * odd flow on the coast road, and nothing at all on the far side.
   */
  lava: { reach: 17, maxRadius: 1.02, spacing: 3, gap: 3.6 },
  volcano: { x: 7.5, z: 0, scale: 1.25 },
  sea: { water: '#2f8fb5', sky: '#8fd8ee', sand: '#e8d6a6', radius: [27, 21] },
  // Packed volcanic earth: dark enough to read as a road across pale sand.
  road: { surface: '#9c6b42', shoulder: '#6d4527' },
  biomes: {
    Forest: { center: [-3, -9], patch: [11, 6], spread: [9, 4.5] },
    Mountains: { center: [9.5, 0.5], patch: [8, 7.5], spread: [5, 5] },
    Marsh: { center: [-14, 3], patch: [7.5, 7], spread: [5.5, 5] },
    Plains: { center: [0, 18], patch: [14, 6], spread: [12, 4.5] },
  },
}

export const COURSE_DEFS = [WILD_CIRCUIT, FIGURE_EIGHT, VOLCANO_ISLAND]
export const COURSES = COURSE_DEFS.map(buildCourse)
export const defaultCourse = COURSES[0]
export const courseById = (id: string) => COURSES.find((course) => course.def.id === id) ?? defaultCourse

