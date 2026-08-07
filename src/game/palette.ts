import * as THREE from 'three'
import type { DinoColor } from './dinosaurTypes'

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
  /** Contrasting colour for crests, plates, spikes and wing membranes. */
  accent: string
  /** Softer partner to the accent, for the second half of a gradient. */
  accentSoft: string
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

export function buildPalette(color: DinoColor): DinoPalette {
  const base = new THREE.Color(color)
  const { h } = hsl(base)

  // Complementary hue, pulled toward warm yellow so it stays cheerful rather
  // than clashing. A green dino gets a coral crest, a blue one gets gold.
  const accentHue = (h + 0.47) % 1

  return {
    base: base.getStyle(),
    belly: shift(base, { hue: 0.02, sat: 0.5, light: 1.42 }),
    shade: shift(base, { sat: 1.12, light: 0.7 }),
    accent: new THREE.Color().setHSL(accentHue, 0.82, 0.62).getStyle(),
    accentSoft: new THREE.Color().setHSL(accentHue, 0.7, 0.76).getStyle(),
    bone: '#fdf3dc',
    sclera: '#fffdf6',
    pupil: '#1b2a3d',
  }
}
