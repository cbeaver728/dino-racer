import * as THREE from 'three'
import type { DinoColor, PatternColor } from './dinosaurTypes'

/**
 * Every dinosaur is drawn from a small palette derived from the one colour the
 * player picks. Two-tone shading (lit back, pale belly) is what makes a toy read
 * as solid instead of as a flat silhouette, so the shades are generated rather
 * than hand-listed — new colours in COLORS work without extra work here.
 */
export interface DinoPalette {
  /** Main body colour, the one shown on the colour buttons. */
  base: string
  /** Lighter, warmer underside: belly, jaw, inner limbs. */
  belly: string
  /** Deeper version of the base for the back, tail ridge and limb shading. */
  shade: string
  /**
   * The player's complementary colour, used for every trim on the animal:
   * crests, frills, plates, spikes and wing membranes, alongside the spots and
   * stripes. Picking one colour keeps all the trim on a dinosaur matching.
   */
  pattern: string
  /** Lighter partner to the pattern colour, for alternating plates. */
  patternSoft: string
  /** Warm off-white for claws, horns, teeth and beaks. */
  bone: string
  /** Eye white. */
  sclera: string
  /** Pupil and nostrils. */
  pupil: string
}

const hsl = (color: THREE.Color) => {
  const out = { h: 0, s: 0, l: 0 }
  color.getHSL(out)
  return out
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const shift = (
  source: THREE.Color,
  { hue = 0, sat = 1, light = 1 }: { hue?: number; sat?: number; light?: number },
) => {
  const { h, s, l } = hsl(source)
  return new THREE.Color().setHSL(
    (h + hue + 1) % 1,
    clamp01(s * sat),
    clamp01(l * light),
  ).getStyle()
}

export function buildPalette(color: DinoColor, patternColor: PatternColor): DinoPalette {
  const base = new THREE.Color(color)
  const pattern = new THREE.Color(patternColor)

  return {
    base: base.getStyle(),
    belly: shift(base, { hue: 0.02, sat: 0.5, light: 1.42 }),
    shade: shift(base, { sat: 1.12, light: 0.7 }),
    pattern: pattern.getStyle(),
    patternSoft: shift(pattern, { sat: 0.78, light: 1.3 }),
    bone: '#fdf3dc',
    sclera: '#fffdf6',
    pupil: '#1b2a3d',
  }
}
