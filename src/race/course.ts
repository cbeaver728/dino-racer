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
 * Both ways take a racer exactly the same share of the lap, so which way they go
 * never changes how far they have to run in race terms — only what they run
 * over. That is the whole point of the choice: a webbed-footed dinosaur wants
 * the water, a clawed one wants the rock.
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
   * How far each way bows out from the road at the middle of the fork. Set for
   * how clearly the two roads should read as separate; trimmed automatically on
   * the inside of a bend, where the full bow would pinch the road.
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
  /** Where along the lap it lies, so racers only look for lava where it is. */
  t: number
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
  theme?: 'aurora'
  /** Glowing straights accelerate every racer equally, on both laps. */
  currents?: { from: number; to: number; pace: number }[]
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
  /** `lane`, held back from reaching onto the other way round a fork. */
  ownRoadLane(t: number, route: Route | undefined, lane: number): number
  /** 1 in the clear, less inside a lava pool. */
  paceAt(x: number, z: number): number
  currentAt(t: number): number
  /** Distance to the edge of the nearest pool; negative inside one. */
  clearanceAt(x: number, z: number): number
  /** Lap fractions between which lava can be met, so racers only look there. */
  lavaSpan: { from: number; to: number } | null
  distanceToRoad(x: number, z: number): number
}

/**
 * The line a fork is built around: one smooth curve from the fork to the merge
 * that leaves and arrives along the road's own heading.
 *
 * Its handles are sized so the curve follows a circular arc when the road bends
 * evenly through the fork, and a third of the chord on a straight, so it takes
 * the road's overall turn at an even rate.
 *
 * Neither obvious alternative works as a spine. The straight chord between the
 * ends points the wrong way on a bend, so ways bowed off it set off along the
 * road, hooked across, and swung back through the best part of a hundred
 * degrees. The road itself carries the tight corners these loose splines gather
 * at their control points, and ways offset from it inherit every one.
 */
function forkSpine(curve: THREE.CatmullRomCurve3, from: number, to: number) {
  const p0 = curve.getPointAt(from)
  const p1 = curve.getPointAt(to)
  const t0 = curve.getTangentAt(from).setY(0).normalize()
  const t1 = curve.getTangentAt(to).setY(0).normalize()
  const chord = Math.hypot(p1.x - p0.x, p1.z - p0.z)
  const angle = t0.angleTo(t1)
  const handle = angle < 1e-3
    ? chord / 3
    : (4 / 3) * Math.tan(angle / 4) * (chord / (2 * Math.sin(angle / 2)))
  return new THREE.CubicBezierCurve3(
    p0,
    p0.clone().addScaledVector(t0, handle),
    p1.clone().addScaledVector(t1, -handle),
    p1,
  )
}

/**
 * One way round a fork: the spine, shifted sideways by a bump that is zero at
 * the fork and at the merge.
 *
 * Built as an offset rather than a curve of its own, a way stays on its own
 * side the whole distance and never turns the wrong way first — the left way is
 * always left of the right way. The bump is sin², so the offset and its slope
 * are both zero at each end and the way leaves and rejoins along the road's own
 * heading.
 */
class ForkBranch extends THREE.Curve<THREE.Vector3> {
  readonly spine: THREE.CubicBezierCurve3
  /** Signed peak offset at the middle of the fork; positive is the driver's right. */
  readonly bow: number

  constructor(spine: THREE.CubicBezierCurve3, bow: number) {
    super()
    this.spine = spine
    this.bow = bow
    // Arc-length lookups drive both racers and road ribbons; the offset makes
    // spacing uneven round a bend, so be generous with the table.
    this.arcLengthDivisions = 320
  }

  getPoint(f: number, target = new THREE.Vector3()) {
    const point = this.spine.getPoint(f)
    const tangent = this.spine.getTangent(f).setY(0).normalize()
    const offset = this.bow * Math.sin(Math.PI * f) ** 2
    return target.set(point.x - tangent.z * offset, point.y, point.z + tangent.x * offset)
  }
}

/**
 * The sharpest a fork road may turn, in radians per unit of road. A touch over
 * the tightest corners already on the circuits, so taking a fork never throws a
 * dinosaur round harder than the road around it does.
 */
