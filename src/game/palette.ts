import * as THREE from 'three'
import type { DinoColor, PatternColor } from './dinosaurTypes'

/**
 * Natural pigmentation derived from the player's chosen colours. A muted hide,
 * warm underside, and deeper folds remain coordinated for every saved build.
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
  /** Dark tissue around the iris. */
  sclera: string
  iris: string
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
  // Keep the selected hue identifiable, with earthy pigmentation instead of
  // saturated plastic. Work in linear colour, as the lighting pipeline does.
  const base = new THREE.Color(color).lerp(new THREE.Color('#827b58'), 0.22)
  const pattern = new THREE.Color(patternColor).lerp(base, 0.16)

  return {
    base: base.getStyle(),
    belly: base.clone().lerp(new THREE.Color('#cbb991'), 0.64).getStyle(),
    shade: shift(base, { sat: 0.9, light: 0.48 }),
    pattern: pattern.getStyle(),
    patternSoft: shift(pattern, { sat: 0.78, light: 1.3 }),
    bone: '#d8c7a3',
    sclera: '#37392a',
    iris: '#c9973e',
    pupil: '#101711',
  }
}
