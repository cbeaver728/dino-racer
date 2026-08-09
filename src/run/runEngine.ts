/**
 * Star Dash: a straight-line arcade run. The dinosaur holds its ground near the
 * camera while stars and tornadoes stream in from the horizon.
 *
 * The rules are shaped around a four year old playing it: three wide lanes, one
 * tornado at most in any row so two lanes are always safe, a generous reach on
 * the stars and a tighter one on the tornadoes.
 */

export const LANES = [-2.15, 0, 2.15]
export const RUN_SECONDS = 60

/** Units per second the world travels toward the player. */
export const SPEED = 17
export const SPAWN_Z = -74
export const DESPAWN_Z = 10
/** Roughly four and a half seconds of warning on anything ahead. */
export const ROW_INTERVAL = 0.85

/** Easy to collect. */
export const STAR_RADIUS = 1.5
/** Harder to collide with than a star is to catch, on purpose. */
export const TORNADO_RADIUS = 1.05
/** Lanes per second the dinosaur slides when steering. */
export const LANE_GLIDE = 7.5

export type RunObjectKind = 'star' | 'tornado'

export interface RunObject {
  id: number
  kind: RunObjectKind
  lane: number
  z: number
  gone: boolean
}

/** Rows at the start that are stars only, so a run always opens with a win. */
const GRACE_ROWS = 3
/** Share of rows carrying a hazard. A full minute is a lot of dodging. */
const TORNADO_CHANCE = 0.3

export interface SpawnState {
  nextId: number
  timer: number
  row: number
}

export function createSpawnState(): SpawnState {
  // A short breather before the first row so the run does not open on a hazard.
  return { nextId: 0, timer: -1.4, row: 0 }
}

/**
 * Builds one row of objects. At most one tornado, and stars only in lanes the
 * tornado does not occupy, so there is always somewhere safe to be.
 */
function buildRow(state: SpawnState): RunObject[] {
  const row: RunObject[] = []
  const free = [0, 1, 2]
  const index = state.row++

  if (index >= GRACE_ROWS && Math.random() < TORNADO_CHANCE) {
    const lane = free.splice(Math.floor(Math.random() * free.length), 1)[0]
    row.push({ id: state.nextId++, kind: 'tornado', lane, z: SPAWN_Z, gone: false })
  }

  const stars = Math.random() < 0.35 ? 2 : 1
  for (let index = 0; index < stars && free.length; index++) {
    const lane = free.splice(Math.floor(Math.random() * free.length), 1)[0]
    row.push({ id: state.nextId++, kind: 'star', lane, z: SPAWN_Z, gone: false })
  }

  return row
}

export function advanceSpawner(state: SpawnState, delta: number): RunObject[] {
  state.timer += delta
  if (state.timer < ROW_INTERVAL) return []
  state.timer -= ROW_INTERVAL
  return buildRow(state)
}

export interface RunHit {
  star: boolean
  tornado: boolean
}

/**
 * Moves everything toward the player and reports what was touched. Measured off
 * the dinosaur's real x, so a dodge that is halfway between lanes still counts.
 */
export function advanceObjects(objects: RunObject[], playerX: number, delta: number): RunHit {
  const hit: RunHit = { star: false, tornado: false }

  for (const object of objects) {
    object.z += SPEED * delta
    if (object.gone) continue

    const reach = object.kind === 'star' ? STAR_RADIUS : TORNADO_RADIUS
    // Only test around the player's own depth; the band is wide enough that a
    // slow frame cannot let an object step straight over the dinosaur.
    if (Math.abs(object.z) < 1.6 && Math.abs(LANES[object.lane] - playerX) < reach) {
      object.gone = true
      if (object.kind === 'star') hit.star = true
      else hit.tornado = true
    }
  }

  return hit
}

export const prune = (objects: RunObject[]) => objects.filter((object) => object.z < DESPAWN_Z && !object.gone)
