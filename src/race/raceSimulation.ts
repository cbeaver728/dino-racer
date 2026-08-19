import {
  BODIES, DEFAULT_DINO, FEATURES, FEET, FRONT_LIMBS, HEADS, HIND_LEGS, TAILS,
  isBiped, type DinosaurConfig,
} from '../game/dinosaurTypes'
import { calculateStats } from '../game/calculateStats'
import { BASE_SPEED, LAP_COUNT, TERRAIN_ORDER, type RaceDinosaurProfile, type Terrain, type TerrainResult } from './raceTypes'

/**
 * The racing traits the simulation reads out of a built dinosaur. Strength and
 * stamina come from the same `calculateStats` the builder's panel shows, so the
 * bars a child fills in are the numbers the race actually runs on.
 *
 * It lives here rather than with the course so the lab can work out how a build
 * will race without pulling in any track geometry.
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
 * Every rule the race runs on, written down rather than coded up.
 *
 * The simulation walks this table and so does the guide in the lab, which is
 * the point: a child reading what claws do on the rocks is reading the same
 * line the race reads. Prose kept somewhere else would drift the first time a
 * number moved, and these numbers have moved a lot.
 *
 * Order matters — the first entry that applies becomes the headline on the
 * terrain card — so head bonuses lead each list.
 */
export interface TerrainRule {
  /** The builder control this is about, worded as the builder words it. */
  trait: string
  /** The choice on that control which triggers it. */
  choice: string
  /** Added to raw pace. Negative rules are the ones that cost you. */
  amount: number
  note: string
  applies: (profile: RaceDinosaurProfile) => boolean
}

/** The head that owns each terrain, and the one that owns none of them. */
const steady: TerrainRule = {
  trait: 'Head type',
  choice: 'Parasaurolophus',
  amount: .06,
  note: 'A parasaurolophus keeps the same pace everywhere',
  applies: (p) => p.head === 'Parasaurolophus',
}

const homeHead = (head: RaceDinosaurProfile['head'], note: string): TerrainRule => ({
  trait: 'Head type', choice: head, amount: .15, note, applies: (p) => p.head === head,
})

export const TERRAIN_RULES: Record<Terrain, TerrainRule[]> = {
  Marsh: [
    homeHead('Brachiosaurus', 'A brachiosaurus wades straight through'),
    steady,
    { trait: 'Feet', choice: 'Webbed Feet', amount: .28, note: 'Webbed feet paddle through water',
      applies: (p) => p.footType === 'Webbed Feet' },
    { trait: 'Feet', choice: 'Clawed Feet', amount: .08, note: 'Claws grip slippery mud',
      applies: (p) => p.footType === 'Clawed Feet' },
    { trait: 'Body size', choice: 'Big', amount: -.18, note: 'A big body sinks into mud',
      applies: (p) => p.size === 'Big' },
    { trait: 'Body style', choice: 'Four-legged', amount: .08, note: 'Four feet spread the weight',
      applies: (p) => p.stance === 'Quadruped' },
  ],
  Mountains: [
    homeHead('Triceratops', 'A triceratops grips the rocky climb'),
    steady,
    { trait: 'Tail', choice: 'Long or Giant Tail', amount: .18, note: 'Long tail improves balance',
      applies: (p) => p.tailType === 'Long Tail' || p.tailType === 'Giant Tail' },
    { trait: 'Feet', choice: 'Clawed Feet', amount: .16, note: 'Claws grip the rocks',
      applies: (p) => p.footType === 'Clawed Feet' },
    // Hauling yourself up a switchback is the one place raw power pays off.
    { trait: 'Strength', choice: '4 or more', amount: .12, note: 'Strong legs power up the slope',
      applies: (p) => p.strength >= 4 },
    { trait: 'Back legs', choice: 'Long', amount: -.1, note: 'Long legs wobble on ledges',
      applies: (p) => p.legLength === 'Long' },
    { trait: 'Body size', choice: 'Big', amount: -.08, note: 'Large body slows climbing',
      applies: (p) => p.size === 'Big' },
  ],
  Forest: [
    homeHead('Raptor', 'A raptor darts between the trees'),
    steady,
    { trait: 'Body size', choice: 'Small', amount: .2, note: 'Small body slips between trees',
      applies: (p) => p.size === 'Small' },
    { trait: 'Body style', choice: 'Two-legged', amount: .08, note: 'Two legs pivot quickly',
      applies: (p) => p.stance === 'Biped' },
    { trait: 'Body size', choice: 'Big', amount: -.16, note: 'Big body bumps branches',
      applies: (p) => p.size === 'Big' },
    { trait: 'Tail', choice: 'Giant Tail', amount: -.1, note: 'Giant tail catches on roots',
      applies: (p) => p.tailType === 'Giant Tail' },
  ],
  Plains: [
    homeHead('T-Rex', 'A T-Rex thunders across open ground'),
    steady,
    { trait: 'Back legs', choice: 'Long', amount: .25, note: 'Long legs open up a sprint',
      applies: (p) => p.legLength === 'Long' },
    { trait: 'Body style', choice: 'Two-legged', amount: .1, note: 'Biped stride is fast in open space',
      applies: (p) => p.stance === 'Biped' },
    { trait: 'Extra feature', choice: 'Wings', amount: .07, note: 'Wings help catch the breeze',
      applies: (p) => p.hasWings },
    { trait: 'Body size', choice: 'Big', amount: -.08, note: 'Large body takes more effort to sprint',
      applies: (p) => p.size === 'Big' },
    { trait: 'Back legs', choice: 'Short', amount: -.15, note: 'Short legs lose ground on the straightaway',
      applies: (p) => p.legLength === 'Short' },
  ],
}