const FORK_MAX_TURN = THREE.MathUtils.degToRad(30)

/**
 * Distance a turn is measured over: about a quarter of a racing dinosaur.
 *
 * What a driver feels is how far the heading swings over a short stretch, not
 * the curvature at a point. The splines' curvature jumps at every control
 * point, and a sideways offset turns each jump into a kink of a degree or so —
 * invisible, but read pointwise it looks like a hairpin.
 */
const TURN_WINDOW = 0.6

/** Sharpest sustained turn along a branch, in radians per unit of road. */
function sharpestTurn(branch: ForkBranch) {
  const STEPS = 600
  const points = Array.from({ length: STEPS + 1 }, (_, index) => branch.getPoint(index / STEPS))
  const walked = [0]
  const headings: number[] = []
  for (let index = 0; index < STEPS; index++) {
    const a = points[index]
    const b = points[index + 1]
    walked.push(walked[index] + Math.hypot(b.x - a.x, b.z - a.z))
    headings.push(Math.atan2(b.z - a.z, b.x - a.x))
  }

  let worst = 0
  let ahead = 0
  for (let index = 0; index < STEPS; index++) {
    while (ahead < STEPS - 1 && walked[ahead] - walked[index] < TURN_WINDOW) ahead++
    const run = walked[ahead] - walked[index]
    if (run <= 0) continue
    const turn = Math.abs(Math.atan2(Math.sin(headings[ahead] - headings[index]), Math.cos(headings[ahead] - headings[index])))
    worst = Math.max(worst, turn / Math.max(run, TURN_WINDOW))
  }
  return worst
}

/**
 * The widest bow up to `wanted` that keeps a branch no sharper than a corner.
 *
 * Measured rather than derived. Shifting a road toward the inside of its own
 * bend compresses it — the inside way covers less ground than the road it
 * replaces, so the same sideways drift makes a steeper angle and a much tighter
 * turn — and on these loose splines the bends gather at the control points,
 * which no simple rule caught. So each branch is built, its sharpest point is
 * read off, and the bow is narrowed until it passes. On a straight both ways
 * keep their full bow; on a bend the inside way hugs the road and the outside
 * way swings wide, which is what a bypass looks like.
 */
function fittedBranch(spine: THREE.CubicBezierCurve3, side: 1 | -1, wanted: number) {
  const make = (bow: number) => new ForkBranch(spine, side * bow)
  // Never demand more than the spine itself manages over the same stretch.
  const allowed = Math.max(FORK_MAX_TURN, sharpestTurn(make(0)) * 1.15)
  const full = make(wanted)
  if (sharpestTurn(full) <= allowed) return full

  let low = 0
  let high = wanted
  for (let step = 0; step < 14; step++) {
    const middle = (low + high) / 2
    if (sharpestTurn(make(middle)) <= allowed) low = middle
    else high = middle
  }
  return make(low)
}

/**
 * Both ways round one fork. Each bows out as far as asked, except where that
 * would make it turn harder than a corner — in practice the inside of a bend.
 *
 * The two are not the same drawn length, and do not need to be: progress is
 * counted in lap fractions and a fork maps its share of the lap onto whichever
 * way a racer takes, so both ways always take exactly the same time. Forcing
 * the drawn lengths equal on a bend meant contorting the inside way to lengthen
 * it, which is what made the forks swerve.
 */
