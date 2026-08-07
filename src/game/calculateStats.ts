import { isBiped, type DinosaurConfig } from './dinosaurTypes'

export type DinoStats = {
  speed: number
  strength: number
  balance: number
  swimming: number
  stamina: number
}

const clamp = (value: number) => Math.max(1, Math.min(5, value))

export function calculateStats(dino: DinosaurConfig): DinoStats {
  let speed = 3
  let strength = 3
  let balance = 3
  let swimming = 2
  let stamina = 3

  if (dino.hindLegs === 'Long') { speed += 1; balance -= 1 }
  if (dino.hindLegs === 'Short') { balance += 1; speed -= 1 }
  if (dino.body === 'Big') { strength += 1; speed -= 1; stamina += 1 }
  if (dino.body === 'Small') { speed += 1; strength -= 1 }
  if (dino.tail === 'Giant Tail') { balance += 2; speed -= 1 }
  if (dino.tail === 'Long Tail' || dino.tail === 'Spiked Tail') balance += 1
  if (dino.tail === 'Stubby Tail') speed += 1
  if (dino.head === 'T-Rex' || dino.head === 'Triceratops') strength += 1
  if (dino.head === 'Brachiosaurus') stamina += 1
  if (dino.feet === 'Webbed Feet') swimming += 2
  if (dino.feet === 'Clawed Feet') strength += 1
  if (dino.feature === 'Plates') { balance += 1; stamina += 1 }
  if (dino.feature === 'Wings') { speed += 1; balance += 1 }
  if (isBiped(dino)) speed += 1
  else stamina += 1

  return {
    speed: clamp(speed),
    strength: clamp(strength),
    balance: clamp(balance),
    swimming: clamp(swimming),
    stamina: clamp(stamina),
  }
}
