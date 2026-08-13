import { BASE_SPEED, LAP_COUNT, type RaceDinosaurProfile, type Terrain, type TerrainResult } from './raceTypes'

/**
 * How much of a build's raw advantage survives into its actual pace.
 *
 * Raw pace used to be used as-is, inside a 0.55–1.55 clamp, which let the best
 * build lap the track about fifty percent faster than the worst — the loser was
 * off the back before the first corner and no pickup could ever bring them back.
 *
 * Squeezing toward 1 rather than clipping at a hard limit is what matters here.
 * A clamp tight enough to keep the field together also parked most builds
 * exactly on the ceiling, which silently threw away every bonus past the first:
 * a triceratops and a raptor came out identical on the mountains. Compression
 * keeps the order intact, so every part a child picks still moves the number.
 */
const COMPRESSION = 0.42

/** A backstop for absurd combinations; ordinary builds never reach it. */
const PACE_FLOOR = 0.8
const PACE_CEILING = 1.3

const clamp = (raw: number) => Math.max(PACE_FLOOR, Math.min(PACE_CEILING, 1 + (raw - 1) * COMPRESSION))

/**
 * What each head family is good at.
 *
 * The head is the choice a child cares about most and it used to do nothing at
 * all, so every family now owns a terrain. Parasaurolophus is the exception on
 * purpose: instead of a home straight it keeps a little of its pace everywhere,
 * which makes "steady" a real strategy rather than a missing bonus.
 */
const HEAD_HOME: Partial<Record<RaceDinosaurProfile['head'], { terrain: Terrain; note: string }>> = {
  Raptor: { terrain: 'Forest', note: 'A raptor darts between the trees' },
  'T-Rex': { terrain: 'Plains', note: 'A T-Rex thunders across open ground' },
  Triceratops: { terrain: 'Mountains', note: 'A triceratops grips the rocky climb' },
  Brachiosaurus: { terrain: 'Marsh', note: 'A brachiosaurus wades straight through' },
}

const HEAD_BONUS = .15
const STEADY_BONUS = .06

export function evaluateTerrain(profile: RaceDinosaurProfile, terrain: Terrain): TerrainResult {
  let pace = 1
  const strengths: string[] = []
  const challenges: string[] = []
  const add = (amount: number, message: string) => { pace += amount; strengths.push(message) }
  const subtract = (amount: number, message: string) => { pace -= amount; challenges.push(message) }

  const home = HEAD_HOME[profile.head]
  if (home && home.terrain === terrain) add(HEAD_BONUS, home.note)
  if (profile.head === 'Parasaurolophus') add(STEADY_BONUS, 'A parasaurolophus keeps the same pace everywhere')

  if (terrain === 'Marsh') {
    if (profile.footType === 'Webbed Feet') add(.28, 'Webbed feet paddle through water')
    else if (profile.footType === 'Clawed Feet') add(.08, 'Claws grip slippery mud')
    if (profile.size === 'Big') subtract(.18, 'A big body sinks into mud')
    if (profile.stance === 'Quadruped') add(.08, 'Four feet spread the weight')
  }
  if (terrain === 'Mountains') {
    if (profile.tailType === 'Long Tail' || profile.tailType === 'Giant Tail') add(.18, 'Long tail improves balance')
    if (profile.footType === 'Clawed Feet') add(.16, 'Claws grip the rocks')
    // Hauling yourself up a switchback is the one place raw power pays off.
    if (profile.strength >= 4) add(.12, 'Strong legs power up the slope')
    if (profile.legLength === 'Long') subtract(.1, 'Long legs wobble on ledges')
    if (profile.size === 'Big') subtract(.08, 'Large body slows climbing')
  }
  if (terrain === 'Forest') {
    if (profile.size === 'Small') add(.2, 'Small body slips between trees')
    if (profile.stance === 'Biped') add(.08, 'Two legs pivot quickly')
    if (profile.size === 'Big') subtract(.16, 'Big body bumps branches')
    if (profile.tailType === 'Giant Tail') subtract(.1, 'Giant tail catches on roots')
  }
  if (terrain === 'Plains') {
    if (profile.legLength === 'Long') add(.25, 'Long legs open up a sprint')
    if (profile.stance === 'Biped') add(.1, 'Biped stride is fast in open space')
    if (profile.hasWings) add(.07, 'Wings help catch the breeze')
    if (profile.size === 'Big') subtract(.08, 'Large body takes more effort to sprint')
    if (profile.legLength === 'Short') subtract(.15, 'Short legs lose ground on the straightaway')
  }

  return {
    terrain,
    pace: clamp(pace),
    note: strengths[0] || challenges[0] || 'A steady all-round terrain.',
    strengths,
    challenges,
  }
}

/**
 * How much of the fastest build's pace is still lost to a tired dinosaur at the
 * line. Deliberately smaller than the terrain spread: stamina should decide a
 * close race, not overturn one.
 */
const MAX_FADE = .2

/**
 * Stamina as a fade rather than a flat bonus, so it is something a child can
 * watch happen — the sprinter leads the first lap and gets reeled in on the
 * second. Stamina 5 never slows down; stamina 1 gives up a fifth of its pace by
 * the finish.
 */
export function staminaPace(stamina: number, fraction: number) {
  const softness = 1 - (Math.max(1, Math.min(5, stamina)) - 1) / 4
  return 1 - softness * MAX_FADE * Math.max(0, Math.min(1, fraction))
}

/**
 * Seconds for a full race on this course, at the racer's own pace.
 *
 * Measured off the real track rather than assumed: the old version summed a
 * made-up twenty-five seconds per terrain and reported about ninety seconds for
 * a lap the engine actually ran in sixteen.
 */
export function estimateRaceTime(
  profile: RaceDinosaurProfile,
  course: { length: number; mix: { terrain: Terrain; share: number }[] },
) {
  const lap = course.mix.reduce((seconds, { terrain, share }) => {
    const distance = course.length * (share / 100)
    return seconds + distance / (BASE_SPEED * evaluateTerrain(profile, terrain).pace)
  }, 0)
  // Charge the average fade over the race rather than the pace at any one point.
  return (lap * LAP_COUNT) / staminaPace(profile.stamina, 0.5)
}