function forkPair(curve: THREE.CatmullRomCurve3, from: number, to: number, wanted: number) {
  const spine = forkSpine(curve, from, to)
  return [fittedBranch(spine, -1, wanted), fittedBranch(spine, 1, wanted)] as const
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
function flowsAlong(
  points: THREE.Vector3[],
  volcano: { x: number; z: number },
  field: LavaField,
  seed: number,
  span: { from: number; to: number },
) {
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
    const along = span.from + (span.to - span.from) * (index / (points.length - 1))
    pools.push({ x: spot.x, z: spot.z, radius: field.maxRadius * (0.5 + closeness * 0.5), t: along })
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
   * A fork is one leg whichever way a racer goes, so the lap is the same
   * distance in race terms either way round.
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
    // Sized by the average of the two ways, so neither moves across the ground
    // much faster or slower than its racer's legs suggest.
    legs.push({ kind: 'split', splitIndex: index, curves: [arcs[0], arcs[1]], uFrom: split.from, uTo: split.to,
      length: (arcs[0].getLength() + arcs[1].getLength()) / 2, tFrom: 0, tTo: 0, samples: arcs[0].getSpacedPoints(40) })
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

  /*
   * The nearest lane to `lane` that keeps a racer on the way round a fork it
   * actually took.
   *
   * Just past a fork the two ways overlap, and a lane measured off one of them
   * can reach across onto the other. A racer out there is drawn on the wrong
   * road while the race carries it along its own — a driver who committed
   * right and then steered left spent a second visibly on the left road before
   * being dragged off to the right. So a racer may edge toward the other way
   * only while it is still nearer its own centreline than any part of the
   * other one.
   *
   * Measured against the whole of the other way rather than the point level
   * with the racer: where the two splay apart, the closest stretch of the other
   * road is further along, and a line drawn level with the racer let it cross.
   */
  const DENSE = 240
  const dense = new Map(legs.filter((leg) => leg.kind === 'split').map((leg) => (
    [leg, [leg.curves[0].getSpacedPoints(DENSE), leg.curves[1].getSpacedPoints(DENSE)]] as const
  )))
  const ownRoadLane = (t: number, route: Route | undefined, lane: number) => {
    const wrapped = ((t % 1) + 1) % 1
    const leg = legAt(wrapped)
    const ways = dense.get(leg)
    if (!ways) return lane
    const local = leg.tTo > leg.tFrom ? (wrapped - leg.tFrom) / (leg.tTo - leg.tFrom) : 0
    const at = Math.min(1, Math.max(0, local))
    // Only while the ways pull apart. As they come back together they are about
    // to be one road again, and holding a racer off the other way there would
    // just slide it sideways into the merge.
    if (at > 0.5) return lane
    const taken = route?.[leg.splitIndex] === 1 ? 1 : 0
    // The left way is always left of the right way, so the other road lies to
    // the right of the left way and to the left of the right way.
    const toward = taken === 1 ? -1 : 1
    if (lane * toward <= 0) return lane

    const centre = leg.curves[taken].getPointAt(at)
    const tangent = leg.curves[taken].getTangentAt(at).setY(0).normalize()
    const other = ways[1 - taken]
    const near = Math.round(at * DENSE)
    const first = Math.max(0, near - 60)
    const last = Math.min(DENSE, near + 60)

    const toOther = (x: number, z: number) => {
      let best = Number.POSITIVE_INFINITY
      for (let index = first; index < last; index++) {
        const a = other[index]
        const b = other[index + 1]
        const ex = b.x - a.x
        const ez = b.z - a.z
        const span = ex * ex + ez * ez
        const s = span > 0 ? Math.min(1, Math.max(0, ((x - a.x) * ex + (z - a.z) * ez) / span)) : 0
        best = Math.min(best, Math.hypot(x - a.x - ex * s, z - a.z - ez * s))
      }
      return best
    }
    const ownSide = (offset: number) => {
      const x = centre.x - tangent.z * offset * toward
      const z = centre.z + tangent.x * offset * toward
      return toOther(x, z) > offset
    }

    const wanted = lane * toward
    if (ownSide(wanted)) return lane
    // Bisect for the furthest offset that is still nearer home than away.
    let inner = 0
    let outer = wanted
    for (let step = 0; step < 14; step++) {
      const middle = (inner + outer) / 2
      if (ownSide(middle)) inner = middle
      else outer = middle
    }
    return inner * toward
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
        lava.push(...flowsAlong(strand, def.volcano!, def.lava!, index * 137 + side * 61,
          { from: leg.tFrom, to: leg.tTo }))
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

  const currentAt = (t: number) => {
    const wrapped = ((t % 1) + 1) % 1
    return def.currents?.find((zone) => wrapped >= zone.from && wrapped < zone.to)?.pace ?? 1
  }

  // The stretch lava lives on, with room either side for the run in and out.
  // Everywhere else the racers can skip looking for it entirely.
  /*
   * The stretch of lap that can hold lava, with room either side for the run in.
   *
   * This was left at the whole lap when the flows became a field, which quietly
   * turned the gate into a no-op: every computer racer then probed for lava on
   * every frame of every lap, on the one course where probing is expensive.
   * Each flow now records its own lap fraction as it is placed, so the span is
   * exact and costs nothing to work out.
   */
  const lavaSpan = lava.length
    ? {
      from: Math.max(0, Math.min(...lava.map((pool) => pool.t)) - .05),
      to: Math.min(1, Math.max(...lava.map((pool) => pool.t)) + .04),
    }
    : null

  const clearanceAt = (x: number, z: number) => {
    let nearest = Number.POSITIVE_INFINITY
    for (const pool of lava) {
      nearest = Math.min(nearest, Math.hypot(x - pool.x, z - pool.z) - pool.radius)
    }
    return nearest
  }

  /*
   * Measured off the lap as it is actually driven, so the course card matches
   * the track. Walking the main curve instead described a line that, on a forked
   * course, runs through the ground between the two ways round and knows nothing
   * about the terrain either of them was declared to cross.
   *
   * Both ways round every fork are counted, so a card shows everything on offer.
   */
  const counts = {} as Record<Terrain, number>
  for (const terrain of TERRAIN_ORDER) counts[terrain] = 0
  const STEPS = 240
  const ways = splits.length ? [splits.map(() => 0), splits.map(() => 1)] : [undefined]
  for (const route of ways) {
    for (let step = 0; step < STEPS; step++) counts[terrainOn(step / STEPS, route)] += 1
  }
  const sampled = STEPS * ways.length
  const mix = TERRAIN_ORDER
    .map((terrain) => ({ terrain, share: Math.round((counts[terrain] / sampled) * 100) }))
    .filter((entry) => entry.share > 0)
    .sort((a, b) => b.share - a.share)

  return {
    def, curve, samples: roadPoints, length: lapLength, startT: def.startT, mix, splits, legs, extent, lava,
    terrainAt, splitAt, terrainOn, frameAt, ownRoadLane, paceAt, currentAt, clearanceAt, lavaSpan, distanceToRoad,
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
 * ways round always cost the same share of the lap — the only thing that
 * differs is what is underfoot. A webbed-footed dinosaur wants the lagoon; a clawed one wants
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

const AURORA_FALLS: CourseDefinition = {
  id: 'aurora',
  name: 'Aurora Falls',
  blurb: 'Chase the northern lights. Climb the skyway, choose crystal or mushroom trails, and ride glowing straights for a 25% burst of speed.',
  icon: '🌌',
  theme: 'aurora',
  tension: .3,
  startT: .81,
  bridgeMinY: .65,
  road: { surface: '#728da3', shoulder: '#263f60' },
  points: [
    [-22, .18, 4], [-23, .2, -4], [-20, .65, -11], [-13, 2.8, -16],
    [-4, 4.5, -17], [5, 4.8, -16], [14, 3.6, -12], [21, 1.4, -6],
    [23, .18, 2], [20, .18, 10], [12, .18, 15], [3, .18, 13],
    [-5, .18, 16], [-15, .18, 13],
  ],
  splits: [
    { from: .60, to: .75, bow: 3.8, left: 'Mountains', right: 'Forest', label: 'Crystal coast or moonshroom grove' },
    { from: .87, to: .98, bow: 3.2, left: 'Marsh', right: 'Plains', label: 'Moonpool or lantern meadow' },
  ],
  currents: [{ from: .24, to: .35, pace: 1.25 }, { from: .77, to: .83, pace: 1.25 }],
  biomes: {
    Mountains: { center: [8, -13], patch: [17, 9], spread: [13, 6] },
    Forest: { center: [10, 10], patch: [12, 8], spread: [10, 7] },
    Marsh: { center: [-20, 2], patch: [8, 12], spread: [6, 10] },
    Plains: { center: [-9, 11], patch: [12, 8], spread: [10, 7] },
  },
}

export const COURSE_DEFS = [WILD_CIRCUIT, FIGURE_EIGHT, VOLCANO_ISLAND, AURORA_FALLS]
export const COURSES = COURSE_DEFS.map(buildCourse)
export const defaultCourse = COURSES[0]
export const courseById = (id: string) => COURSES.find((course) => course.def.id === id) ?? defaultCourse

