export const HEADS = [
  'Raptor',
  'T-Rex',
  'Triceratops',
  'Brachiosaurus',
  'Parasaurolophus',
] as const

export const BODIES = ['Small', 'Medium', 'Big'] as const
export const FRONT_LIMBS = [
  'Tiny Arms',
  'Long Arms',
  'Short Front Legs',
  'Normal Front Legs',
  'Long Front Legs',
] as const
export const HIND_LEGS = ['Short', 'Normal', 'Long'] as const
export const FEET = ['Round Feet', 'Clawed Feet', 'Webbed Feet'] as const
export const TAILS = ['Stubby Tail', 'Long Tail', 'Giant Tail', 'Spiked Tail'] as const
export const FEATURES = ['None', 'Horns', 'Plates', 'Back Spikes', 'Wings'] as const
export const SKINS = ['Plain', 'Spotted', 'Striped'] as const
export const COLORS = ['#66c95a', '#4da6ff', '#9b6ee8', '#f26b4b', '#f2c94c', '#f27db0'] as const

/** Colour of the spots or stripes. Ignored when the skin is Plain. */
export const PATTERN_COLORS = ['#fff3c4', '#2f4858', '#f2994a', '#e0518f', '#7b5ce0', '#1f9d6b'] as const
export const PATTERN_COLOR_NAMES = ['Cream', 'Navy', 'Orange', 'Berry', 'Purple', 'Jade'] as const

export type HeadType = typeof HEADS[number]
export type BodyType = typeof BODIES[number]
export type FrontLimbType = typeof FRONT_LIMBS[number]
export type HindLegType = typeof HIND_LEGS[number]
export type FootType = typeof FEET[number]
export type TailType = typeof TAILS[number]
export type FeatureType = typeof FEATURES[number]
export type SkinType = typeof SKINS[number]
export type DinoColor = typeof COLORS[number]
export type PatternColor = typeof PATTERN_COLORS[number]

export interface DinosaurConfig {
  name: string
  head: HeadType
  body: BodyType
  frontLimbs: FrontLimbType
  hindLegs: HindLegType
  feet: FootType
  tail: TailType
  feature: FeatureType
  color: DinoColor
  skin: SkinType
  patternColor: PatternColor
}

export interface SavedDinosaur {
  version: 3
  id: string
  createdAt: string
  config: DinosaurConfig
}

export const DEFAULT_DINO: DinosaurConfig = {
  name: 'Chompy',
  head: 'Raptor',
  body: 'Medium',
  frontLimbs: 'Tiny Arms',
  hindLegs: 'Normal',
  feet: 'Clawed Feet',
  tail: 'Long Tail',
  feature: 'Back Spikes',
  color: COLORS[0],
  skin: 'Plain',
  patternColor: PATTERN_COLORS[0],
}

export const isBiped = (config: DinosaurConfig) => config.frontLimbs.includes('Arms')
