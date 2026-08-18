# Dino Lab

A cheerful, touch-first 3D dinosaur builder and racer for kids ages 4–10. Players mix silly dinosaur parts, save their creations, then take them to the track — either driving one themselves or watching the field race.

## Run

```bash
npm install
npm run dev
npm run build
```

Built with Vite, React, TypeScript, Three.js, React Three Fiber, Drei, and responsive CSS.

## Version 1

- Procedural toy-like 3D dinosaur with mouse/touch rotation and idle animation
- Five recognizable head families: Raptor, T-Rex, Triceratops, Brachiosaurus, and Parasaurolophus
- Independent front limbs and back legs with automatic two-legged or four-legged stance
- Round, clawed, and webbed feet; smooth bodies; wings; plates; spikes; and spiked tails
- Plain, spotted, and striped skin choices
- Randomize, reset, design-driven stats, naming, and local save/load
- Desktop, tablet, and phone layouts

## Version 2

- **Drive mode** — steer one of your dinosaurs during the race with the on-screen pads or the arrow keys, collecting stars and dodging tornadoes. The chase camera locks on automatically. Watch mode is still there for anyone who would rather cheer.
- **Rival dinosaurs** — five built-in opponents fill the grid, so a first race is a real race even with one saved dinosaur (`src/game/rivals.ts`).
- **Strength and stamina do something** — strength shortens the spin-out after a tornado and powers the mountain climb; stamina is a late-race fade, so a sprinter leads lap one and gets reeled in on lap two. Both come from the same `calculateStats` the builder's panel displays.
- **Head families matter** — each of the five heads owns a terrain, except Parasaurolophus, which keeps a little of its pace everywhere.
- **Closer racing** — pace is compressed toward the middle rather than clipped at a hard limit, which cut the spread between the best and worst of the 13,500 possible builds from 47% to 20% while keeping every part choice meaningful.
- **Two laps**, with a lap counter and tornadoes spread across the real race duration.
- **Smoking Isle** — a third, longer track: a tropical island lap round a live volcano that forks three times. Each fork offers two ways round of exactly equal length through different terrain, so the choice is about what suits your dinosaur and never about distance. Lava pools on the volcano fork slow anything that runs through them.
- **Replay** — every race is recorded and can be watched again from the podium, with play/pause, a scrub bar, 0.5x/1x/2x speed and the same cameras the race uses. It opens on the wide shot of the whole circuit.
- **Sound** — countdown, start, star, tornado, final lap and finish cues, synthesised in `src/game/sound.ts` with no audio files, plus a mute button on both game pages. Sound starts muted.

### Not yet done

Win counts, best laps, and Star Dash high scores are deliberately absent until where a phone keeps its site data is settled. Only the roster is persisted today.

Both ways round each fork are built to the same arc length as the stretch of main curve they replace, solved by bisection in `src/race/course.ts`. That is what lets everything downstream carry on treating progress as one lap fraction: nothing outside the course needs to know a choice was ever made. Computer racers pick a fork by comparing their own terrain paces; a driving player picks by which side of the road they are on when they reach it.

The replay is a recording, not a re-simulation: pickups are placed with `Math.random` and drive mode depends on what the player did, so `src/race/replay.ts` writes down where everyone actually was at 20Hz and plays it back interpolated.

Configuration, stats, simulation, rendering, and storage remain separate to support the roadmap: safari island and a dinosaur collection are still ahead.