export function evaluateTerrain(profile: RaceDinosaurProfile, terrain: Terrain): TerrainResult {
  let pace = 1
  const strengths: string[] = []
  const challenges: string[] = []

  for (const rule of TERRAIN_RULES[terrain]) {
    if (!rule.applies(profile)) continue
    pace += rule.amount
    if (rule.amount >= 0) strengths.push(rule.note)
    else challenges.push(rule.note)
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
 * The pace a middling dinosaur gets on each terrain, measured by building every
 * one of them and taking the middle.
 *
 * Raw pace is measured against a dinosaur that triggers no rule at all, which is
 * a dinosaur nobody can build: the rules hand out far more bonuses than
 * penalties, so almost every real build scores over 100% and the number reads as
 * praise rather than information. Against a typical dinosaur instead, 100% means
 * average, and being under it means something.
 *
 * Worked out once, on first use, and only for display — the race itself still
 * runs on raw pace, so nothing here can move the balance.
 */
let typical: Record<Terrain, number> | null = null

function typicalPace(): Record<Terrain, number> {
  if (typical) return typical

  const gathered = {} as Record<Terrain, number[]>
  for (const terrain of TERRAIN_ORDER) gathered[terrain] = []

  for (const head of HEADS) {
    for (const body of BODIES) {
      for (const hindLegs of HIND_LEGS) {
        for (const feet of FEET) {
          for (const tail of TAILS) {
            for (const feature of FEATURES) {
              for (const frontLimbs of FRONT_LIMBS) {
                const profile = toRaceProfile({ ...DEFAULT_DINO, head, body, hindLegs, feet, tail, feature, frontLimbs })
                for (const terrain of TERRAIN_ORDER) {
                  gathered[terrain].push(evaluateTerrain(profile, terrain).pace)
                }
              }
            }
          }
        }
      }
    }
  }

  const middle = {} as Record<Terrain, number>
  for (const terrain of TERRAIN_ORDER) {
    const sorted = gathered[terrain].sort((a, b) => a - b)
    middle[terrain] = sorted[Math.floor(sorted.length / 2)]
  }
  typical = middle
  return middle
}

/** This build's pace against a typical one: 1 is average, 1.1 is a tenth quicker. */
export function paceIndex(profile: RaceDinosaurProfile, terrain: Terrain) {
  return evaluateTerrain(profile, terrain).pace / typicalPace()[terrain]
}

/** The same thing in a word, for anyone not reading percentages. */
export function paceWord(index: number) {
  if (index >= 1.07) return 'Great here'
  if (index >= 1.025) return 'Good here'
  if (index > 0.975) return 'Steady here'
  if (index > 0.93) return 'Slow here'
  return 'Struggles here'
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
